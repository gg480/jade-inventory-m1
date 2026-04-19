import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const item = await db.item.findUnique({
    where: { id: parseInt(id) },
    include: {
      material: true,
      type: true,
      craft: true,
      spec: true,
      images: true,
      sellingPoints: { include: { sellingPoint: true } },
      audiences: { include: { audience: true } },
    },
  });

  if (!item || item.isDeleted) {
    return NextResponse.json({ code: 404, data: null, message: '未找到' }, { status: 404 });
  }

  // Helper: return value or null (never undefined)
  const n = (v: unknown) => (v == null ? null : v);

  // Build spec object from ItemSpec
  const specData: Record<string, unknown> = {};
  if (item.spec) {
    if (item.spec.weight != null) specData['克重(g)'] = item.spec.weight;
    if (item.spec.metalWeight != null) specData['金重(g)'] = item.spec.metalWeight;
    if (item.spec.size != null) specData['尺寸'] = item.spec.size;
    if (item.spec.braceletSize != null) specData['圈口'] = item.spec.braceletSize;
    if (item.spec.beadCount != null) specData['颗数'] = item.spec.beadCount;
    if (item.spec.beadDiameter != null) specData['珠径'] = item.spec.beadDiameter;
    if (item.spec.ringSize != null) specData['戒圈'] = item.spec.ringSize;
  }

  // Main image: cover image or first image
  const coverImage = item.images.find(i => i.isCover) || item.images[0];

  const data = {
    'SKU编码': n(item.skuCode),
    '商品名称': n(item.name),
    '材质大类': n(item.material?.category),
    '材质细类': n(item.material?.name),
    '器型': n(item.type?.name),
    '工艺': n(item.craft?.name),
    '产地': n(item.origin),
    '年代款式': n(item.era),
    '证书编号': n(item.certNo),
    '主色': n(item.mainColor),
    '副色': n(item.subColor),
    '尺寸': Object.keys(specData).length > 0 ? specData : null,
    '重量': item.spec?.weight != null ? item.spec.weight : null,
    '价格带': n(item.priceRange),
    '建议售价': item.sellingPrice ?? null,
    '卖点标签': item.sellingPoints?.map(sp => sp.sellingPoint.name) || [],
    '目标人群': item.audiences?.map(a => a.audience.name) || [],
    '故事点': n(item.storyPoints),
    '图片': {
      '主图': coverImage ? n(coverImage.filename) : null,
      '所有图片': item.images.map(img => img.filename),
    },
    '状态': {
      '档位': n(item.priorityTier),
      '拍摄状态': n(item.shootingStatus),
      '内容状态': n(item.contentStatus),
    },
    '最后更新': item.updatedAt ? new Date(item.updatedAt).toISOString() : null,
  };

  return NextResponse.json({ code: 0, data, message: 'ok' });
}
