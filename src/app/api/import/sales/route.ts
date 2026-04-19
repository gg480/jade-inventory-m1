import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { logAction } from '@/lib/log';
import { parse as csvParse } from 'csv-parse/sync';

// Auto-generate SKU code
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
    const uncategorized = materialCache.get('未分类');
    if (uncategorized) return uncategorized.id;
    const created = await db.dictMaterial.create({ data: { name: '未分类', category: '其他', sortOrder: 99 } });
    materialCache.set('未分类', created);
    return created.id;
  }
  const trimmed = name.trim();
  const cached = materialCache.get(trimmed);
  if (cached) return cached.id;

  const categoryMap: Record<string, string> = {
    '翡翠': '玉', '和田玉': '玉', '碧玉': '玉',
    '黄金': '贵金属', '银': '贵金属', '铂金': '贵金属', '18K金': '贵金属',
    '珍珠': '其他', '朱砂': '文玩', '蜜蜡': '文玩', '琥珀': '文玩',
  };
  const category = categoryMap[trimmed] || '其他';
  const created = await db.dictMaterial.create({ data: { name: trimmed, category } });
  materialCache.set(trimmed, created);
  return created.id;
}

// Find or create type by name
async function findOrCreateType(name: string, typeCache: Map<string, any>): Promise<number | null> {
  if (!name || !name.trim()) {
    const uncategorized = typeCache.get('未分类');
    if (uncategorized) return uncategorized.id;
    const lastType = await db.dictType.findFirst({ orderBy: { sortOrder: 'desc' } });
    const sortOrder = (lastType?.sortOrder || 0) + 1;
    const created = await db.dictType.create({
      data: { name: '未分类', specFields: JSON.stringify({ weight: { required: false } }), sortOrder },
    });
    typeCache.set('未分类', created);
    return created.id;
  }
  const trimmed = name.trim();
  const cached = typeCache.get(trimmed);
  if (cached) return cached.id;

  const lastType = await db.dictType.findFirst({ orderBy: { sortOrder: 'desc' } });
  const sortOrder = (lastType?.sortOrder || 0) + 1;
  const created = await db.dictType.create({
    data: { name: trimmed, specFields: JSON.stringify({ weight: { required: false } }), sortOrder },
  });
  typeCache.set(trimmed, created);
  return created.id;
}

// Infer material/type from item name
function inferFromName(name: string): { material?: string; type?: string } {
  if (!name) return {};
  const result: { material?: string; type?: string } = {};
  const materialKeywords: [string, string][] = [
    ['翡翠', '翡翠'], ['和田玉', '和田玉'], ['碧玉', '碧玉'],
    ['黄金', '黄金'], ['18K', '18K金'], ['银', '银'], ['铂金', '铂金'],
    ['蜜蜡', '蜜蜡'], ['琥珀', '琥珀'], ['朱砂', '朱砂'],
    ['绿松石', '绿松石'], ['南红', '南红'], ['珍珠', '珍珠'],
  ];
  for (const [keyword, material] of materialKeywords) {
    if (name.includes(keyword)) { result.material = material; break; }
  }
  const typeKeywords: [string, string][] = [
    ['手镯', '手镯'], ['手链', '手链'], ['项链', '项链'], ['脚链', '脚链'],
    ['戒指', '戒指'], ['吊坠', '吊坠'], ['耳环', '耳饰'], ['耳钉', '耳饰'],
    ['摆件', '摆件'], ['挂件', '吊坠'], ['平安扣', '吊坠'],
  ];
  for (const [keyword, type] of typeKeywords) {
    if (name.includes(keyword)) { result.type = type; break; }
  }
  return result;
}

// Generate sale number
async function generateSaleNo(): Promise<string> {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `S-${dateStr}-`;
  const lastSale = await db.saleRecord.findFirst({
    where: { saleNo: { startsWith: prefix } },
    orderBy: { saleNo: 'desc' },
  });
  let seq = 1;
  if (lastSale) {
    const parts = lastSale.saleNo.split('-');
    const lastSeq = parseInt(parts[parts.length - 1]);
    if (!isNaN(lastSeq)) seq = lastSeq + 1;
  }
  return `${prefix}${String(seq).padStart(3, '0')}`;
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const autoCreate = formData.get('autoCreate') !== 'false';

    if (!file) {
      return NextResponse.json({ code: 400, data: null, message: '请上传CSV文件' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let csvText = buffer.toString('utf-8');
    if (csvText.charCodeAt(0) === 0xFEFF) {
      csvText = csvText.slice(1);
    }

    const rows = csvParse(csvText, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
      relax_column_count: true, // 容忍列数不一致
    }) as Record<string, string>[];

    if (rows.length === 0) {
      return NextResponse.json({ code: 400, data: null, message: 'CSV文件为空' }, { status: 400 });
    }

    // Build caches
    const materialCache = new Map<string, any>();
    const typeCache = new Map<string, any>();
    const allMaterials = await db.dictMaterial.findMany();
    const allTypes = await db.dictType.findMany();
    allMaterials.forEach(m => materialCache.set(m.name, m));
    allTypes.forEach(t => typeCache.set(t.name, t));

    // Channel mapping
    const CHANNEL_MAP: Record<string, string> = {
      '门店': 'store', '微信': 'wechat', '网店': 'wechat', '线上': 'wechat',
      'store': 'store', 'wechat': 'wechat',
    };

    const results: { row: number; success: boolean; skuCode?: string; saleNo?: string; error?: string; autoCreatedItem?: boolean }[] = [];
    let successCount = 0;
    let failCount = 0;
    let autoCreatedItemCount = 0;
    const autoCreated: { materials: string[]; types: string[] } = { materials: [], types: [] };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;

      try {
        // Support multiple column name conventions
        const name = row['名称'] || row['name'] || row['货品名称'] || '';
        const skuCode = row['SKU'] || row['sku'] || row['SKU编号'] || row['编码'] || '';
        const matchKey = row['匹配码'] || row['matchKey'] || row['关联码'] || '';
        let materialName = row['材质'] || row['material'] || row['材质名称'] || '';
        let typeName = row['器型'] || row['type'] || row['器型名称'] || '';
        const costRaw = row['成本价'] || row['costPrice'] || row['成本'] || '';
        const actualPriceStr = row['成交价'] || row['actualPrice'] || row['销售价'] || row['售价'] || '';
        const saleDate = row['销售日期'] || row['saleDate'] || row['日期'] || '';
        const channelInput = row['渠道'] || row['channel'] || '门店';
        const customerName = row['客户姓名'] || row['客户'] || row['customerName'] || '';
        const customerPhone = row['客户电话'] || row['电话'] || row['customerPhone'] || '';
        const note = row['备注'] || row['notes'] || '';

        // Validate required: need at least name or skuCode to identify the item
        if (!name && !skuCode) {
          results.push({ row: rowNum, success: false, error: '缺少名称和SKU编号（至少填一项）' });
          failCount++;
          continue;
        }

        // Validate actual price
        if (!actualPriceStr) {
          results.push({ row: rowNum, success: false, error: '缺少成交价' });
          failCount++;
          continue;
        }
        const actualPrice = parseFloat(actualPriceStr);
        if (isNaN(actualPrice) || actualPrice <= 0) {
          results.push({ row: rowNum, success: false, error: '成交价格式无效' });
          failCount++;
          continue;
        }

        // Find existing item by: 1) SKU, 2) matchKey in notes, 3) name+costPrice
        let item = null;
        let autoCreatedItem = false;

        if (skuCode) {
          item = await db.item.findUnique({ where: { skuCode } });
        }

        if (!item && matchKey) {
          // Search by matchKey stored in notes as [MK:xxx]
          // Prefer in_stock items over sold items
          item = await db.item.findFirst({
            where: {
              notes: { contains: `[MK:${matchKey}]` },
              isDeleted: false,
              status: 'in_stock',
            },
          });
          // Fallback to any non-deleted item
          if (!item) {
            item = await db.item.findFirst({
              where: {
                notes: { contains: `[MK:${matchKey}]` },
                isDeleted: false,
              },
            });
          }
        }

        if (!item && name) {
          // Try to find by name + costPrice
          const cost = costRaw ? parseFloat(costRaw) : undefined;
          item = await db.item.findFirst({
            where: {
              name,
              ...(cost && !isNaN(cost) ? { costPrice: cost } : {}),
              isDeleted: false,
            },
          });
        }

        // If item not found and autoCreate is enabled, create a "sold" item
        if (!item && autoCreate && name) {
          // Infer material/type from name if not provided
          if (!materialName || !typeName) {
            const inf = inferFromName(name);
            if (!materialName && inf.material) materialName = inf.material;
            if (!typeName && inf.type) typeName = inf.type;
          }

          const materialId = await findOrCreateMaterial(materialName, materialCache);
          const typeId = await findOrCreateType(typeName, typeCache);

          // Check new entries in caches for autoCreated tracking
          for (const [k, v] of materialCache) {
            if (!allMaterials.find(m => m.name === k) && !autoCreated.materials.includes(k)) {
              autoCreated.materials.push(k);
            }
          }
          for (const [k, v] of typeCache) {
            if (!allTypes.find(t => t.name === k) && !autoCreated.types.includes(k)) {
              autoCreated.types.push(k);
            }
          }

          const newSkuCode = await generateSkuCode(materialId, typeId);
          const cost = costRaw ? parseFloat(costRaw) : null;

          const matchKeyNote = matchKey ? `[MK:${matchKey}]` : '';
          const combinedNotes = [matchKeyNote, note].filter(Boolean).join(' ') || null;

          item = await db.item.create({
            data: {
              skuCode: newSkuCode,
              name,
              materialId,
              typeId,
              costPrice: cost && !isNaN(cost) ? cost : null,
              allocatedCost: cost && !isNaN(cost) ? cost : null,
              sellingPrice: actualPrice,
              status: 'sold', // Already sold
              purchaseDate: saleDate || null,
              notes: combinedNotes,
            },
          });
          autoCreatedItem = true;
          autoCreatedItemCount++;
        }

        if (!item) {
          results.push({ row: rowNum, success: false, error: skuCode ? `SKU「${skuCode}」不存在` : `未找到货品「${name}」` });
          failCount++;
          continue;
        }

        if (item.status === 'sold' && !autoCreatedItem) {
          results.push({ row: rowNum, success: false, skuCode: item.skuCode, error: `SKU「${item.skuCode}」已售出` });
          failCount++;
          continue;
        }

        // Determine channel
        const channel = CHANNEL_MAP[channelInput] || 'store';

        // Find or create customer
        let customerId: number | null = null;
        if (customerName && autoCreate) {
          let customer = await db.customer.findFirst({ where: { name: customerName } });
          if (!customer) {
            const customerCode = `C${Date.now()}${Math.floor(Math.random() * 1000)}`;
            customer = await db.customer.create({
              data: { customerCode, name: customerName, phone: customerPhone || null },
            });
          }
          if (customer) customerId = customer.id;
        }

        // Generate sale number
        const saleNo = await generateSaleNo();

        // Create sale record
        const sale = await db.saleRecord.create({
          data: {
            saleNo,
            itemId: item.id,
            actualPrice,
            channel,
            saleDate: saleDate || new Date().toISOString().slice(0, 10),
            customerId,
            note: note || null,
          },
        });

        // Update item status to sold (if not already)
        if (item.status !== 'sold') {
          await db.item.update({
            where: { id: item.id },
            data: { status: 'sold' },
          });
        }

        await logAction('import_sale', 'sale', sale.id, {
          saleNo,
          skuCode: item.skuCode,
          actualPrice,
          saleDate,
          row: rowNum,
        });

        results.push({ row: rowNum, success: true, skuCode: item.skuCode, saleNo, autoCreatedItem });
        successCount++;
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        results.push({ row: rowNum, success: false, error: `处理失败: ${message}` });
        failCount++;
      }
    }

    return NextResponse.json({
      code: 0,
      data: {
        total: rows.length,
        successCount,
        failCount,
        autoCreatedItemCount,
        autoCreated,
        results,
      },
      message: `导入完成: 成功${successCount}条${autoCreatedItemCount > 0 ? `(含${autoCreatedItemCount}条自动创建货品)` : ''}, 失败${failCount}条`,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ code: 500, data: null, message: `导入失败: ${message}` }, { status: 500 });
  }
}
