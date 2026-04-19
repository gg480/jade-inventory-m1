/**
 * 人群字典 API 测试
 * 覆盖 GET/POST /api/dicts/audiences 和 PATCH/DELETE /api/dicts/audiences/[id]
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { apiGet, apiPost, apiPatch, apiDelete } from './helpers/client';

// 种子数据中的人群名称
const SEED_AUDIENCES = ['年轻女性', '中年女性', '中年男性', '资深藏家'];

// 用于跟踪测试创建的人群 ID
const createdAudienceIds: number[] = [];

// 用于跟踪测试创建的 Item ID
const createdItemIds: number[] = [];

/**
 * 创建一个测试人群
 */
async function createTestAudience(overrides: Record<string, unknown> = {}) {
  const name = `测试人群-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const body = {
    name,
    sortOrder: 0,
    ...overrides,
  };

  const res = await apiPost('/api/dicts/audiences', body);
  if (res.code !== 0) {
    throw new Error(`createTestAudience 失败: ${JSON.stringify(res)}`);
  }
  return res.data;
}

/**
 * 创建一个测试 Item（关联指定人群）
 */
async function createTestItemWithAudience(audienceId: number) {
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
  const sku = `TA-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  const body = {
    name: `人群测试货品-${sku}`,
    skuCode: sku,
    materialId,
    typeId,
    costPrice: 500,
    sellingPrice: 800,
    audienceIds: [audienceId],
  };

  const res = await apiPost('/api/items', body);
  if (res.code !== 0) {
    throw new Error(`createTestItemWithAudience 失败: ${JSON.stringify(res)}`);
  }
  return res.data;
}

describe('人群字典 API', () => {
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
    // 清理人群（软删除）
    for (const id of createdAudienceIds) {
      try {
        await apiPatch(`/api/dicts/audiences/${id}`, { isActive: false });
      } catch { /* ignore */ }
    }
  });

  // ─── GET /api/dicts/audiences ──────────────────────────────
  describe('GET /api/dicts/audiences', () => {
    it('返回种子数据中所有活跃人群', async () => {
      const res = await apiGet('/api/dicts/audiences');

      expect(res.code).toBe(0);
      expect(Array.isArray(res.data)).toBe(true);
      expect(res.data.length).toBeGreaterThanOrEqual(SEED_AUDIENCES.length);

      const names = res.data.map((a: any) => a.name);
      for (const seedName of SEED_AUDIENCES) {
        expect(names).toContain(seedName);
      }
    });

    it('默认不返回 isActive=false 的人群', async () => {
      const aud = await createTestAudience({ name: `待停用人群-${Date.now()}` });
      createdAudienceIds.push(aud.id);

      await apiPatch(`/api/dicts/audiences/${aud.id}`, { isActive: false });

      const res = await apiGet('/api/dicts/audiences');
      const names = res.data.map((a: any) => a.name);
      expect(names).not.toContain(aud.name);
    });

    it('include_inactive=true 返回所有人群（含停用）', async () => {
      const aud = await createTestAudience({ name: `停用查看人群-${Date.now()}` });
      createdAudienceIds.push(aud.id);

      await apiPatch(`/api/dicts/audiences/${aud.id}`, { isActive: false });

      const res = await apiGet('/api/dicts/audiences?include_inactive=true');
      expect(res.code).toBe(0);
      const names = res.data.map((a: any) => a.name);
      expect(names).toContain(aud.name);
    });

    it('返回数据结构包含必要字段', async () => {
      const res = await apiGet('/api/dicts/audiences');

      expect(res.code).toBe(0);
      const first = res.data[0];
      expect(first).toHaveProperty('id');
      expect(first).toHaveProperty('name');
      expect(first).toHaveProperty('sortOrder');
      expect(first).toHaveProperty('isActive');
    });

    it('返回结果按 sortOrder 升序排列', async () => {
      const res = await apiGet('/api/dicts/audiences');

      expect(res.code).toBe(0);
      const sortOrders = res.data.map((a: any) => a.sortOrder);
      for (let i = 1; i < sortOrders.length; i++) {
        expect(sortOrders[i]).toBeGreaterThanOrEqual(sortOrders[i - 1]);
      }
    });
  });

  // ─── POST /api/dicts/audiences ─────────────────────────────
  describe('POST /api/dicts/audiences', () => {
    it('新建人群成功，返回code=0', async () => {
      const res = await apiPost('/api/dicts/audiences', {
        name: `新建人群-${Date.now()}`,
        sortOrder: 10,
      });

      expect(res.code).toBe(0);
      expect(res.data).toHaveProperty('id');
      expect(res.data.name).toBeDefined();
      expect(res.data.sortOrder).toBe(10);
      expect(res.data.isActive).toBe(true);
      createdAudienceIds.push(res.data.id);
    });

    it('sortOrder默认为0', async () => {
      const res = await apiPost('/api/dicts/audiences', {
        name: `默认排序人群-${Date.now()}`,
      });

      expect(res.code).toBe(0);
      expect(res.data.sortOrder).toBe(0);
      createdAudienceIds.push(res.data.id);
    });

    it('重复name返回code=400', async () => {
      const existingRes = await apiGet('/api/dicts/audiences');
      const existingName = existingRes.data[0].name;

      const res = await apiPost('/api/dicts/audiences', {
        name: existingName,
      });

      expect(res.code).toBe(400);
      expect(res.message).toContain('已存在');
    });
  });

  // ─── PATCH /api/dicts/audiences/[id] ───────────────────────
  describe('PATCH /api/dicts/audiences/[id]', () => {
    it('更新人群名称成功', async () => {
      const aud = await createTestAudience();
      createdAudienceIds.push(aud.id);

      const newName = `更新人群-${Date.now()}`;
      const res = await apiPatch(`/api/dicts/audiences/${aud.id}`, {
        name: newName,
      });

      expect(res.code).toBe(0);
      expect(res.data.name).toBe(newName);
    });

    it('更新sortOrder成功', async () => {
      const aud = await createTestAudience();
      createdAudienceIds.push(aud.id);

      const res = await apiPatch(`/api/dicts/audiences/${aud.id}`, {
        sortOrder: 99,
      });

      expect(res.code).toBe(0);
      expect(res.data.sortOrder).toBe(99);
    });

    it('停用人群(isActive=false)成功', async () => {
      const aud = await createTestAudience();
      createdAudienceIds.push(aud.id);

      const res = await apiPatch(`/api/dicts/audiences/${aud.id}`, {
        isActive: false,
      });

      expect(res.code).toBe(0);
      expect(res.data.isActive).toBe(false);
    });

    it('重新启用人群(isActive=true)成功', async () => {
      const aud = await createTestAudience();
      createdAudienceIds.push(aud.id);

      // 先停用
      await apiPatch(`/api/dicts/audiences/${aud.id}`, { isActive: false });

      // 再启用
      const res = await apiPatch(`/api/dicts/audiences/${aud.id}`, {
        isActive: true,
      });

      expect(res.code).toBe(0);
      expect(res.data.isActive).toBe(true);
    });

    it('不存在的id返回失败', async () => {
      const res = await apiPatch('/api/dicts/audiences/999999', {
        name: '不存在',
      });

      expect(res.code).toBe(500);
    });
  });

  // ─── DELETE /api/dicts/audiences/[id] ──────────────────────
  describe('DELETE /api/dicts/audiences/[id]', () => {
    it('无关联Item时删除成功（软删除）', async () => {
      const aud = await createTestAudience({ name: `待删除人群-${Date.now()}` });

      const res = await apiDelete(`/api/dicts/audiences/${aud.id}`);

      expect(res.code).toBe(0);

      // 验证已软删除：默认列表不包含
      const listRes = await apiGet('/api/dicts/audiences');
      const names = listRes.data.map((a: any) => a.name);
      expect(names).not.toContain(aud.name);

      // include_inactive=true 可以看到
      const allRes = await apiGet('/api/dicts/audiences?include_inactive=true');
      const allNames = allRes.data.map((a: any) => a.name);
      expect(allNames).toContain(aud.name);
    });

    it('有关联Item时删除返回code=400', async () => {
      const aud = await createTestAudience({ name: `关联人群-${Date.now()}` });
      createdAudienceIds.push(aud.id);

      // 创建一个关联此人群的 Item
      const item = await createTestItemWithAudience(aud.id);
      createdItemIds.push(item.id);

      const res = await apiDelete(`/api/dicts/audiences/${aud.id}`);

      expect(res.code).toBe(400);
      expect(res.message).toContain('关联');
      expect(res.message).toContain('货品');
    });

    it('不存在的id返回失败', async () => {
      const res = await apiDelete('/api/dicts/audiences/999999');

      expect(res.code).toBe(500);
    });
  });
});
