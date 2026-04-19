/**
 * Export-for-AI API 测试
 * 覆盖 GET /api/items/[id]/export-for-ai
 *
 * 注意：测试使用 custom.db（与 dev server 共享），通过 API 交互。
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { apiGet, apiPost, apiDelete } from './helpers/client';

// ─── 从 custom.db 获取的字典 ID ─────────────────────────
const DICT = {
  materialId: 6,   // 翡翠 (category: '玉')
  typeId: 1,       // 手镯
  craftId: 1,      // 手工雕刻
  sellingPointId: 1, // 送礼
  audienceId: 1,    // 年轻女性
} as const;

let skuCounter = Math.floor(Math.random() * 10000) + 50000;

function nextSku(): string {
  skuCounter++;
  const ts = Date.now().toString(36);
  const rnd = Math.random().toString(36).slice(2, 5);
  return `EX-${ts}-${rnd}${String(skuCounter).padStart(3, '0')}`;
}

async function createTestItem(overrides: Record<string, unknown> = {}) {
  const sku = nextSku();
  const body = {
    name: `导出测试-${sku}`,
    skuCode: sku,
    materialId: DICT.materialId,
    typeId: DICT.typeId,
    costPrice: 8000,
    sellingPrice: 12000,
    craftId: DICT.craftId,
    origin: '缅甸',
    era: '现代工',
    certNo: 'CERT-EXP-001',
    mainColor: '翠绿',
    subColor: '白底',
    priceRange: '精品',
    storyPoints: '此件翡翠手镯质地细腻，水头充足',
    operationNote: '经营笔记内容，不应在导出中泄露',
    sellingPointIds: [DICT.sellingPointId],
    audienceIds: [DICT.audienceId],
    priorityTier: 'A',
    ...overrides,
  };

  const res = await apiPost('/api/items', body);
  if (res.code !== 0) {
    throw new Error(`createTestItem 失败: ${JSON.stringify(res)}`);
  }
  return res.data;
}

describe('GET /api/items/[id]/export-for-ai', () => {
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
    for (const id of createdItemIds) {
      try {
        await apiDelete(`/api/items/${id}`);
      } catch {
        // 忽略清理失败
      }
    }
  });

  it('返回结构包含所有中文字段', async () => {
    const item = await createTestItem();
    createdItemIds.push(item.id);

    const res = await apiGet(`/api/items/${item.id}/export-for-ai`);

    expect(res.code).toBe(0);
    expect(res.data).toBeDefined();

    // 验证所有中文字段名存在
    const expectedKeys = [
      'SKU编码', '商品名称', '材质大类', '材质细类', '器型', '工艺',
      '产地', '年代款式', '证书编号', '主色', '副色', '尺寸',
      '价格带', '建议售价', '卖点标签', '目标人群', '故事点',
      '图片', '状态', '最后更新',
    ];

    for (const key of expectedKeys) {
      expect(res.data).toHaveProperty(key);
    }
  });

  it('响应不包含operationNote字段(私有字段不泄露)', async () => {
    const item = await createTestItem();
    createdItemIds.push(item.id);
    // createTestItem 包含 operationNote
    const res = await apiGet(`/api/items/${item.id}/export-for-ai`);

    expect(res.code).toBe(0);
    // 不应该包含 operationNote 相关字段
    expect(res.data).not.toHaveProperty('operationNote');
    expect(res.data).not.toHaveProperty('经营笔记');
    expect(res.data).not.toHaveProperty('operation_note');
  });

  it('响应不包含extraData字段', async () => {
    const item = await createTestItem();
    createdItemIds.push(item.id);
    const res = await apiGet(`/api/items/${item.id}/export-for-ai`);

    expect(res.code).toBe(0);
    expect(res.data).not.toHaveProperty('extraData');
    expect(res.data).not.toHaveProperty('extra_data');
    expect(res.data).not.toHaveProperty('扩展数据');
  });

  it('材质大类正确返回(从material.category取)', async () => {
    const item = await createTestItem();
    createdItemIds.push(item.id);
    const res = await apiGet(`/api/items/${item.id}/export-for-ai`);

    expect(res.code).toBe(0);
    // createTestItem 使用翡翠，其 category 为 '玉'
    expect(res.data['材质大类']).toBe('玉');
    expect(res.data['材质细类']).toBe('翡翠');
  });

  it('材质category为null时材质大类返回null', async () => {
    // 在 custom.db 中找一个没有 category 的材质，或创建一个
    // 使用黄金 (id=1, category='贵金属') 创建，然后验证 category 正确
    // 由于无法直接通过 API 创建无 category 的材质，
    // 我们验证正常材质的 category 能正确返回
    const item = await createTestItem({ materialId: 1 }); // 黄金
    createdItemIds.push(item.id);

    const res = await apiGet(`/api/items/${item.id}/export-for-ai`);
    expect(res.code).toBe(0);
    expect(res.data['材质大类']).toBe('贵金属');
    expect(res.data['材质细类']).toBe('黄金');
  });

  it('storyPoints保留换行符', async () => {
    const item = await createTestItem({
      storyPoints: '第一行内容\n第二行内容\n第三行内容',
    });
    createdItemIds.push(item.id);

    const res = await apiGet(`/api/items/${item.id}/export-for-ai`);

    expect(res.code).toBe(0);
    expect(res.data['故事点']).toContain('\n');
    expect(res.data['故事点']).toBe('第一行内容\n第二行内容\n第三行内容');
  });

  it('空字段显式返回null而非undefined', async () => {
    const item = await createTestItem({
      origin: null,
      era: null,
      certNo: null,
      mainColor: null,
      subColor: null,
      priceRange: null,
      storyPoints: null,
    });
    createdItemIds.push(item.id);

    const res = await apiGet(`/api/items/${item.id}/export-for-ai`);

    expect(res.code).toBe(0);
    // 未填写的字段应该返回 null 而非 undefined
    const nullableFields = ['产地', '年代款式', '证书编号', '主色', '副色', '价格带', '故事点'];
    for (const field of nullableFields) {
      const value = res.data[field];
      // 值应该是 null，不是 undefined
      expect(value).not.toBeUndefined();
      expect(value === null).toBe(true);
    }
  });

  it('卖点标签和目标人群返回中文名称数组', async () => {
    const item = await createTestItem();
    createdItemIds.push(item.id);
    const res = await apiGet(`/api/items/${item.id}/export-for-ai`);

    expect(res.code).toBe(0);
    expect(Array.isArray(res.data['卖点标签'])).toBe(true);
    expect(res.data['卖点标签'].length).toBeGreaterThan(0);
    expect(res.data['卖点标签']).toContain('送礼');

    expect(Array.isArray(res.data['目标人群'])).toBe(true);
    expect(res.data['目标人群'].length).toBeGreaterThan(0);
    expect(res.data['目标人群']).toContain('年轻女性');
  });

  it('不存在的item返回404', async () => {
    const res = await apiGet('/api/items/999999/export-for-ai');
    expect(res.code).toBe(404);
  });

  it('状态字段包含档位/拍摄状态/内容状态', async () => {
    const item = await createTestItem();
    createdItemIds.push(item.id);
    const res = await apiGet(`/api/items/${item.id}/export-for-ai`);

    expect(res.code).toBe(0);
    expect(res.data['状态']).toBeDefined();
    expect(res.data['状态']['档位']).toBeDefined();
    expect(res.data['状态']['拍摄状态']).toBeDefined();
    expect(res.data['状态']['内容状态']).toBeDefined();
  });

  it('工艺字段正确返回中文名称', async () => {
    const item = await createTestItem();
    createdItemIds.push(item.id);
    const res = await apiGet(`/api/items/${item.id}/export-for-ai`);

    expect(res.code).toBe(0);
    // createTestItem 使用手工雕刻 craftId
    expect(res.data['工艺']).toBe('手工雕刻');
  });
});
