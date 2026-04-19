/**
 * 工艺字典 API 测试
 * 覆盖 GET/POST /api/dicts/crafts 和 PATCH/DELETE /api/dicts/crafts/[id]
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { apiGet, apiPost, apiPatch, apiDelete } from './helpers/client';

// 种子数据中的工艺名称
const SEED_CRAFTS = ['手工雕刻', '机雕', '半手工', '素面', '未知'];

// 用于跟踪测试创建的工艺 ID，结束后清理
const createdCraftIds: number[] = [];

// 用于跟踪测试创建的 Item ID，结束后清理
const createdItemIds: number[] = [];

/**
 * 创建一个测试工艺
 */
async function createTestCraft(overrides: Record<string, unknown> = {}) {
  const name = `测试工艺-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const body = {
    name,
    sortOrder: 0,
    ...overrides,
  };

  const res = await apiPost('/api/dicts/crafts', body);
  if (res.code !== 0) {
    throw new Error(`createTestCraft 失败: ${JSON.stringify(res)}`);
  }
  return res.data;
}

/**
 * 创建一个测试 Item（用于关联测试）
 */
async function createTestItem(craftId: number) {
  // 获取第一个可用材质和器型
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
  const sku = `TC-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  const body = {
    name: `工艺测试货品-${sku}`,
    skuCode: sku,
    materialId,
    typeId,
    costPrice: 500,
    sellingPrice: 800,
    craftId,
  };

  const res = await apiPost('/api/items', body);
  if (res.code !== 0) {
    throw new Error(`createTestItem 失败: ${JSON.stringify(res)}`);
  }
  return res.data;
}

describe('工艺字典 API', () => {
  beforeAll(async () => {
    // 验证 API 可用（带重试）
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
    // 清理：删除测试创建的 Items
    for (const id of createdItemIds) {
      try {
        await apiDelete(`/api/items/${id}`);
      } catch { /* ignore */ }
    }
    // 清理：软删除测试创建的工艺（先更新为 isActive=false）
    for (const id of createdCraftIds) {
      try {
        await apiPatch(`/api/dicts/crafts/${id}`, { isActive: false });
      } catch { /* ignore */ }
    }
  });

  // ─── GET /api/dicts/crafts ─────────────────────────────────
  describe('GET /api/dicts/crafts', () => {
    it('返回种子数据中所有活跃工艺', async () => {
      const res = await apiGet('/api/dicts/crafts');

      expect(res.code).toBe(0);
      expect(Array.isArray(res.data)).toBe(true);
      // 种子数据至少有 SEED_CRAFTS 中的工艺
      expect(res.data.length).toBeGreaterThanOrEqual(SEED_CRAFTS.length);

      // 验证种子工艺名称存在
      const names = res.data.map((c: any) => c.name);
      for (const seedName of SEED_CRAFTS) {
        expect(names).toContain(seedName);
      }
    });

    it('默认不返回 isActive=false 的工艺', async () => {
      // 创建一个工艺，然后停用
      const craft = await createTestCraft({ name: `待停用工艺-${Date.now()}` });
      createdCraftIds.push(craft.id);

      // 停用
      await apiPatch(`/api/dicts/crafts/${craft.id}`, { isActive: false });

      // 默认 GET 不包含停用的
      const res = await apiGet('/api/dicts/crafts');
      const names = res.data.map((c: any) => c.name);
      expect(names).not.toContain(craft.name);
    });

    it('include_inactive=true 返回所有工艺（含停用）', async () => {
      const craft = await createTestCraft({ name: `停用查看工艺-${Date.now()}` });
      createdCraftIds.push(craft.id);

      // 停用
      await apiPatch(`/api/dicts/crafts/${craft.id}`, { isActive: false });

      // 带 include_inactive 参数
      const res = await apiGet('/api/dicts/crafts?include_inactive=true');
      expect(res.code).toBe(0);
      const names = res.data.map((c: any) => c.name);
      expect(names).toContain(craft.name);
    });

    it('返回数据结构包含必要字段', async () => {
      const res = await apiGet('/api/dicts/crafts');

      expect(res.code).toBe(0);
      const first = res.data[0];
      expect(first).toHaveProperty('id');
      expect(first).toHaveProperty('name');
      expect(first).toHaveProperty('sortOrder');
      expect(first).toHaveProperty('isActive');
    });

    it('返回结果按 sortOrder 升序排列', async () => {
      const res = await apiGet('/api/dicts/crafts');

      expect(res.code).toBe(0);
      const sortOrders = res.data.map((c: any) => c.sortOrder);
      for (let i = 1; i < sortOrders.length; i++) {
        expect(sortOrders[i]).toBeGreaterThanOrEqual(sortOrders[i - 1]);
      }
    });
  });

  // ─── POST /api/dicts/crafts ────────────────────────────────
  describe('POST /api/dicts/crafts', () => {
    it('新建工艺成功，返回code=0', async () => {
      const res = await apiPost('/api/dicts/crafts', {
        name: `新建工艺-${Date.now()}`,
        sortOrder: 10,
      });

      expect(res.code).toBe(0);
      expect(res.data).toHaveProperty('id');
      expect(res.data.name).toBeDefined();
      expect(res.data.sortOrder).toBe(10);
      expect(res.data.isActive).toBe(true);
      createdCraftIds.push(res.data.id);
    });

    it('新建工艺包含description字段', async () => {
      const res = await apiPost('/api/dicts/crafts', {
        name: `带描述工艺-${Date.now()}`,
        description: '手工精细雕刻工艺',
        sortOrder: 20,
      });

      expect(res.code).toBe(0);
      expect(res.data.description).toBe('手工精细雕刻工艺');
      createdCraftIds.push(res.data.id);
    });

    it('sortOrder默认为0', async () => {
      const res = await apiPost('/api/dicts/crafts', {
        name: `默认排序工艺-${Date.now()}`,
      });

      expect(res.code).toBe(0);
      expect(res.data.sortOrder).toBe(0);
      createdCraftIds.push(res.data.id);
    });

    it('重复name返回code=400', async () => {
      // 先获取一个已存在的工艺名
      const existingRes = await apiGet('/api/dicts/crafts');
      const existingName = existingRes.data[0].name;

      const res = await apiPost('/api/dicts/crafts', {
        name: existingName,
      });

      expect(res.code).toBe(400);
      expect(res.message).toContain('已存在');
    });
  });

  // ─── PATCH /api/dicts/crafts/[id] ──────────────────────────
  describe('PATCH /api/dicts/crafts/[id]', () => {
    it('更新工艺名称成功', async () => {
      const craft = await createTestCraft();
      createdCraftIds.push(craft.id);

      const newName = `更新工艺-${Date.now()}`;
      const res = await apiPatch(`/api/dicts/crafts/${craft.id}`, {
        name: newName,
      });

      expect(res.code).toBe(0);
      expect(res.data.name).toBe(newName);
    });

    it('更新工艺description成功', async () => {
      const craft = await createTestCraft();
      createdCraftIds.push(craft.id);

      const res = await apiPatch(`/api/dicts/crafts/${craft.id}`, {
        description: '更新后的描述',
      });

      expect(res.code).toBe(0);
      expect(res.data.description).toBe('更新后的描述');
    });

    it('更新sortOrder成功', async () => {
      const craft = await createTestCraft();
      createdCraftIds.push(craft.id);

      const res = await apiPatch(`/api/dicts/crafts/${craft.id}`, {
        sortOrder: 99,
      });

      expect(res.code).toBe(0);
      expect(res.data.sortOrder).toBe(99);
    });

    it('停用工艺(isActive=false)成功', async () => {
      const craft = await createTestCraft();
      createdCraftIds.push(craft.id);

      const res = await apiPatch(`/api/dicts/crafts/${craft.id}`, {
        isActive: false,
      });

      expect(res.code).toBe(0);
      expect(res.data.isActive).toBe(false);
    });

    it('重新启用工艺(isActive=true)成功', async () => {
      const craft = await createTestCraft();
      createdCraftIds.push(craft.id);

      // 先停用
      await apiPatch(`/api/dicts/crafts/${craft.id}`, { isActive: false });

      // 再启用
      const res = await apiPatch(`/api/dicts/crafts/${craft.id}`, {
        isActive: true,
      });

      expect(res.code).toBe(0);
      expect(res.data.isActive).toBe(true);
    });

    it('不存在的id返回失败', async () => {
      const res = await apiPatch('/api/dicts/crafts/999999', {
        name: '不存在',
      });

      expect(res.code).toBe(500);
    });
  });

  // ─── DELETE /api/dicts/crafts/[id] ─────────────────────────
  describe('DELETE /api/dicts/crafts/[id]', () => {
    it('无关联Item时删除成功（软删除）', async () => {
      const craft = await createTestCraft({ name: `待删除工艺-${Date.now()}` });
      // 不加入 createdCraftIds，因为下面会删除

      const res = await apiDelete(`/api/dicts/crafts/${craft.id}`);

      expect(res.code).toBe(0);

      // 验证已软删除：默认列表不包含
      const listRes = await apiGet('/api/dicts/crafts');
      const names = listRes.data.map((c: any) => c.name);
      expect(names).not.toContain(craft.name);

      // 但 include_inactive=true 可以看到
      const allRes = await apiGet('/api/dicts/crafts?include_inactive=true');
      const allNames = allRes.data.map((c: any) => c.name);
      expect(allNames).toContain(craft.name);
    });

    it('有关联Item时删除返回code=400', async () => {
      const craft = await createTestCraft({ name: `关联工艺-${Date.now()}` });
      createdCraftIds.push(craft.id);

      // 创建一个关联此工艺的 Item
      const item = await createTestItem(craft.id);
      createdItemIds.push(item.id);

      const res = await apiDelete(`/api/dicts/crafts/${craft.id}`);

      expect(res.code).toBe(400);
      expect(res.message).toContain('关联');
      expect(res.message).toContain('货品');
    });

    it('不存在的id返回失败', async () => {
      const res = await apiDelete('/api/dicts/crafts/999999');

      expect(res.code).toBe(500);
    });
  });
});
