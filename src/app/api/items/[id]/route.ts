import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { logAction } from '@/lib/log';
import { PRICE_RANGES } from '@/lib/constants';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await db.item.findUnique({
    where: { id: parseInt(id) },
    include: {
      material: true,
      type: true,
      batch: { include: { material: true, supplier: true } },
      supplier: true,
      spec: true,
      tags: true,
      images: true,
      saleRecords: { include: { customer: true } },
      sellingPoints: { include: { sellingPoint: true } },
      audiences: { include: { audience: true } },
    },
  });
  if (!item || item.isDeleted) {
    return NextResponse.json({ code: 404, data: null, message: '未找到' }, { status: 404 });
  }

  const today = new Date();
  // For batch items, inherit purchaseDate from batch
  const effectivePurchaseDate = item.purchaseDate || item.batch?.purchaseDate || null;
  const ageDays = effectivePurchaseDate
    ? Math.floor((today.getTime() - new Date(effectivePurchaseDate).getTime()) / (1000 * 60 * 60 * 24))
    : null;
  // For batch items, inherit supplier from batch
  const supplierName = item.supplier?.name || item.batch?.supplier?.name || null;

  return NextResponse.json({
    code: 0,
    data: {
      ...item,
      purchaseDate: effectivePurchaseDate,
      materialName: item.material?.name,
      typeName: item.type?.name,
      supplierName,
      ageDays,
      coverImage: item.images.find(i => i.isCover)?.filename || item.images[0]?.filename || null,
      sellingPoints: item.sellingPoints?.map(sp => ({ id: sp.sellingPoint.id, name: sp.sellingPoint.name })) || [],
      audiences: item.audiences?.map(a => ({ id: a.audience.id, name: a.audience.name })) || [],
    },
    message: 'ok',
  });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { tagIds, sellingPointIds, audienceIds, spec, ...data } = body;

  try {
    // Validate new content fields
    if (data.priceRange && !(PRICE_RANGES as readonly string[]).includes(data.priceRange)) {
      return NextResponse.json({ code: 400, data: null, message: '价格带只接受: 走量/中档/精品' }, { status: 400 });
    }
    if (data.storyPoints && data.storyPoints.length > 5000) {
      return NextResponse.json({ code: 400, data: null, message: '故事点不能超过5000字符' }, { status: 400 });
    }
    if (data.operationNote && data.operationNote.length > 5000) {
      return NextResponse.json({ code: 400, data: null, message: '经营笔记不能超过5000字符' }, { status: 400 });
    }

    // Get original item for logging
    const original = await db.item.findUnique({ where: { id: parseInt(id) } });

    // Update tags if provided
    if (tagIds !== undefined) {
      await db.itemTag.deleteMany({ where: { itemId: parseInt(id) } });
      if (tagIds.length > 0) {
        await db.itemTag.createMany({ data: tagIds.map((tid: number) => ({ itemId: parseInt(id), tagId: tid })) });
      }
    }

    // Update selling points if provided (replace semantics)
    if (sellingPointIds !== undefined) {
      await db.itemSellingPoint.deleteMany({ where: { itemId: parseInt(id) } });
      if (sellingPointIds.length > 0) {
        await db.itemSellingPoint.createMany({ data: sellingPointIds.map((spId: number) => ({ itemId: parseInt(id), sellingPointId: spId })) });
      }
    }

    // Update audiences if provided (replace semantics)
    if (audienceIds !== undefined) {
      await db.itemAudience.deleteMany({ where: { itemId: parseInt(id) } });
      if (audienceIds.length > 0) {
        await db.itemAudience.createMany({ data: audienceIds.map((aId: number) => ({ itemId: parseInt(id), audienceId: aId })) });
      }
    }

    // Update spec if provided
    if (spec) {
      const specData: any = { ...spec };
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
      await db.itemSpec.upsert({
        where: { itemId: parseInt(id) },
        update: specData,
        create: { itemId: parseInt(id), ...specData },
      });
    }

    const item = await db.item.update({
      where: { id: parseInt(id) },
      data: {
        ...data,
        counter: data.counter != null ? parseInt(data.counter) : undefined,
        costPrice: data.costPrice != null ? parseFloat(data.costPrice) : undefined,
        sellingPrice: data.sellingPrice != null ? parseFloat(data.sellingPrice) : undefined,
        floorPrice: data.floorPrice != null ? parseFloat(data.floorPrice) : undefined,
        materialId: data.materialId != null ? parseInt(data.materialId) : undefined,
        typeId: data.typeId != null ? parseInt(data.typeId) : undefined,
        supplierId: data.supplierId != null ? parseInt(data.supplierId) : undefined,
        batchId: data.batchId != null ? parseInt(data.batchId) : undefined,
        craftId: data.craftId != null ? parseInt(data.craftId) : undefined,
      },
      include: { material: true, type: true, spec: true, tags: true, sellingPoints: { include: { sellingPoint: true } }, audiences: { include: { audience: true } } },
    });

    // Log edit_item with changed fields
    if (original) {
      const changes: Record<string, { from: unknown; to: unknown }> = {};
      const trackedFields = ['skuCode', 'name', 'materialId', 'typeId', 'costPrice', 'allocatedCost', 'sellingPrice', 'floorPrice', 'status', 'counter', 'origin', 'certNo', 'craftId', 'era', 'mainColor', 'subColor', 'priceRange', 'storyPoints', 'operationNote', 'notes', 'supplierId', 'purchaseDate'];
      for (const field of trackedFields) {
        const oldVal = (original as any)[field];
        const newVal = (item as any)[field];
        if (oldVal !== newVal) {
          changes[field] = { from: oldVal, to: newVal };
        }
      }
      if (Object.keys(changes).length > 0) {
        await logAction('edit_item', 'item', item.id, changes);
      }
    }

    return NextResponse.json({ code: 0, data: item, message: 'ok' });
  } catch (e: any) {
    return NextResponse.json({ code: 500, data: null, message: `更新失败: ${e.message}` }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const hardDelete = searchParams.get('hard') === 'true';
  try {
    const item = await db.item.findUnique({ where: { id: parseInt(id) } });
    if (!item) {
      return NextResponse.json({ code: 404, data: null, message: '未找到' }, { status: 404 });
    }
    if (hardDelete) {
      await db.item.delete({ where: { id: parseInt(id) } });
    } else {
      await db.item.update({ where: { id: parseInt(id) }, data: { isDeleted: true } });
    }

    // Log delete_item
    if (item) {
      await logAction('delete_item', 'item', item.id, {
        skuCode: item.skuCode,
        name: item.name,
        status: item.status,
        hardDelete,
      });
    }

    return NextResponse.json({ code: 0, data: null, message: 'ok' });
  } catch (e: any) {
    return NextResponse.json({ code: 500, data: null, message: `删除失败: ${e.message}` }, { status: 500 });
  }
}
