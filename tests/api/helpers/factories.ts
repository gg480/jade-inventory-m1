/**
 * 测试数据工厂函数
 * 每个工厂创建最小合法数据，返回含 ID 的完整对象
 */
import { prisma } from './setup';
import { apiPost } from './client';

let itemCounter = 0;

/**
 * 生成唯一 SKU 编码
 */
function nextSku(): string {
  itemCounter++;
  const date = new Date();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `TS${mm}${dd}-${String(itemCounter).padStart(3, '0')}`;
}

/**
 * 创建最少字段的合法 Item（仅 name）
 * 通过 API 创建，返回完整 Item 对象
 */
export async function createMinimalItem(overrides: Record<string, unknown> = {}) {
  const material = await prisma.dictMaterial.findFirst({ where: { name: '翡翠' } });
  if (!material) throw new Error('种子数据缺失：翡翠 材质');

  const sku = nextSku();
  const body = {
    name: `测试货品-${sku}`,
    skuCode: sku,
    materialId: material.id,
    sellingPrice: 0,
    status: 'in_stock',
    ...overrides,
  };

  const res = await apiPost('/api/items', body);
  if (res.code !== 0) {
    throw new Error(`createMinimalItem 失败: ${JSON.stringify(res)}`);
  }
  return res.data;
}

/**
 * 创建所有新字段都填的 Item
 */
export async function createFullItem(overrides: Record<string, unknown> = {}) {
  const material = await prisma.dictMaterial.findFirst({ where: { name: '翡翠' } });
  const type = await prisma.dictType.findFirst({ where: { name: '手镯' } });
  const craft = await prisma.dictCraft.findFirst({ where: { name: '手工雕刻' } });
  const sp = await prisma.dictSellingPoint.findFirst({ where: { name: '送礼' } });
  const aud = await prisma.dictAudience.findFirst({ where: { name: '年轻女性' } });

  if (!material) throw new Error('种子数据缺失');
  if (!type) throw new Error('种子数据缺失：手镯 器型');

  const sku = nextSku();
  const body = {
    name: `完整货品-${sku}`,
    skuCode: sku,
    materialId: material.id,
    typeId: type.id,
    costPrice: 8000,
    sellingPrice: 12000,
    status: 'in_stock',
    craftId: craft?.id ?? null,
    origin: '缅甸',
    era: '现代工',
    certNo: 'CERT-TEST-001',
    mainColor: '翠绿',
    subColor: '白底',
    priceRange: '精品',
    storyPoints: '此件翡翠手镯质地细腻，水头充足，翠色阳艳均匀，为缅甸老坑料子，工艺精湛。',
    operationNote: '2024年10月从云南瑞丽购入，原石价6000，加工费2000',
    priorityTier: 'A',
    sellingPointIds: sp ? [sp.id] : [],
    audienceIds: aud ? [aud.id] : [],
    ...overrides,
  };

  const res = await apiPost('/api/items', body);
  if (res.code !== 0) {
    throw new Error(`createFullItem 失败: ${JSON.stringify(res)}`);
  }
  return res.data;
}

/**
 * 创建材质字典
 */
export async function createMaterial(overrides: Record<string, unknown> = {}) {
  const name = `测试材质-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const body = {
    name,
    category: '其他',
    isActive: true,
    ...overrides,
  };

  const res = await apiPost('/api/dicts/materials', body);
  if (res.code !== 0) {
    throw new Error(`createMaterial 失败: ${JSON.stringify(res)}`);
  }
  return res.data;
}

/**
 * 创建器型字典
 */
export async function createType(overrides: Record<string, unknown> = {}) {
  const name = `测试器型-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const body = {
    name,
    isActive: true,
    ...overrides,
  };

  const res = await apiPost('/api/dicts/types', body);
  if (res.code !== 0) {
    throw new Error(`createType 失败: ${JSON.stringify(res)}`);
  }
  return res.data;
}

/**
 * 创建工艺字典
 */
export async function createCraft(overrides: Record<string, unknown> = {}) {
  const name = `测试工艺-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const body = {
    name,
    isActive: true,
    ...overrides,
  };

  const res = await apiPost('/api/dicts/crafts', body);
  if (res.code !== 0) {
    throw new Error(`createCraft 失败: ${JSON.stringify(res)}`);
  }
  return res.data;
}

/**
 * 创建卖点字典
 */
export async function createSellingPoint(overrides: Record<string, unknown> = {}) {
  const name = `测试卖点-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const body = {
    name,
    isActive: true,
    ...overrides,
  };

  const res = await apiPost('/api/dicts/selling-points', body);
  if (res.code !== 0) {
    throw new Error(`createSellingPoint 失败: ${JSON.stringify(res)}`);
  }
  return res.data;
}

/**
 * 创建人群字典
 */
export async function createAudience(overrides: Record<string, unknown> = {}) {
  const name = `测试人群-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const body = {
    name,
    isActive: true,
    ...overrides,
  };

  const res = await apiPost('/api/dicts/audiences', body);
  if (res.code !== 0) {
    throw new Error(`createAudience 失败: ${JSON.stringify(res)}`);
  }
  return res.data;
}

/**
 * 创建客户
 */
export async function createCustomer(overrides: Record<string, unknown> = {}) {
  const name = `测试客户-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const body = {
    name,
    phone: `138${String(Date.now()).slice(-8)}`,
    ...overrides,
  };

  const res = await apiPost('/api/customers', body);
  if (res.code !== 0) {
    throw new Error(`createCustomer 失败: ${JSON.stringify(res)}`);
  }
  return res.data;
}
