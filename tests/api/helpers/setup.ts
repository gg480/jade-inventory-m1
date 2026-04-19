/**
 * 测试数据库 setup/teardown 钩子
 * - 使用独立的 test.db，不污染开发数据库
 * - beforeAll: 初始化测试数据库（prisma db push）
 * - afterAll: 清理测试数据库
 * - resetDb: 每个测试开始前重置数据
 */
import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';

const prisma = new PrismaClient();

/**
 * 初始化测试数据库（schema 创建 + 基础种子数据）
 * 在 beforeAll 中调用
 */
export async function setupTestDb() {
  // 确保 test.db schema 同步
  try {
    execSync('npx prisma db push --skip-generate', {
      env: { ...process.env, DATABASE_URL: 'file:./prisma/db/test.db' },
      stdio: 'pipe',
    });
  } catch {
    // db push 可能因为 test.db 不存在而需要创建
  }
}

/**
 * 清理测试数据库连接
 * 在 afterAll 中调用
 */
export async function teardownTestDb() {
  await prisma.$disconnect();
}

/**
 * 重置测试数据库（删除所有数据，保留 schema）
 * 在每个测试套件前调用
 */
export async function resetDb() {
  // 按外键依赖顺序删除
  const tablenames = [
    'operation_log',
    'sale_returns',
    'sale_records',
    'bundle_sales',
    'item_selling_point',
    'item_audience',
    'item_tag',
    'item_images',
    'item_spec',
    'items',
    'session',
    'users',
    'batches',
    'metal_prices',
    'customers',
    'suppliers',
    'dict_selling_point',
    'dict_audience',
    'dict_craft',
    'dict_tag',
    'dict_type',
    'dict_material',
    'sys_config',
  ];

  for (const table of tablenames) {
    try {
      await prisma.$executeRawUnsafe(`DELETE FROM "${table}"`);
    } catch {
      // 表可能为空或不存在，忽略
    }
  }

  // 重置 SQLite 自增序列
  try {
    await prisma.$executeRawUnsafe(
      "DELETE FROM sqlite_sequence WHERE name IN ('items', 'sale_records', 'batches', 'customers', 'suppliers', 'dict_material', 'dict_type', 'dict_tag', 'dict_craft', 'dict_selling_point', 'dict_audience', 'item_images', 'item_spec', 'operation_log', 'metal_prices', 'bundle_sales', 'sale_returns', 'users', 'session', 'sys_config')"
    );
  } catch {
    // 忽略
  }
}

/**
 * 种入基础字典数据（每次 resetDb 后需要重新种入）
 */
export async function seedBaseDicts() {
  // 系统配置
  await prisma.sysConfig.createMany({
    data: [
      { key: 'store_name', value: '测试店铺', description: '店铺名称' },
      { key: 'admin_password', value: 'admin123', description: '管理员密码' },
      { key: 'overstock_days', value: '90', description: '压货预警天数' },
    ],
    skipDuplicates: true,
  });

  // 材质字典
  await prisma.dictMaterial.createMany({
    data: [
      { name: '翡翠', category: '玉', sortOrder: 1, isActive: true },
      { name: '和田玉', category: '玉', sortOrder: 2, isActive: true },
      { name: '黄金', category: '贵金属', sortOrder: 3, isActive: true },
      { name: '白银', category: '贵金属', sortOrder: 4, isActive: true },
      { name: '未分类', category: '其他', sortOrder: 99, isActive: true },
    ],
    skipDuplicates: true,
  });

  // 器型字典
  await prisma.dictType.createMany({
    data: [
      { name: '手镯', specFields: JSON.stringify(['braceletSize']), sortOrder: 1, isActive: true },
      { name: '戒指', specFields: JSON.stringify(['ringSize']), sortOrder: 2, isActive: true },
      { name: '项链', specFields: JSON.stringify(['beadDiameter', 'beadCount']), sortOrder: 3, isActive: true },
      { name: '未分类', specFields: null, sortOrder: 99, isActive: true },
    ],
    skipDuplicates: true,
  });

  // 工艺字典
  await prisma.dictCraft.createMany({
    data: [
      { name: '手工雕刻', sortOrder: 1, isActive: true },
      { name: '机雕', sortOrder: 2, isActive: true },
      { name: '半手工', sortOrder: 3, isActive: true },
      { name: '素面', sortOrder: 4, isActive: true },
      { name: '未知', sortOrder: 8, isActive: true },
    ],
    skipDuplicates: true,
  });

  // 卖点字典
  await prisma.dictSellingPoint.createMany({
    data: [
      { name: '送礼', sortOrder: 1, isActive: true },
      { name: '自戴', sortOrder: 2, isActive: true },
      { name: '收藏', sortOrder: 3, isActive: true },
      { name: '投资', sortOrder: 4, isActive: true },
      { name: '孤品', sortOrder: 5, isActive: true },
    ],
    skipDuplicates: true,
  });

  // 人群字典
  await prisma.dictAudience.createMany({
    data: [
      { name: '年轻女性', sortOrder: 1, isActive: true },
      { name: '中年女性', sortOrder: 2, isActive: true },
      { name: '中年男性', sortOrder: 3, isActive: true },
      { name: '资深藏家', sortOrder: 4, isActive: true },
    ],
    skipDuplicates: true,
  });

  // 标签字典
  await prisma.dictTag.createMany({
    data: [
      { name: 'VIP', groupName: '客户等级', isActive: true },
      { name: '新品', groupName: '状态', isActive: true },
    ],
    skipDuplicates: true,
  });

  // 供应商
  await prisma.supplier.createMany({
    data: [
      { name: '测试供应商A', contact: '张三', phone: '13800138000', isActive: true },
      { name: '测试供应商B', contact: '李四', phone: '13900139000', isActive: true },
    ],
    skipDuplicates: true,
  });
}

export { prisma };
