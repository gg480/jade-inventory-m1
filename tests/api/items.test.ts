/**
 * Items API 测试
 * 覆盖 POST /api/items, PUT /api/items/[id], GET /api/items/[id], PATCH /api/items/[id]/status
 *
 * 注意：测试使用 custom.db（与 dev server 共享），通过 API 交互，不直接操作数据库。
 * 每个测试创建独立数据，通过唯一 SKU 区分，测试结束后做软删除清理。
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { apiGet, apiPost, apiPut, apiPatch, apiDelete } from './helpers/client';

// ─── 从 custom.db 获取的字典 ID ─────────────────────────
// 这些 ID 对应 custom.db 中的字典数据
const DICT = {
  materialId: 6,   // 翡翠
  typeId: 1,       // 手镯
  craftId: 1,      // 手工雕刻
  sellingPointId: 1, // 送礼
  sellingPointId2: 3, // 收藏
  audienceId: 1,    // 年轻女性
  audienceId2: 4,   // 资深藏家
} as const;

let skuCounter = Math.floor(Math.random() * 10000);

function nextSku(): string {
  skuCounter++;
  const ts = Date.now().toString(36);
  const rnd = Math.random().toString(36).slice(2, 5);
  return `IT-${ts}-${rnd}${String(skuCounter).padStart(3, '0')}`;
}

/**
 * 通过 API 创建一个基础 Item（含所有必需字段），返回完整对象
 */
async function createTestItem(overrides: Record<string, unknown> = {}) {
  const sku = nextSku();
  const body = {
    name: `测试货品-${sku}`,
    skuCode: sku,
    materialId: DICT.materialId,
    typeId: DICT.typeId,
    costPrice: 500,
    sellingPrice: 800,
    status: 'in_stock',
    ...overrides,
  };

  const res = await apiPost('/api/items', body);
  if (res.code !== 0) {
    throw new Error(`createTestItem 失败: ${JSON.stringify(res)}`);
  }
  return res.data;
}

describe('Items API', () => {
  // 用于跟踪测试创建的 items，结束后清理
  const createdItemIds: number[] = [];

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
    // 清理：软删除测试创建的 items
    for (const id of createdItemIds) {
      try {
        await apiDelete(`/api/items/${id}`);
      } catch {
        // 忽略清理失败
      }
    }
  });

  // ─── POST /api/items ──────────────────────────────────────
  describe('POST /api/items', () => {
    it('最少字段(name+materialId+typeId+costPrice)创建成功，返回code=0', async () => {
      const res = await apiPost('/api/items', {
        name: '测试最少字段',
        materialId: DICT.materialId,
        typeId: DICT.typeId,
        costPrice: 500,
        sellingPrice: 800,
      });

      expect(res.code).toBe(0);
      expect(res.data.name).toBe('测试最少字段');
      expect(res.data.id).toBeDefined();
      expect(res.data.skuCode).toBeDefined();
      if (res.data.id) createdItemIds.push(res.data.id);
    });

    it('包含所有新字段(priceRange, storyPoints, craftId等)创建成功', async () => {
      const res = await apiPost('/api/items', {
        name: '全字段货品',
        materialId: DICT.materialId,
        typeId: DICT.typeId,
        costPrice: 8000,
        sellingPrice: 12000,
        craftId: DICT.craftId,
        priceRange: '精品',
        storyPoints: '质地细腻，水头充足',
        mainColor: '翠绿',
        subColor: '白底',
        era: '现代工',
        certNo: 'CERT-001',
        operationNote: '经营笔记内容',
        sellingPointIds: [DICT.sellingPointId],
        audienceIds: [DICT.audienceId],
      });

      expect(res.code).toBe(0);
      expect(res.data.priceRange).toBe('精品');
      expect(res.data.storyPoints).toBe('质地细腻，水头充足');
      expect(res.data.craftId).toBe(DICT.craftId);
      expect(res.data.mainColor).toBe('翠绿');
      expect(res.data.subColor).toBe('白底');
      expect(res.data.era).toBe('现代工');
      expect(res.data.certNo).toBe('CERT-001');
      expect(res.data.operationNote).toBe('经营笔记内容');
      // 验证关联数据
      expect(res.data.sellingPoints).toHaveLength(1);
      expect(res.data.audiences).toHaveLength(1);
      if (res.data.id) createdItemIds.push(res.data.id);
    });

    it('priceRange=非法值 返回code=400', async () => {
      const res = await apiPost('/api/items', {
        name: '非法价格带',
        materialId: DICT.materialId,
        typeId: DICT.typeId,
        costPrice: 500,
        priceRange: '非法值',
      });

      expect(res.code).toBe(400);
      expect(res.message).toContain('价格带');
    });

    it('缺失materialId返回code=400', async () => {
      const res = await apiPost('/api/items', {
        name: '无材质',
        typeId: DICT.typeId,
        costPrice: 500,
      });

      expect(res.code).toBe(400);
    });

    it('缺失typeId返回code=400', async () => {
      const res = await apiPost('/api/items', {
        name: '无器型',
        materialId: DICT.materialId,
        costPrice: 500,
      });

      expect(res.code).toBe(400);
    });

    it('storyPoints超过5000字符返回code=400', async () => {
      const longText = 'A'.repeat(5001);
      const res = await apiPost('/api/items', {
        name: '超长故事点',
        materialId: DICT.materialId,
        typeId: DICT.typeId,
        costPrice: 500,
        storyPoints: longText,
      });

      expect(res.code).toBe(400);
      expect(res.message).toContain('5000');
    });

    it('传入priorityTier=A创建成功', async () => {
      const res = await apiPost('/api/items', {
        name: '高货',
        materialId: DICT.materialId,
        typeId: DICT.typeId,
        costPrice: 5000,
        sellingPrice: 8000,
        priorityTier: 'A',
      });

      expect(res.code).toBe(0);
      expect(res.data.priorityTier).toBe('A');
      if (res.data.id) createdItemIds.push(res.data.id);
    });

    it('传入priorityTier=B创建成功', async () => {
      const res = await apiPost('/api/items', {
        name: '中档货',
        materialId: DICT.materialId,
        typeId: DICT.typeId,
        costPrice: 1000,
        sellingPrice: 2000,
        priorityTier: 'B',
      });

      expect(res.code).toBe(0);
      expect(res.data.priorityTier).toBe('B');
      if (res.data.id) createdItemIds.push(res.data.id);
    });

    it('传入priorityTier=C创建成功', async () => {
      const res = await apiPost('/api/items', {
        name: '走量货',
        materialId: DICT.materialId,
        typeId: DICT.typeId,
        costPrice: 300,
        sellingPrice: 500,
        priorityTier: 'C',
      });

      expect(res.code).toBe(0);
      expect(res.data.priorityTier).toBe('C');
      if (res.data.id) createdItemIds.push(res.data.id);
    });

    it('不传priorityTier时默认为"未定"', async () => {
      const item = await createTestItem();
      expect(item.priorityTier).toBe('未定');
    });
  });

  // ─── PUT /api/items/[id] ──────────────────────────────────
  describe('PUT /api/items/[id]', () => {
    it('更新storyPoints成功', async () => {
      const item = await createTestItem();
      const newStory = '更新后的故事点内容，描述翡翠特点';

      const res = await apiPut(`/api/items/${item.id}`, {
        storyPoints: newStory,
      });

      expect(res.code).toBe(0);
      expect(res.data.storyPoints).toBe(newStory);
    });

    it('更新sellingPointIds(数组)成功，关联表正确更新', async () => {
      const item = await createTestItem();

      const res = await apiPut(`/api/items/${item.id}`, {
        sellingPointIds: [DICT.sellingPointId, DICT.sellingPointId2],
      });

      expect(res.code).toBe(0);
      expect(res.data.sellingPoints).toHaveLength(2);

      // 通过 GET 验证关联确实存在
      const getRes = await apiGet(`/api/items/${item.id}`);
      expect(getRes.code).toBe(0);
      expect(getRes.data.sellingPoints).toHaveLength(2);
    });

    it('更新audienceIds成功，关联表正确更新', async () => {
      const item = await createTestItem();

      const res = await apiPut(`/api/items/${item.id}`, {
        audienceIds: [DICT.audienceId, DICT.audienceId2],
      });

      expect(res.code).toBe(0);
      expect(res.data.audiences).toHaveLength(2);

      // 通过 GET 验证
      const getRes = await apiGet(`/api/items/${item.id}`);
      expect(getRes.code).toBe(0);
      expect(getRes.data.audiences).toHaveLength(2);
    });

    it('部分更新(只传一个字段)不影响其他字段', async () => {
      const item = await createTestItem({
        costPrice: 8000,
        sellingPrice: 12000,
        mainColor: '翠绿',
      });
      const originalName = item.name;
      const originalCostPrice = item.costPrice;

      const res = await apiPut(`/api/items/${item.id}`, {
        mainColor: '阳绿',
      });

      expect(res.code).toBe(0);
      expect(res.data.mainColor).toBe('阳绿');
      // 其他字段保持不变
      expect(res.data.name).toBe(originalName);
      expect(res.data.costPrice).toBe(originalCostPrice);
    });

    it('更新sellingPointIds为空数组时，清空所有卖点关联', async () => {
      const item = await createTestItem({
        sellingPointIds: [DICT.sellingPointId],
      });
      // 先验证有卖点
      expect(item.sellingPoints.length).toBeGreaterThan(0);

      const res = await apiPut(`/api/items/${item.id}`, {
        sellingPointIds: [],
      });

      expect(res.code).toBe(0);
      expect(res.data.sellingPoints).toHaveLength(0);
    });

    it('更新priceRange为非法值返回code=400', async () => {
      const item = await createTestItem();

      const res = await apiPut(`/api/items/${item.id}`, {
        priceRange: '非法价格带',
      });

      expect(res.code).toBe(400);
    });
  });

  // ─── GET /api/items/[id] ──────────────────────────────────
  describe('GET /api/items/[id]', () => {
    it('返回结构包含新字段(即使null)', async () => {
      const item = await createTestItem();
      const res = await apiGet(`/api/items/${item.id}`);

      expect(res.code).toBe(0);
      // 验证新字段存在（可能为null）
      expect(res.data).toHaveProperty('priceRange');
      expect(res.data).toHaveProperty('storyPoints');
      expect(res.data).toHaveProperty('craftId');
      expect(res.data).toHaveProperty('era');
      expect(res.data).toHaveProperty('mainColor');
      expect(res.data).toHaveProperty('subColor');
      expect(res.data).toHaveProperty('priorityTier');
      expect(res.data).toHaveProperty('shootingStatus');
      expect(res.data).toHaveProperty('contentStatus');
      expect(res.data).toHaveProperty('firstShotAt');
      expect(res.data).toHaveProperty('firstPublishAt');
    });

    it('返回结构包含sellingPoints/audiences关联对象', async () => {
      const item = await createTestItem({
        sellingPointIds: [DICT.sellingPointId],
        audienceIds: [DICT.audienceId],
      });
      const res = await apiGet(`/api/items/${item.id}`);

      expect(res.code).toBe(0);
      // 验证 sellingPoints 关联对象
      expect(res.data.sellingPoints).toBeDefined();
      expect(Array.isArray(res.data.sellingPoints)).toBe(true);
      expect(res.data.sellingPoints.length).toBeGreaterThan(0);
      // sellingPoints 格式: [{id, name}]
      expect(res.data.sellingPoints[0]).toHaveProperty('id');
      expect(res.data.sellingPoints[0]).toHaveProperty('name');

      // audiences 关联对象
      expect(res.data.audiences).toBeDefined();
      expect(Array.isArray(res.data.audiences)).toBe(true);
      expect(res.data.audiences.length).toBeGreaterThan(0);

      // material 关联
      expect(res.data.material).toBeDefined();
      expect(res.data.material.name).toBeDefined();
    });

    it('不存在的id返回code=404', async () => {
      const res = await apiGet('/api/items/999999');
      expect(res.code).toBe(404);
    });
  });

  // ─── PATCH /api/items/[id]/status ─────────────────────────
  describe('PATCH /api/items/[id]/status', () => {
    it('改priorityTier=A成功', async () => {
      const item = await createTestItem();
      expect(item.priorityTier).toBe('未定');

      const res = await apiPatch(`/api/items/${item.id}/status`, {
        priorityTier: 'A',
      });

      expect(res.code).toBe(0);
      expect(res.data.priorityTier).toBe('A');
    });

    it('改shootingStatus从"未拍"到"白底完成"，firstShotAt自动填入', async () => {
      const item = await createTestItem();
      expect(item.shootingStatus).toBe('未拍');
      expect(item.firstShotAt).toBeNull();

      const res = await apiPatch(`/api/items/${item.id}/status`, {
        shootingStatus: '白底完成',
      });

      expect(res.code).toBe(0);
      expect(res.data.shootingStatus).toBe('白底完成');
      expect(res.data.firstShotAt).not.toBeNull();
      // 验证 firstShotAt 是近期的时间
      const shotAt = new Date(res.data.firstShotAt);
      expect(shotAt.getTime()).toBeGreaterThan(Date.now() - 60000);
    });

    it('改contentStatus到"已发布"，firstPublishAt自动填入', async () => {
      const item = await createTestItem();
      expect(item.contentStatus).toBe('未生产');
      expect(item.firstPublishAt).toBeNull();

      const res = await apiPatch(`/api/items/${item.id}/status`, {
        contentStatus: '已发布',
      });

      expect(res.code).toBe(0);
      expect(res.data.contentStatus).toBe('已发布');
      expect(res.data.firstPublishAt).not.toBeNull();
      const publishAt = new Date(res.data.firstPublishAt);
      expect(publishAt.getTime()).toBeGreaterThan(Date.now() - 60000);
    });

    it('改contentStatus到"多平台发布"，firstPublishAt也自动填入', async () => {
      const item = await createTestItem();

      const res = await apiPatch(`/api/items/${item.id}/status`, {
        contentStatus: '多平台发布',
      });

      expect(res.code).toBe(0);
      expect(res.data.contentStatus).toBe('多平台发布');
      expect(res.data.firstPublishAt).not.toBeNull();
    });

    it('传入非法枚举值返回400', async () => {
      const item = await createTestItem();

      const res = await apiPatch(`/api/items/${item.id}/status`, {
        priorityTier: 'Z',
      });

      expect(res.code).toBe(400);
    });

    it('传入非法shootingStatus返回400', async () => {
      const item = await createTestItem();

      const res = await apiPatch(`/api/items/${item.id}/status`, {
        shootingStatus: '不存在的状态',
      });

      expect(res.code).toBe(400);
    });

    it('不传任何状态字段返回400', async () => {
      const item = await createTestItem();

      const res = await apiPatch(`/api/items/${item.id}/status`, {});

      expect(res.code).toBe(400);
    });

    it('不存在的item返回404', async () => {
      const res = await apiPatch('/api/items/999999/status', {
        priorityTier: 'A',
      });

      expect(res.code).toBe(404);
    });

    it('firstShotAt设置后不会再次更新', async () => {
      const item = await createTestItem();

      // 第一次：从"未拍"改为"白底完成"
      await apiPatch(`/api/items/${item.id}/status`, {
        shootingStatus: '白底完成',
      });

      const res1 = await apiGet(`/api/items/${item.id}`);
      const firstShotTime = res1.data.firstShotAt;

      // 等一小段时间确保时间戳不同
      await new Promise(resolve => setTimeout(resolve, 100));

      // 第二次：改为"细节完成"
      await apiPatch(`/api/items/${item.id}/status`, {
        shootingStatus: '细节完成',
      });

      const res2 = await apiGet(`/api/items/${item.id}`);
      // firstShotAt 应该保持不变（不被覆盖）
      expect(res2.data.firstShotAt).toBe(firstShotTime);
    });
  });
});
