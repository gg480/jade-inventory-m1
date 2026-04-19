import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  try {
    const item = await db.dictSellingPoint.update({
      where: { id: parseInt(id) },
      data: body,
    });
    return NextResponse.json({ code: 0, data: item, message: 'ok' });
  } catch (e: any) {
    return NextResponse.json({ code: 500, data: null, message: '更新失败' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    // Check if used by items
    const itemCount = await db.itemSellingPoint.count({ where: { sellingPointId: parseInt(id) } });
    if (itemCount > 0) {
      return NextResponse.json({ code: 400, data: null, message: `该卖点已关联${itemCount}件货品，无法删除，请先停用` }, { status: 400 });
    }
    await db.dictSellingPoint.update({ where: { id: parseInt(id) }, data: { isActive: false } });
    return NextResponse.json({ code: 0, data: null, message: 'ok' });
  } catch (e: any) {
    return NextResponse.json({ code: 500, data: null, message: '删除失败' }, { status: 500 });
  }
}
