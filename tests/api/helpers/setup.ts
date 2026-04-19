/**
 * 测试数据库 setup/teardown 钩子
 * - 使用独立的 test.db，不污染开发数据库
 * - beforeAll: 初始化测试数据库（prisma db push）
 * - afterAll: 清理测试数据库
 * - resetDb: 每个测试开始前重置数据
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * 初始化测试数据库（schema 创建 + 基础种子数据）
 * 在 beforeAll 中调用
 */
export async function setupTestDb() {
  // Schema 应该已经在测试启动前通过 prisma db push 创建
  // 这里不做任何操作，避免在服务器运行时修改数据库文件
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
 * 使用 Prisma deleteMany 代替原始 SQL 以避免表名大小写问题
 */
export async function resetDb() {
  // 按外键依赖顺序删除，使用 Prisma ORM 方法避免表名大小写问题
  try { await prisma.operationLog.deleteMany(); } catch { /* ignore */ }
  try { await prisma.saleReturn.deleteMany(); } catch { /* ignore */ }
  try { await prisma.saleRecord.deleteMany(); } catch { /* ignore */ }
  try { await prisma.bundleSale.deleteMany(); } catch { /* ignore */ }
  try { await prisma.itemSellingPoint.deleteMany(); } catch { /* ignore */ }
  try { await prisma.itemAudience.deleteMany(); } catch { /* ignore */ }
  try { await prisma.itemTag.deleteMany(); } catch { /* ignore */ }
  try { await prisma.itemImage.deleteMany(); } catch { /* ignore */ }
  try { await prisma.itemSpec.deleteMany(); } catch { /* ignore */ }
  try { await prisma.item.deleteMany(); } catch { /* ignore */ }
  try { await prisma.session.deleteMany(); } catch { /* ignore */ }
  try { await prisma.user.deleteMany(); } catch { /* ignore */ }
  try { await prisma.batch.deleteMany(); } catch { /* ignore */ }
  try { await prisma.metalPrice.deleteMany(); } catch { /* ignore */ }
  try { await prisma.customer.deleteMany(); } catch { /* ignore */ }
  try { await prisma.supplier.deleteMany(); } catch { /* ignore */ }
  try { await prisma.dictSellingPoint.deleteMany(); } catch { /* ignore */ }
  try { await prisma.dictAudience.deleteMany(); } catch { /* ignore */ }
  try { await prisma.dictCraft.deleteMany(); } catch { /* ignore */ }
  try { await prisma.dictTag.deleteMany(); } catch { /* ignore */ }
  try { await prisma.dictType.deleteMany(); } catch { /* ignore */ }
  try { await prisma.dictMaterial.deleteMany(); } catch { /* ignore */ }
  try { await prisma.sysConfig.deleteMany(); } catch { /* ignore */ }

  // 重置 SQLite 自增序列
  try {
    await prisma.$executeRawUnsafe(
      "DELETE FROM sqlite_sequence"
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
  });

  // 器型字典
  await prisma.dictType.createMany({
    data: [
      { name: '手镯', specFields: JSON.stringify(['braceletSize']), sortOrder: 1, isActive: true },
      { name: '戒指', specFields: JSON.stringify(['ringSize']), sortOrder: 2, isActive: true },
      { name: '项链', specFields: JSON.stringify(['beadDiameter', 'beadCount']), sortOrder: 3, isActive: true },
      { name: '未分类', specFields: null, sortOrder: 99, isActive: true },
    ],
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
  });

  // 人群字典
  await prisma.dictAudience.createMany({
    data: [
      { name: '年轻女性', sortOrder: 1, isActive: true },
      { name: '中年女性', sortOrder: 2, isActive: true },
      { name: '中年男性', sortOrder: 3, isActive: true },
      { name: '资深藏家', sortOrder: 4, isActive: true },
    ],
  });

  // 标签字典
  await prisma.dictTag.createMany({
    data: [
      { name: 'VIP', groupName: '客户等级', isActive: true },
      { name: '新品', groupName: '状态', isActive: true },
    ],
  });

  // 供应商
  await prisma.supplier.createMany({
    data: [
      { name: '测试供应商A', contact: '张三', phone: '13800138000', isActive: true },
      { name: '测试供应商B', contact: '李四', phone: '13900139000', isActive: true },
    ],
  });
}

export { prisma };
