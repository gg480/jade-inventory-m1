/**
 * 卖点字典 API 测试
 * 覆盖 GET/POST /api/dicts/selling-points 和 PATCH/DELETE /api/dicts/selling-points/[id]
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { apiGet, apiPost, apiPatch, apiDelete } from './helpers/client';

// 种子数据中的卖点名称
const SEED_SELLING_POINTS = ['送礼', '自戴', '收藏', '投资', '孤品'];

// 用于跟踪测试创建的卖点 ID
const createdSellingPointIds: number[] = [];

// 用于跟踪测试创建的 Item ID
const createdItemIds: number[] = [];

/**
 * 创建一个测试卖点
 */
async function createTestSellingPoint(overrides: Record<string, unknown> = {}) {
  const name = `测试卖点-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const body = {
    name,
    sortOrder: 0,
    ...overrides,
  };

  const res = await apiPost('/api/dicts/selling-points', body);
  if (res.code !== 0) {
    throw new Error(`createTestSellingPoint 失败: ${JSON.stringify(res)}`);
  }
  return res.data;
}

/**
 * 创建一个测试 Item（关联指定卖点）
 */
async function createTestItemWithSellingPoint(sellingPointId: number) {
  const materialsRes = await apiGet('/api/dicts/materials');
  const typesRes = await apiGet('/api/dicts/types');

  if (materialsRes.code !== 0 || !materialsRes.data.length) {
    throw new Error('无法获取材质字典');
  }
  if (typesRes.code !== 0 || !typesRes.data.length) {
    throw new Error('无法获取器型字典');
  }

  const materialId = materialsRes.data[0].id;
  const typeId = typesRes.data[0].id;
  const sku = `TSP-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  const body = {
    name: `卖点测试货品-${sku}`,
    skuCode: sku,
    materialId,
    typeId,
    costPrice: 500,
    sellingPrice: 800,
    sellingPointIds: [sellingPointId],
  };

  const res = await apiPost('/api/items', body);
  if (res.code !== 0) {
    throw new Error(`createTestItemWithSellingPoint 失败: ${JSON.stringify(res)}`);
  }
  return res.data;
}

describe('卖点字典 API', () => {
  beforeAll(async () => {
    let ok = false;
    for (let i = 0; i < 3; i++) {
      try {
        const res = await apiGet('/api/health');
        if (res.code === 0) { ok = true; break; }
      } catch { /* retry */ }
      await new Promise(r => setTimeout(r, 500));
    }
    if (!ok) throw new Error('API server not available after retries');
  });

  afterAll(async () => {
    // 清理 Items
    for (const id of createdItemIds) {
      try {
        await apiDelete(`/api/items/${id}`);
      } catch { /* ignore */ }
    }
    // 清理卖点（软删除）
    for (const id of createdSellingPointIds) {
      try {
        await apiPatch(`/api/dicts/selling-points/${id}`, { isActive: false });
      } catch { /* ignore */ }
    }
  });

  // ─── GET /api/dicts/selling-points ─────────────────────────
  describe('GET /api/dicts/selling-points', () => {
    it('返回种子数据中所有活跃卖点', async () => {
      const res = await apiGet('/api/dicts/selling-points');

      expect(res.code).toBe(0);
      expect(Array.isArray(res.data)).toBe(true);
      expect(res.data.length).toBeGreaterThanOrEqual(SEED_SELLING_POINTS.length);

      const names = res.data.map((sp: any) => sp.name);
      for (const seedName of SEED_SELLING_POINTS) {
        expect(names).toContain(seedName);
      }
    });

    it('默认不返回 isActive=false 的卖点', async () => {
      const sp = await createTestSellingPoint({ name: `待停用卖点-${Date.now()}` });
      createdSellingPointIds.push(sp.id);

      await apiPatch(`/api/dicts/selling-points/${sp.id}`, { isActive: false });

      const res = await apiGet('/api/dicts/selling-points');
      const names = res.data.map((s: any) => s.name);
      expect(names).not.toContain(sp.name);
    });

    it('include_inactive=true 返回所有卖点（含停用）', async () => {
      const sp = await createTestSellingPoint({ name: `停用查看卖点-${Date.now()}` });
      createdSellingPointIds.push(sp.id);

      await apiPatch(`/api/dicts/selling-points/${sp.id}`, { isActive: false });

      const res = await apiGet('/api/dicts/selling-points?include_inactive=true');
      expect(res.code).toBe(0);
      const names = res.data.map((s: any) => s.name);
      expect(names).toContain(sp.name);
    });

    it('返回数据结构包含必要字段', async () => {
      const res = await apiGet('/api/dicts/selling-points');

      expect(res.code).toBe(0);
      const first = res.data[0];
      expect(first).toHaveProperty('id');
      expect(first).toHaveProperty('name');
      expect(first).toHaveProperty('sortOrder');
      expect(first).toHaveProperty('isActive');
    });

    it('返回结果按 sortOrder 升序排列', async () => {
      const res = await apiGet('/api/dicts/selling-points');

      expect(res.code).toBe(0);
      const sortOrders = res.data.map((sp: any) => sp.sortOrder);
      for (let i = 1; i < sortOrders.length; i++) {
        expect(sortOrders[i]).toBeGreaterThanOrEqual(sortOrders[i - 1]);
      }
    });
  });

  // ─── POST /api/dicts/selling-points ────────────────────────
  describe('POST /api/dicts/selling-points', () => {
    it('新建卖点成功，返回code=0', async () => {
      const res = await apiPost('/api/dicts/selling-points', {
        name: `新建卖点-${Date.now()}`,
        sortOrder: 10,
      });

      expect(res.code).toBe(0);
      expect(res.data).toHaveProperty('id');
      expect(res.data.name).toBeDefined();
      expect(res.data.sortOrder).toBe(10);
      expect(res.data.isActive).toBe(true);
      createdSellingPointIds.push(res.data.id);
    });

    it('sortOrder默认为0', async () => {
      const res = await apiPost('/api/dicts/selling-points', {
        name: `默认排序卖点-${Date.now()}`,
      });

      expect(res.code).toBe(0);
      expect(res.data.sortOrder).toBe(0);
      createdSellingPointIds.push(res.data.id);
    });

    it('重复name返回code=400', async () => {
      const existingRes = await apiGet('/api/dicts/selling-points');
      const existingName = existingRes.data[0].name;

      const res = await apiPost('/api/dicts/selling-points', {
        name: existingName,
      });

      expect(res.code).toBe(400);
      expect(res.message).toContain('已存在');
    });
  });

  // ─── PATCH /api/dicts/selling-points/[id] ──────────────────
  describe('PATCH /api/dicts/selling-points/[id]', () => {
    it('更新卖点名称成功', async () => {
      const sp = await createTestSellingPoint();
      createdSellingPointIds.push(sp.id);

      const newName = `更新卖点-${Date.now()}`;
      const res = await apiPatch(`/api/dicts/selling-points/${sp.id}`, {
        name: newName,
      });

      expect(res.code).toBe(0);
      expect(res.data.name).toBe(newName);
    });

    it('更新sortOrder成功', async () => {
      const sp = await createTestSellingPoint();
      createdSellingPointIds.push(sp.id);

      const res = await apiPatch(`/api/dicts/selling-points/${sp.id}`, {
        sortOrder: 99,
      });

      expect(res.code).toBe(0);
      expect(res.data.sortOrder).toBe(99);
    });

    it('停用卖点(isActive=false)成功', async () => {
      const sp = await createTestSellingPoint();
      createdSellingPointIds.push(sp.id);

      const res = await apiPatch(`/api/dicts/selling-points/${sp.id}`, {
        isActive: false,
      });

      expect(res.code).toBe(0);
      expect(res.data.isActive).toBe(false);
    });

    it('重新启用卖点(isActive=true)成功', async () => {
      const sp = await createTestSellingPoint();
      createdSellingPointIds.push(sp.id);

      // 先停用
      await apiPatch(`/api/dicts/selling-points/${sp.id}`, { isActive: false });

      // 再启用
      const res = await apiPatch(`/api/dicts/selling-points/${sp.id}`, {
        isActive: true,
      });

      expect(res.code).toBe(0);
      expect(res.data.isActive).toBe(true);
    });

    it('不存在的id返回失败', async () => {
      const res = await apiPatch('/api/dicts/selling-points/999999', {
        name: '不存在',
      });

      expect(res.code).toBe(500);
    });
  });

  // ─── DELETE /api/dicts/selling-points/[id] ─────────────────
  describe('DELETE /api/dicts/selling-points/[id]', () => {
    it('无关联Item时删除成功（软删除）', async () => {
      const sp = await createTestSellingPoint({ name: `待删除卖点-${Date.now()}` });

      const res = await apiDelete(`/api/dicts/selling-points/${sp.id}`);

      expect(res.code).toBe(0);

      // 验证已软删除：默认列表不包含
      const listRes = await apiGet('/api/dicts/selling-points');
      const names = listRes.data.map((s: any) => s.name);
      expect(names).not.toContain(sp.name);

      // include_inactive=true 可以看到
      const allRes = await apiGet('/api/dicts/selling-points?include_inactive=true');
      const allNames = allRes.data.map((s: any) => s.name);
      expect(allNames).toContain(sp.name);
    });

    it('有关联Item时删除返回code=400', async () => {
      const sp = await createTestSellingPoint({ name: `关联卖点-${Date.now()}` });
      createdSellingPointIds.push(sp.id);

      // 创建一个关联此卖点的 Item
      const item = await createTestItemWithSellingPoint(sp.id);
      createdItemIds.push(item.id);

      const res = await apiDelete(`/api/dicts/selling-points/${sp.id}`);

      expect(res.code).toBe(400);
      expect(res.message).toContain('关联');
      expect(res.message).toContain('货品');
    });

    it('不存在的id返回失败', async () => {
      const res = await apiDelete('/api/dicts/selling-points/999999');

      expect(res.code).toBe(500);
    });
  });
});
