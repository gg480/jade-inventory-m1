import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { logAction } from '@/lib/log';
import { PRIORITY_TIERS, SHOOTING_STATUSES, CONTENT_STATUSES } from '@/lib/constants';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { priorityTier, shootingStatus, contentStatus } = body;

  // At least one status field must be provided
  if (priorityTier === undefined && shootingStatus === undefined && contentStatus === undefined) {
    return NextResponse.json({ code: 400, data: null, message: '至少传入一个状态字段' }, { status: 400 });
  }

  // Validate against constants
  if (priorityTier !== undefined && !(PRIORITY_TIERS as readonly string[]).includes(priorityTier)) {
    return NextResponse.json({ code: 400, data: null, message: `档位只接受: ${PRIORITY_TIERS.join('/')}` }, { status: 400 });
  }
  if (shootingStatus !== undefined && !(SHOOTING_STATUSES as readonly string[]).includes(shootingStatus)) {
    return NextResponse.json({ code: 400, data: null, message: `拍摄状态只接受: ${SHOOTING_STATUSES.join('/')}` }, { status: 400 });
  }
  if (contentStatus !== undefined && !(CONTENT_STATUSES as readonly string[]).includes(contentStatus)) {
    return NextResponse.json({ code: 400, data: null, message: `内容状态只接受: ${CONTENT_STATUSES.join('/')}` }, { status: 400 });
  }

  try {
    // Get original item for timestamp logic and logging
    const original = await db.item.findUnique({ where: { id: parseInt(id) } });
    if (!original || original.isDeleted) {
      return NextResponse.json({ code: 404, data: null, message: '未找到' }, { status: 404 });
    }

    // Build update data with timestamp logic
    const updateData: Record<string, unknown> = {};
    const now = new Date();

    if (priorityTier !== undefined) {
      updateData.priorityTier = priorityTier;
    }

    if (shootingStatus !== undefined) {
      updateData.shootingStatus = shootingStatus;
      // shootingStatus changed from '未拍' to something else → set firstShotAt if empty
      if (original.shootingStatus === '未拍' && shootingStatus !== '未拍') {
        if (!original.firstShotAt) {
          updateData.firstShotAt = now;
        }
      }
      // Any shootingStatus change → update lastShotAt
      updateData.lastShotAt = now;
    }

    if (contentStatus !== undefined) {
      updateData.contentStatus = contentStatus;
      // contentStatus changed to '已发布' or '多平台发布' → set firstPublishAt if empty, update lastPublishAt
      if (contentStatus === '已发布' || contentStatus === '多平台发布') {
        if (!original.firstPublishAt) {
          updateData.firstPublishAt = now;
        }
        updateData.lastPublishAt = now;
      }
    }

    const item = await db.item.update({
      where: { id: parseInt(id) },
      data: updateData,
      include: { material: true, type: true, spec: true, tags: true },
    });

    // Write OperationLog
    const changes: Record<string, { from: unknown; to: unknown }> = {};
    if (priorityTier !== undefined && original.priorityTier !== priorityTier) {
      changes.priorityTier = { from: original.priorityTier, to: priorityTier };
    }
    if (shootingStatus !== undefined && original.shootingStatus !== shootingStatus) {
      changes.shootingStatus = { from: original.shootingStatus, to: shootingStatus };
    }
    if (contentStatus !== undefined && original.contentStatus !== contentStatus) {
      changes.contentStatus = { from: original.contentStatus, to: contentStatus };
    }
    if (Object.keys(changes).length > 0) {
      await logAction('update_status', 'item', item.id, changes);
    }

    return NextResponse.json({ code: 0, data: item, message: 'ok' });
  } catch (e: any) {
    return NextResponse.json({ code: 500, data: null, message: `更新状态失败: ${e.message}` }, { status: 500 });
  }
}
