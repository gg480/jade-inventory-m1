import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { join } from 'path';

export const dynamic = 'force-dynamic';

let packageVersion = 'unknown';
try {
  const pkgPath = join(process.cwd(), 'package.json');
  const pkgContent = readFileSync(pkgPath, 'utf-8');
  packageVersion = JSON.parse(pkgContent).version || 'unknown';
} catch {
  // package.json 读取失败时使用默认值
}

const prisma = new PrismaClient();

export async function GET() {
  const startTime = Date.now();

  try {
    // 验证数据库连接：查询 Item 和 DictMaterial 数量
    const [itemCount, dictMaterialCount] = await Promise.all([
      prisma.item.count(),
      prisma.dictMaterial.count(),
    ]);

    const responseTime = Date.now() - startTime;

    return NextResponse.json({
      code: 0,
      data: {
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: packageVersion,
        db: {
          connected: true,
          itemCount,
          dictMaterialCount,
        },
        uptime: process.uptime(),
        responseTime: `${responseTime}ms`,
      },
      message: 'ok',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    return NextResponse.json(
      {
        code: 500,
        data: {
          status: 'error',
          timestamp: new Date().toISOString(),
          version: packageVersion,
          db: {
            connected: false,
            error: errorMessage,
          },
          uptime: process.uptime(),
        },
        message: 'Database connection failed',
      },
      { status: 500 }
    );
  } finally {
    // 每次请求后断开连接，避免连接池泄漏（健康检查是低频操作）
    await prisma.$disconnect();
  }
}
