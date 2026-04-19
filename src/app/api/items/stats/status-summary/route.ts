import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { PRIORITY_TIERS, SHOOTING_STATUSES, CONTENT_STATUSES } from '@/lib/constants';

export async function GET() {
  try {
    const total = await db.item.count({ where: { isDeleted: false } });

    // Count by priorityTier
    const byPriorityRaw = await db.item.groupBy({
      by: ['priorityTier'],
      where: { isDeleted: false },
      _count: { id: true },
    });
    const byPriority: Record<string, number> = {};
    for (const tier of PRIORITY_TIERS) {
      byPriority[tier] = 0;
    }
    for (const row of byPriorityRaw) {
      const key = row.priorityTier || '未定';
      if (key in byPriority) {
        byPriority[key] = row._count.id;
      } else {
        // Aggregate any unexpected values into a fallback
        byPriority['未定'] = (byPriority['未定'] || 0) + row._count.id;
      }
    }

    // Count by shootingStatus
    const byShootingRaw = await db.item.groupBy({
      by: ['shootingStatus'],
      where: { isDeleted: false },
      _count: { id: true },
    });
    const byShooting: Record<string, number> = {};
    for (const status of SHOOTING_STATUSES) {
      byShooting[status] = 0;
    }
    for (const row of byShootingRaw) {
      const key = row.shootingStatus || '未拍';
      if (key in byShooting) {
        byShooting[key] = row._count.id;
      } else {
        byShooting['未拍'] = (byShooting['未拍'] || 0) + row._count.id;
      }
    }

    // Count by contentStatus
    const byContentRaw = await db.item.groupBy({
      by: ['contentStatus'],
      where: { isDeleted: false },
      _count: { id: true },
    });
    const byContent: Record<string, number> = {};
    for (const status of CONTENT_STATUSES) {
      byContent[status] = 0;
    }
    for (const row of byContentRaw) {
      const key = row.contentStatus || '未生产';
      if (key in byContent) {
        byContent[key] = row._count.id;
      } else {
        byContent['未生产'] = (byContent['未生产'] || 0) + row._count.id;
      }
    }

    return NextResponse.json({
      code: 0,
      data: {
        byPriority,
        byShooting,
        byContent,
        total,
      },
      message: 'ok',
    });
  } catch (e: any) {
    return NextResponse.json({ code: 500, data: null, message: `查询失败: ${e.message}` }, { status: 500 });
  }
}
