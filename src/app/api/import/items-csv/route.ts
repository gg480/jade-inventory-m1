import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { parse } from 'csv-parse/sync';

const db = new PrismaClient();

// Auto-generate SKU code (same logic as items/route.ts)
async function generateSkuCode(materialId: number, typeId?: number | null): Promise<string> {
  const mCode = String(materialId).padStart(2, '0');
  const tCode = typeId ? String(typeId).padStart(2, '0') : '00';
  const today = new Date();
  const dateStr = String(today.getMonth() + 1).padStart(2, '0') + String(today.getDate()).padStart(2, '0');
  const prefixFull = `${mCode}${tCode}-${dateStr}-`;

  const lastItem = await db.item.findFirst({
    where: { skuCode: { startsWith: prefixFull } },
    orderBy: { skuCode: 'desc' },
  });

  let seq = 1;
  if (lastItem) {
    const parts = lastItem.skuCode.split('-');
    const lastSeq = parseInt(parts[parts.length - 1]);
    if (!isNaN(lastSeq)) seq = lastSeq + 1;
  }

  return `${prefixFull}${String(seq).padStart(3, '0')}`;
}

// Find or create material by name
async function findOrCreateMaterial(name: string, materialCache: Map<string, any>): Promise<number> {
  if (!name || !name.trim()) {
    // Return "未分类" material
    const uncategorized = materialCache.get('未分类');
    if (uncategorized) return uncategorized.id;
    // Create if not exists
    const created = await db.dictMaterial.create({ data: { name: '未分类', category: '其他', sortOrder: 99 } });
    materialCache.set('未分类', created);
    return created.id;
  }
  const trimmed = name.trim();

  // Try exact match first
  const cached = materialCache.get(trimmed);
  if (cached) return cached.id;

  // Auto-create with inferred category
  const categoryMap: Record<string, string> = {
    '翡翠': '玉', '和田玉': '玉', '玉': '玉', '碧玉': '玉', '青玉': '玉', '白玉': '玉', '糖玉': '玉', '墨玉': '玉', '黄玉': '玉',
    '黄金': '贵金属', '银': '贵金属', '铂金': '贵金属', '18K金': '贵金属', 'k铂金': '贵金属', 'K金': '贵金属',
    '珍珠': '其他', '珊瑚': '其他', '砗磲': '其他',
    '朱砂': '文玩', '蜜蜡': '文玩', '琥珀': '文玩', '绿松石': '文玩', '南红': '文玩', '沉香': '文玩',
    '紫水晶': '水晶', '黄水晶': '水晶', '粉水晶': '水晶', '白水晶': '水晶', '发晶': '水晶', '黑曜石': '水晶',
  };
  const category = categoryMap[trimmed] || '其他';

  const created = await db.dictMaterial.create({
    data: { name: trimmed, category },
  });
  console.log(`[IMPORT] Auto-created material: ${trimmed} (${category}), id=${created.id}`);
  materialCache.set(trimmed, created);
  return created.id;
}

// Find or create type by name
async function findOrCreateType(name: string, typeCache: Map<string, any>): Promise<number | null> {
  if (!name || !name.trim()) {
    // Return "未分类" type
    const uncategorized = typeCache.get('未分类');
    if (uncategorized) return uncategorized.id;
    // Create if not exists
    const lastType = await db.dictType.findFirst({ orderBy: { sortOrder: 'desc' } });
    const sortOrder = (lastType?.sortOrder || 0) + 1;
    const created = await db.dictType.create({
      data: { name: '未分类', specFields: JSON.stringify({ weight: { required: false } }), sortOrder },
    });
    typeCache.set('未分类', created);
    return created.id;
  }
  const trimmed = name.trim();

  // Try exact match first
  const cached = typeCache.get(trimmed);
  if (cached) return cached.id;

  // Auto-create with empty specFields
  const lastType = await db.dictType.findFirst({ orderBy: { sortOrder: 'desc' } });
  const sortOrder = (lastType?.sortOrder || 0) + 1;

  const created = await db.dictType.create({
    data: { name: trimmed, specFields: JSON.stringify({ weight: { required: false } }), sortOrder },
  });
  console.log(`[IMPORT] Auto-created type: ${trimmed}, id=${created.id}`);
  typeCache.set(trimmed, created);
  return created.id;
}

// Infer material/type from item name
function inferFromName(name: string): { material?: string; type?: string } {
  if (!name) return {};
  const result: { material?: string; type?: string } = {};

  // Material keywords
  const materialKeywords: [string, string][] = [
    ['翡翠', '翡翠'], ['和田玉', '和田玉'], ['碧玉', '碧玉'], ['青玉', '青玉'],
    ['白玉', '白玉'], ['黄金', '黄金'], ['18K', '18K金'], ['银', '银'],
    ['铂金', '铂金'], ['蜜蜡', '蜜蜡'], ['琥珀', '琥珀'], ['朱砂', '朱砂'],
    ['绿松石', '绿松石'], ['南红', '南红'], ['紫水晶', '紫水晶'], ['黄水晶', '黄水晶'],
    ['粉水晶', '粉水晶'], ['白水晶', '白水晶'], ['发晶', '发晶'], ['黑曜石', '黑曜石'],
    ['沉香', '沉香'], ['珍珠', '珍珠'], ['珊瑚', '珊瑚'],
  ];
  for (const [keyword, material] of materialKeywords) {
    if (name.includes(keyword)) {
      result.material = material;
      break;
    }
  }

  // Type keywords
  const typeKeywords: [string, string][] = [
    ['手镯', '手镯'], ['手链', '手链'], ['项链', '项链'], ['脚链', '脚链'],
    ['戒指', '戒指'], ['吊坠', '吊坠'], ['耳环', '耳饰'], ['耳钉', '耳饰'], ['耳饰', '耳饰'],
    ['摆件', '摆件'], ['挂件', '吊坠'], ['平安扣', '吊坠'], ['珠串', '项链'],
  ];
  for (const [keyword, type] of typeKeywords) {
    if (name.includes(keyword)) {
      result.type = type;
      break;
    }
  }

  return result;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ code: 400, message: '请上传CSV文件' }, { status: 400 });
    }

    const text = await file.text();
    const records = parse(text, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
      relax_column_count: true, // 容忍列数不一致（用户CSV常有缺失列）
    });

    // Build caches for faster lookup
    const materialCache = new Map<string, any>();
    const typeCache = new Map<string, any>();
    const allMaterials = await db.dictMaterial.findMany();
    const allTypes = await db.dictType.findMany();
    allMaterials.forEach(m => materialCache.set(m.name, m));
    allTypes.forEach(t => typeCache.set(t.name, t));

    let success = 0;
    let skipped = 0;
    let duplicated = 0;
    const errors: string[] = [];
    const autoCreated: { materials: string[]; types: string[] } = { materials: [], types: [] };
    const inferred: { row: number; field: string; value: string }[] = [];

    for (let i = 0; i < records.length; i++) {
      const row = records[i];
      const rowNum = i + 2; // +2 for header row + 0-indexed

      try {
        // Support multiple column name conventions
        const name = row['名称'] || row['name'] || row['货品名称'] || '';
        const sku = row['SKU'] || row['sku'] || row['编码'] || row['skuCode'] || '';
        const matchKey = row['匹配码'] || row['matchKey'] || row['关联码'] || ''; // For linking with sales import
        let materialName = row['材质'] || row['material'] || row['材质名称'] || '';
        let typeName = row['器型'] || row['type'] || row['器型名称'] || '';
        const costRaw = row['成本价'] || row['costPrice'] || row['成本'] || '';
        const priceRaw = row['零售价'] || row['sellingPrice'] || row['售价'] || row['标价'] || '';
        const counterRaw = row['柜台'] || row['counter'] || '';
        const quantityRaw = row['数量'] || row['quantity'] || row['qty'] || '1';
        const purchaseDate = row['采购日期'] || row['purchaseDate'] || row['入库日期'] || '';
        const origin = row['产地'] || row['origin'] || '';
        const certNo = row['证书号'] || row['certNo'] || '';
        const notes = row['备注'] || row['notes'] || '';

        if (!name) {
          errors.push(`第${rowNum}行: 名称不能为空`);
          skipped++;
          continue;
        }

        // Smart inference: if material/type not provided, try to infer from name
        if (!materialName || !typeName) {
          const inferred_ = inferFromName(name);
          if (!materialName && inferred_.material) {
            materialName = inferred_.material;
            inferred.push({ row: rowNum, field: '材质', value: materialName });
          }
          if (!typeName && inferred_.type) {
            typeName = inferred_.type;
            inferred.push({ row: rowNum, field: '器型', value: typeName });
          }
        }

        // Find or create material
        let materialId: number;
        {
          const prevSize = materialCache.size;
          materialId = await findOrCreateMaterial(materialName, materialCache);
          if (materialCache.size > prevSize) {
            // A new material was created
            const newMat = materialCache.get(materialName || '未分类');
            if (newMat && !autoCreated.materials.includes(newMat.name)) {
              autoCreated.materials.push(newMat.name);
            }
          }
        }

        // Find or create type
        let typeId: number | null = null;
        if (typeName) {
          const prevSize = typeCache.size;
          typeId = await findOrCreateType(typeName, typeCache);
          if (typeCache.size > prevSize) {
            const newType = typeCache.get(typeName);
            if (newType && !autoCreated.types.includes(newType.name)) {
              autoCreated.types.push(newType.name);
            }
          }
        } else {
          // Default to "未分类" type
          typeId = await findOrCreateType('', typeCache);
        }

        // Parse prices (unit price, not total)
        const cost = costRaw ? parseFloat(costRaw) : null;
        const price = priceRaw ? parseFloat(priceRaw) : null;
        const counter = counterRaw ? parseInt(counterRaw) : null;
        const quantity = Math.max(1, parseInt(quantityRaw) || 1);

        // Parse purchase date
        let parsedDate: string | null = null;
        if (purchaseDate) {
          const d = new Date(purchaseDate);
          if (!isNaN(d.getTime())) {
            parsedDate = d.toISOString().slice(0, 10);
          }
        }

        // Dedup check: skip if same name + costPrice + certNo already exists
        // For quantity > 1, check if the exact same number of items already exist
        const existingCount = await db.item.count({
          where: {
            name,
            costPrice: cost && !isNaN(cost) ? cost : null,
            certNo: certNo || null,
            isDeleted: false,
          },
        });
        if (existingCount > 0) {
          if (existingCount >= quantity) {
            // All items already exist, skip entirely
            duplicated += quantity;
            continue;
          }
          // Some items exist: only create the difference
          const remaining = quantity - existingCount;
          duplicated += existingCount;
          // Continue to create only 'remaining' items below
          // We adjust quantity for the creation loop
          // (We'll create 'remaining' items instead of 'quantity')
          // Fall through to creation with adjusted count
          const notesWithKey = [
            matchKey ? `[MK:${matchKey}]` : '',
            notes,
          ].filter(Boolean).join(' ') || null;

          for (let q = 0; q < remaining; q++) {
            const finalSkuCode = await generateSkuCode(materialId, typeId);
            await db.item.create({
              data: {
                skuCode: finalSkuCode,
                name: name,
                materialId: materialId,
                typeId: typeId,
                costPrice: cost && !isNaN(cost) ? cost : null,
                allocatedCost: cost && !isNaN(cost) ? cost : null,
                sellingPrice: price && !isNaN(price) ? price : 0,
                counter: counter && !isNaN(counter) ? counter : null,
                purchaseDate: parsedDate,
                origin: origin || null,
                certNo: certNo || null,
                notes: notesWithKey,
                status: 'in_stock',
              },
            });
          }
          success += remaining;
          continue;
        }

        // Create items (one per quantity, each with same unit costPrice)
        // Store matchKey in notes for sales import linking: [MK:xxx]
        const notesWithKey = [
          matchKey ? `[MK:${matchKey}]` : '',
          notes,
        ].filter(Boolean).join(' ') || null;

        for (let q = 0; q < quantity; q++) {
          const finalSkuCode = await generateSkuCode(materialId, typeId);

          await db.item.create({
            data: {
              skuCode: finalSkuCode,
              name: name,
              materialId: materialId,
              typeId: typeId,
              costPrice: cost && !isNaN(cost) ? cost : null,
              allocatedCost: cost && !isNaN(cost) ? cost : null,
              sellingPrice: price && !isNaN(price) ? price : 0,
              counter: counter && !isNaN(counter) ? counter : null,
              purchaseDate: parsedDate,
              origin: origin || null,
              certNo: certNo || null,
              notes: notesWithKey,
              status: 'in_stock',
            },
          });
        }

        success += quantity;
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        errors.push(`第${rowNum}行: ${message}`);
      }
    }

    // Build result message
    let message = `导入完成: 成功${success}件, 跳过${skipped}行`;
    if (duplicated > 0) message += `, 重复跳过${duplicated}件`;
    if (errors.length > 0) message += `, 错误${errors.length}行`;
    if (autoCreated.materials.length > 0) message += ` | 自动创建材质: ${autoCreated.materials.join('、')}`;
    if (autoCreated.types.length > 0) message += ` | 自动创建器型: ${autoCreated.types.join('、')}`;

    return NextResponse.json({
      code: 0,
      data: { success, skipped, duplicated, errors, autoCreated, inferred },
      message,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ code: 500, message: `导入失败: ${message}` }, { status: 500 });
  }
}
