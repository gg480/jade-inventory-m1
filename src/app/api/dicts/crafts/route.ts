import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const includeInactive = searchParams.get('include_inactive') === 'true';
  const items = await db.dictCraft.findMany({
    where: includeInactive ? undefined : { isActive: true },
    orderBy: { sortOrder: 'asc' },
  });
  return NextResponse.json({ code: 0, data: items, message: 'ok' });
}

export async function POST(req: Request) {
  const body = await req.json();
  const { name, description, sortOrder } = body;
  try {
    const item = await db.dictCraft.create({
      data: { name, description, sortOrder: sortOrder ?? 0 },
    });
    return NextResponse.json({ code: 0, data: item, message: 'ok' });
  } catch (e: any) {
    if (e.message?.includes('Unique')) {
      return NextResponse.json({ code: 400, data: null, message: '工艺名称已存在' }, { status: 400 });
    }
    return NextResponse.json({ code: 500, data: null, message: '创建失败' }, { status: 500 });
  }
}
