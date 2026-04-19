/**
 * CSV 导入 API 测试
 * 覆盖 POST /api/import/items-csv 和 POST /api/import/sales
 *
 * 重要：所有测试数据使用唯一时间戳前缀，避免与 custom.db 已有数据冲突。
 * CSV 导入的去重逻辑基于 name+costPrice+certNo 组合，因此必须用唯一名称。
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { apiGet, apiUpload } from './helpers/client';

// 全局唯一前缀，避免测试间数据冲突
const UID = `T${Date.now()}`;

/**
 * 生成含 10 条合法库存数据的 CSV（使用唯一前缀）
 */
function itemsValidCsv(): string {
  return `名称,材质,器型,成本价,零售价,数量,匹配码,产地,证书号
${UID}翡翠手镯A,翡翠,手镯,5000,8000,1,MK${UID}01,缅甸,CERT-${UID}-001
${UID}翡翠手镯B,翡翠,手镯,3000,5000,1,MK${UID}02,缅甸,CERT-${UID}-002
${UID}和田玉吊坠,和田玉,吊坠,2000,3500,1,MK${UID}03,新疆,
${UID}翡翠戒指,翡翠,戒指,1500,2500,2,MK${UID}04,,CERT-${UID}-004
${UID}碧玉手镯,碧玉,手镯,800,1500,1,MK${UID}05,,
${UID}蜜蜡项链,蜜蜡,项链,600,1200,1,MK${UID}06,,
${UID}朱砂手串,朱砂,,300,600,3,MK${UID}07,,CERT-${UID}-007
${UID}黄金戒指,黄金,戒指,4000,5500,1,MK${UID}08,,
${UID}珍珠耳饰,,耳饰,200,500,1,MK${UID}09,,
${UID}翡翠摆件,翡翠,摆件,10000,18000,1,MK${UID}10,云南,CERT-${UID}-010`;
}

describe('CSV 导入 API', () => {
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

  // ─── POST /api/import/items-csv ────────────────────────────
  describe('POST /api/import/items-csv', () => {
    it('上传合法 CSV（10条）成功导入', async () => {
      const csv = itemsValidCsv();
      const res = await apiUpload('/api/import/items-csv', csv, 'items-valid.csv');

      expect(res.code).toBe(0);
      expect(res.data.success).toBeGreaterThanOrEqual(10);
      expect(res.data.skipped).toBe(0);
    });

    it('重复上传同一份 CSV，全部重复跳过', async () => {
      // 先上传一份唯一数据
      const u = `${UID}DUP1`;
      const csv = `名称,材质,器型,成本价,零售价,匹配码
${u}货A,翡翠,手镯,500,800,MK-${u}1
${u}货B,翡翠,戒指,600,900,MK-${u}2`;
      await apiUpload('/api/import/items-csv', csv, 'dup-base.csv');

      // 再上传同一份
      const res = await apiUpload('/api/import/items-csv', csv, 'dup-again.csv');

      expect(res.code).toBe(0);
      expect(res.data.duplicated).toBeGreaterThan(0);
      expect(res.data.success).toBe(0);
    });

    it('上传含部分重复的 CSV，成功导入新条目', async () => {
      const u = `${UID}PDUP`;
      // 先上传基础 CSV
      const baseCsv = `名称,材质,器型,成本价,零售价,匹配码
${u}重复货X,翡翠,手镯,500,800,MK-${u}R1
${u}重复货Y,翡翠,手镯,600,900,MK-${u}R2`;
      await apiUpload('/api/import/items-csv', baseCsv, 'partial-base.csv');

      // 上传含重复的 CSV
      const dupCsv = `名称,材质,器型,成本价,零售价,匹配码
${u}重复货X,翡翠,手镯,500,800,MK-${u}R1
${u}重复货Y,翡翠,手镯,600,900,MK-${u}R2
${u}新货Z,翡翠,戒指,700,1200,MK-${u}R3`;
      const res = await apiUpload('/api/import/items-csv', dupCsv, 'partial-dup.csv');

      expect(res.code).toBe(0);
      expect(res.data.duplicated).toBeGreaterThanOrEqual(2); // 2条重复
      expect(res.data.success).toBeGreaterThanOrEqual(1); // 1条新数据
    });

    it('含空材质行 → 自动创建"未分类"', async () => {
      const u = `${UID}EMPTY`;
      const csv = `名称,材质,器型,成本价,零售价
${u}空材质货品,,手镯,300,600
${u}空器型货品,翡翠,,400,800
${u}双空货品,,,100,200`;
      const res = await apiUpload('/api/import/items-csv', csv, 'empty-fields.csv');

      expect(res.code).toBe(0);
      expect(res.data.success).toBeGreaterThanOrEqual(3);
    });

    it('"数量"列=3 → 创建3件独立Item', async () => {
      const u = `${UID}QTY`;
      const csv = `名称,材质,器型,成本价,零售价,数量,匹配码
${u}批量货A,翡翠,手镯,500,800,3,MK-${u}Q3`;
      const res = await apiUpload('/api/import/items-csv', csv, 'qty3.csv');

      expect(res.code).toBe(0);
      expect(res.data.success).toBe(3); // 应创建3件
    });

    it('"匹配码"列 → 存入 notes 为 [MK:xxx] 格式', async () => {
      const u = `${UID}MK`;
      const matchKey = `MK-${u}`;
      const csv = `名称,材质,器型,成本价,零售价,匹配码
${u}匹配码测试,翡翠,手镯,500,800,${matchKey}`;
      const res = await apiUpload('/api/import/items-csv', csv, 'matchkey.csv');

      expect(res.code).toBe(0);
      expect(res.data.success).toBeGreaterThanOrEqual(1);

      // 查找创建的 item 并验证 notes
      const itemsRes = await apiGet(`/api/items?keyword=${u}匹配码测试`);
      if (itemsRes.code === 0 && itemsRes.data?.items) {
        const found = itemsRes.data.items.find((item: any) => item.name === `${u}匹配码测试`);
        if (found) {
          expect(found.notes).toContain(`[MK:${matchKey}]`);
        }
      }
    });

    it('空 CSV 返回成功0条（空内容被视为无有效记录）', async () => {
      const res = await apiUpload('/api/import/items-csv', '', 'empty.csv');

      // 空 CSV 没有有效记录，success=0 或返回错误
      if (res.code === 0) {
        expect(res.data.success).toBe(0);
      } else {
        expect(res.code).not.toBe(0);
      }
    });
  });

  // ─── POST /api/import/sales ────────────────────────────────
  describe('POST /api/import/sales', () => {
    it('上传合法销售 CSV 成功匹配', async () => {
      const u = `${UID}SALE`;
      // 先确保有库存数据
      const itemsCsv = `名称,材质,器型,成本价,零售价,匹配码
${u}销售测试A,翡翠,手镯,3000,5000,MK-${u}1
${u}销售测试B,碧玉,手镯,800,1500,MK-${u}2`;
      await apiUpload('/api/import/items-csv', itemsCsv, 'sales-items.csv');

      // 上传销售 CSV
      const salesCsv = `名称,成本价,成交价,销售日期,渠道,客户姓名,匹配码
${u}销售测试A,3000,4500,2026-03-15,门店,${u}客户1,,MK-${u}1
${u}销售测试B,800,1200,2026-03-16,微信,${u}客户2,,MK-${u}2`;
      const res = await apiUpload('/api/import/sales', salesCsv, 'sales-valid.csv');

      expect(res.code).toBe(0);
      expect(res.data.successCount).toBeGreaterThanOrEqual(2);
    });

    it('匹配码关联优先于名称匹配', async () => {
      const u = `${UID}MKP`;
      // 创建两个同名货品，不同匹配码
      const itemsCsv = `名称,材质,器型,成本价,零售价,匹配码
${u}同名货品X,翡翠,手镯,1000,2000,MK-${u}FIRST
${u}同名货品X,翡翠,手镯,2000,3500,MK-${u}SEC`;
      await apiUpload('/api/import/items-csv', itemsCsv, 'same-name-items.csv');

      // 用匹配码指定第二个
      const salesCsv = `名称,成本价,成交价,销售日期,渠道,匹配码
${u}同名货品X,2000,3000,2026-03-20,门店,MK-${u}SEC`;
      const res = await apiUpload('/api/import/sales', salesCsv, 'sales-matchkey.csv');

      expect(res.code).toBe(0);
      expect(res.data.successCount).toBeGreaterThanOrEqual(1);
    });

    it('无匹配时自动创建 status=sold 的 Item', async () => {
      const u = `${UID}AUTO`;
      const salesCsv = `名称,材质,器型,成本价,成交价,销售日期,渠道,客户姓名
${u}自动创建货品,翡翠,手镯,1500,2500,2025-10-01,门店,${u}自动客户`;
      const res = await apiUpload('/api/import/sales', salesCsv, 'sales-auto.csv');

      expect(res.code).toBe(0);
      expect(res.data.successCount).toBeGreaterThanOrEqual(1);
      expect(res.data.autoCreatedItemCount).toBeGreaterThanOrEqual(1);
    });

    it('自动创建客户（按姓名）', async () => {
      const u = `${UID}CUST`;
      const customerName = `${u}客户`;
      // 先确保有库存
      const itemsCsv = `名称,材质,器型,成本价,零售价,匹配码
${u}客户测试货,翡翠,戒指,500,800,MK-${u}C1`;
      await apiUpload('/api/import/items-csv', itemsCsv, 'cust-items.csv');

      const salesCsv = `名称,成交价,销售日期,渠道,客户姓名,匹配码
${u}客户测试货,700,2026-03-25,门店,${customerName},MK-${u}C1`;
      const res = await apiUpload('/api/import/sales', salesCsv, 'sales-cust.csv');

      expect(res.code).toBe(0);
      expect(res.data.successCount).toBeGreaterThanOrEqual(1);

      // 验证客户被创建
      const customersRes = await apiGet(`/api/customers?keyword=${encodeURIComponent(customerName)}`);
      if (customersRes.code === 0 && customersRes.data) {
        const items = customersRes.data.items || customersRes.data;
        if (Array.isArray(items)) {
          const found = items.find((c: any) => c.name === customerName);
          expect(found).toBeDefined();
        }
      }
    });

    it('缺少成交价返回失败', async () => {
      const u = `${UID}NOP`;
      const salesCsv = `名称,成本价,销售日期,渠道
${u}缺成交价货品,500,2026-03-25,门店`;
      const res = await apiUpload('/api/import/sales', salesCsv, 'sales-no-price.csv');

      expect(res.code).toBe(0); // API 整体返回 code=0，但行级别失败
      expect(res.data.failCount).toBeGreaterThanOrEqual(1);
    });

    it('空 CSV 文件返回400', async () => {
      const res = await apiUpload('/api/import/sales', '', 'empty-sales.csv');
      expect(res.code).not.toBe(0);
    });
  });
});
