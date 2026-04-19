import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { logAction } from '@/lib/log';
import { PRICE_RANGES, PRIORITY_TIERS } from '@/lib/constants';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') || '1');
  const size = parseInt(searchParams.get('size') || '20');
  const materialId = searchParams.get('material_id');
  const typeId = searchParams.get('type_id');
  const status = searchParams.get('status');
  const batchId = searchParams.get('batch_id');
  const counter = searchParams.get('counter');
  const keyword = searchParams.get('keyword');
  const searchField = searchParams.get('search_field');
  const priorityTier = searchParams.get('priorityTier');
  const shootingStatus = searchParams.get('shootingStatus');
  const contentStatus = searchParams.get('contentStatus');
  const sortBy = searchParams.get('sort_by') || 'created_at';
  const sortOrder = searchParams.get('sort_order') || 'desc';

  const where: any = { isDeleted: false };
  if (materialId) where.materialId = parseInt(materialId);
  if (typeId) where.typeId = parseInt(typeId);
  if (status) where.status = status;
  if (batchId) where.batchId = parseInt(batchId);
  if (counter) where.counter = parseInt(counter);
  if (priorityTier) where.priorityTier = priorityTier;
  if (shootingStatus) where.shootingStatus = shootingStatus;
  if (contentStatus) where.contentStatus = contentStatus;
  if (keyword) {
    if (searchField === 'sku') {
      where.skuCode = { contains: keyword };
    } else if (searchField === 'name') {
      where.name = { contains: keyword };
    } else if (searchField === 'material') {
      where.material = { name: { contains: keyword } };
    } else if (searchField === 'type') {
      where.type = { name: { contains: keyword } };
    } else {
      where.OR = [
        { skuCode: { contains: keyword } },
        { name: { contains: keyword } },
        { certNo: { contains: keyword } },
        { notes: { contains: keyword } },
      ];
    }
  }

  // Build order by clause
  const validSortFields = ['created_at', 'selling_price', 'cost_price', 'purchase_date', 'sku_code', 'name'];
  const field = validSortFields.includes(sortBy) ? sortBy : 'created_at';
  const direction = sortOrder === 'asc' ? 'asc' : 'desc';

  // Map field names to Prisma field names
  const fieldMap: Record<string, string> = {
    created_at: 'createdAt',
    selling_price: 'sellingPrice',
    cost_price: 'costPrice',
    purchase_date: 'purchaseDate',
    sku_code: 'skuCode',
    name: 'name',
  };
  const orderByField = fieldMap[field] || 'createdAt';
  const orderBy: any = {};
  orderBy[orderByField] = direction;

  const total = await db.item.count({ where });
  const items = await db.item.findMany({
    where,
    include: {
      material: true,
      type: true,
      spec: true,
      tags: true,
      images: { where: { isCover: true }, take: 1 },
      batch: { select: { purchaseDate: true, batchCode: true, totalCost: true, quantity: true } },
    },
    orderBy,
    skip: (page - 1) * size,
    take: size,
  });

  const today = new Date();
  const itemsWithExtras = items.map(item => {
    // For batch items, inherit purchaseDate from batch
    const effectivePurchaseDate = item.purchaseDate || item.batch?.purchaseDate || null;
    const ageDays = effectivePurchaseDate
      ? Math.floor((today.getTime() - new Date(effectivePurchaseDate).getTime()) / (1000 * 60 * 60 * 24))
      : null;
    // For batch items without allocated cost, show estimated cost
    const estimatedCost = (!item.allocatedCost && item.batchId && item.batch)
      ? Math.round((item.batch.totalCost / item.batch.quantity) * 100) / 100
      : null;
    return {
      ...item,
      purchaseDate: effectivePurchaseDate,
      materialName: item.material?.name,
      typeName: item.type?.name,
      ageDays,
      coverImage: item.images[0]?.filename || null,
      estimatedCost,
    };
  });

  return NextResponse.json({
    code: 0,
    data: {
      items: itemsWithExtras,
      pagination: { total, page, size, pages: Math.ceil(total / size) },
    },
    message: 'ok',
  });
}

// Auto-generate SKU code (ASCII only, barcode-compatible)
// Format: {materialId 2digit}{typeId 2digit}-{MMDD}-{seq 3digit}  e.g. 0601-0417-001
async function generateSkuCode(materialId: number, typeId?: number): Promise<string> {
  const mCode = String(materialId).padStart(2, '0');
  const tCode = typeId ? String(typeId).padStart(2, '0') : '00';
  const today = new Date();
  const dateStr = String(today.getMonth() + 1).padStart(2, '0') + String(today.getDate()).padStart(2, '0');
  const prefixFull = `${mCode}${tCode}-${dateStr}-`;

  // Find the latest SKU with this prefix
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

export async function POST(req: Request) {
  const body = await req.json();
  const { skuCode, name, batchId, materialId, typeId, costPrice, sellingPrice, floorPrice, origin, counter, certNo, craftId, era, mainColor, subColor, priceRange, storyPoints, operationNote, extraData, notes, supplierId, purchaseDate, tagIds, sellingPointIds, audienceIds, priorityTier, spec } = body;

  try {
    // For batch items, get materialId from batch if not provided
    let finalMaterialId = materialId;
    let batchData: any = null;
    if (batchId && !materialId) {
      batchData = await db.batch.findUnique({ where: { id: batchId }, include: { material: true } });
      if (batchData) finalMaterialId = batchData.materialId;
    }

    // Validate required fields
    if (!finalMaterialId) {
      return NextResponse.json({ code: 400, data: null, message: '请选择材质' }, { status: 400 });
    }
    if (!typeId) {
      return NextResponse.json({ code: 400, data: null, message: '请选择器型' }, { status: 400 });
    }
    // 高货模式(无batchId)才校验成本价必填；通货模式成本由批次分摊
    if (!batchId && (costPrice == null || costPrice === '' || isNaN(parseFloat(costPrice)))) {
      return NextResponse.json({ code: 400, data: null, message: '请输入有效的成本价' }, { status: 400 });
    }

    // Auto-generate SKU if not provided; validate no Chinese if provided
    if (skuCode && /[^\x00-\x7F]/.test(skuCode)) {
      return NextResponse.json({ code: 400, data: null, message: 'SKU编码不允许包含中文字符' }, { status: 400 });
    }
    const finalSkuCode = skuCode || await generateSkuCode(finalMaterialId, typeId);

    // For batch items, auto-calculate allocatedCost from batch; for high-value items, allocatedCost = costPrice
    let allocatedCost: number | null = null;
    let finalCostPrice: number | null = costPrice != null && costPrice !== '' ? parseFloat(costPrice) : null;
    if (batchId) {
      // 通货模式：从批次分摊成本
      if (!batchData) {
        batchData = await db.batch.findUnique({ where: { id: batchId }, include: { material: true } });
      }
      if (batchData && batchData.totalCost && batchData.quantity > 0) {
        allocatedCost = parseFloat((batchData.totalCost / batchData.quantity).toFixed(2));
        if (finalCostPrice === null) finalCostPrice = allocatedCost;
      }
    } else {
      // 高货模式
      allocatedCost = finalCostPrice;
    }

    // Validate new content fields
    if (priceRange && !(PRICE_RANGES as readonly string[]).includes(priceRange)) {
      return NextResponse.json({ code: 400, data: null, message: '价格带只接受: 走量/中档/精品' }, { status: 400 });
    }
    if (priorityTier && !(PRIORITY_TIERS as readonly string[]).includes(priorityTier)) {
      return NextResponse.json({ code: 400, data: null, message: `档位只接受: ${PRIORITY_TIERS.join('/')}` }, { status: 400 });
    }
    if (storyPoints && storyPoints.length > 5000) {
      return NextResponse.json({ code: 400, data: null, message: '故事点不能超过5000字符' }, { status: 400 });
    }
    if (operationNote && operationNote.length > 5000) {
      return NextResponse.json({ code: 400, data: null, message: '经营笔记不能超过5000字符' }, { status: 400 });
    }

    // Convert spec fields to proper types
    const specData: any = spec ? { ...spec } : null;
    if (specData) {
      // Float fields
      if (specData.weight != null && specData.weight !== '') specData.weight = parseFloat(specData.weight);
      else delete specData.weight;
      if (specData.metalWeight != null && specData.metalWeight !== '') specData.metalWeight = parseFloat(specData.metalWeight);
      else delete specData.metalWeight;
      // Int fields
      if (specData.beadCount != null && specData.beadCount !== '') specData.beadCount = parseInt(specData.beadCount);
      else delete specData.beadCount;
      // String fields (must convert to string for Prisma)
      for (const key of ['braceletSize', 'ringSize', 'beadDiameter', 'size']) {
        if (specData[key] != null && specData[key] !== '') {
          specData[key] = String(specData[key]);
        } else {
          delete specData[key];
        }
      }
    }

    const item = await db.item.create({
      data: {
        skuCode: finalSkuCode,
        name,
        batchCode: batchId ? (await db.batch.findUnique({ where: { id: parseInt(batchId) } }))?.batchCode : null,
        batchId: batchId ? parseInt(batchId) : null,
        materialId: finalMaterialId ? parseInt(finalMaterialId) : null,
        typeId: typeId ? parseInt(typeId) : null,
        costPrice: finalCostPrice,
        allocatedCost,
        sellingPrice: sellingPrice != null ? parseFloat(sellingPrice) : null,
        floorPrice: floorPrice != null ? parseFloat(floorPrice) : null,
        origin: origin || null,
        counter: counter != null ? parseInt(counter) : null,
        certNo: certNo || null,
        craftId: craftId ? parseInt(craftId) : null,
        era: era || null,
        mainColor: mainColor || null,
        subColor: subColor || null,
        priceRange: priceRange || null,
        storyPoints: storyPoints || null,
        operationNote: operationNote || null,
        extraData: extraData || null,
        notes: notes || null,
        supplierId: supplierId ? parseInt(supplierId) : null,
        purchaseDate: purchaseDate || null,
        status: 'in_stock',
        priorityTier: priorityTier || '未定',
        ...(tagIds?.length ? {
          tags: { connect: tagIds.map((id: any) => ({ id: parseInt(id) })) },
        } : {}),
        ...(sellingPointIds?.length ? {
          sellingPoints: {
            create: sellingPointIds.map((spId: any) => ({ sellingPointId: parseInt(spId) })),
          },
        } : {}),
        ...(audienceIds?.length ? {
          audiences: {
            create: audienceIds.map((aId: any) => ({ audienceId: parseInt(aId) })),
          },
        } : {}),
        ...(specData && Object.keys(specData).length > 0 ? {
          spec: { create: specData },
        } : {}),
      },
      include: { material: true, type: true, spec: true, tags: true, sellingPoints: { include: { sellingPoint: true } }, audiences: { include: { audience: true } } },
    });

    // Log create_item
    await logAction('create_item', 'item', item.id, {
      skuCode: item.skuCode,
      name: item.name,
      materialId: finalMaterialId,
      costPrice: costPrice ?? null,
      sellingPrice,
    });

    return NextResponse.json({ code: 0, data: item, message: 'ok' });
  } catch (e: any) {
    if (e.message?.includes('Unique')) {
      return NextResponse.json({ code: 400, data: null, message: 'SKU编号已存在' }, { status: 400 });
    }
    return NextResponse.json({ code: 500, data: null, message: `创建失败: ${e.message}` }, { status: 500 });
  }
}
