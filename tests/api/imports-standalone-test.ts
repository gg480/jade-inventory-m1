/**
 * CSV 导入 API 独立测试脚本
 * 不依赖 vitest，直接用 Node.js fetch 运行
 * 使用方法: node tests/api/imports-standalone-test.ts (需要 tsx)
 * 或者: npx tsx tests/api/imports-standalone-test.ts
 */
const BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000';

let passed = 0;
let failed = 0;

async function uploadCsv(path: string, csv: string, fileName: string, extraFields?: Record<string, string>) {
  const formData = new FormData();
  const blob = new Blob([csv], { type: 'text/csv' });
  formData.append('file', blob, fileName);
  if (extraFields) {
    for (const [key, value] of Object.entries(extraFields)) {
      formData.append(key, value);
    }
  }
  const response = await fetch(`${BASE_URL}${path}`, { method: 'POST', body: formData });
  return response.json();
}

async function apiGet(path: string) {
  const response = await fetch(`${BASE_URL}${path}`);
  return response.json();
}

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✅ ${testName}`);
    passed++;
  } else {
    console.log(`  ❌ ${testName}${detail ? ` — ${detail}` : ''}`);
    failed++;
  }
}

async function runTests() {
  console.log('\n=== CSV 导入 API 独立测试 ===\n');

  // Health check
  const health = await apiGet('/api/health');
  assert(health.code === 0, '健康检查');

  // ─── items-csv ────────────────────────────────
  console.log('\n--- POST /api/import/items-csv ---');

  // 1. 合法 CSV 导入
  const validCsv = `名称,材质,器型,成本价,零售价,数量,匹配码,产地,证书号
翡翠手镯A,翡翠,手镯,5000,8000,1,MK-TEST-001,缅甸,CERT-001
翡翠戒指,翡翠,戒指,1500,2500,2,MK-TEST-004,,CERT-004
碧玉手镯,碧玉,手镯,800,1500,1,MK-TEST-005,,`;
  const res1 = await uploadCsv('/api/import/items-csv', validCsv, 'items-valid.csv');
  assert(res1.code === 0, '合法CSV导入返回code=0');
  assert(res1.data.success >= 4, `成功导入${res1.data.success}件(预期≥4)`, `success=${res1.data.success}`);

  // 2. 重复上传
  const res2 = await uploadCsv('/api/import/items-csv', validCsv, 'items-dup.csv');
  assert(res2.code === 0, '重复上传返回code=0');
  assert(res2.data.duplicated > 0, `重复跳过${res2.data.duplicated}件`, `duplicated=${res2.data.duplicated}`);

  // 3. 空材质/器型
  const emptyCsv = `名称,材质,器型,成本价,零售价
空材质货品,,手镯,300,600
空器型货品,翡翠,,400,800`;
  const res3 = await uploadCsv('/api/import/items-csv', emptyCsv, 'empty.csv');
  assert(res3.code === 0, '空材质/器型CSV返回code=0');
  assert(res3.data.success >= 2, `空字段导入成功${res3.data.success}件(预期≥2)`, `success=${res3.data.success}`);

  // 4. 数量=3
  const qtyCsv = `名称,材质,器型,成本价,零售价,数量,匹配码
批量货A,翡翠,手镯,500,800,3,MK-QTY3`;
  const res4 = await uploadCsv('/api/import/items-csv', qtyCsv, 'qty.csv');
  assert(res4.code === 0, '数量列CSV返回code=0');
  assert(res4.data.success === 3, `数量=3创建3件`, `success=${res4.data.success}`);

  // 5. 匹配码
  const mkKey = `MK-NOTE-${Date.now()}`;
  const mkCsv = `名称,材质,器型,成本价,零售价,匹配码
匹配码测试,翡翠,手镯,500,800,${mkKey}`;
  const res5 = await uploadCsv('/api/import/items-csv', mkCsv, 'mk.csv');
  assert(res5.code === 0, '匹配码CSV返回code=0');
  assert(res5.data.success >= 1, `匹配码导入成功`, `success=${res5.data.success}`);

  // ─── sales ────────────────────────────────
  console.log('\n--- POST /api/import/sales ---');

  // 6. 销售导入（先确保有库存）
  const salesItemsCsv = `名称,材质,器型,成本价,零售价,匹配码
销售测试A,翡翠,手镯,3000,5000,MK-SALE-A`;
  await uploadCsv('/api/import/items-csv', salesItemsCsv, 'sales-items.csv');

  const salesCsv = `名称,成交价,销售日期,渠道,客户姓名,匹配码
销售测试A,4500,2026-03-15,门店,独立测试客户,,MK-SALE-A`;
  const res6 = await uploadCsv('/api/import/sales', salesCsv, 'sales.csv');
  assert(res6.code === 0, '销售CSV返回code=0');
  assert(res6.data.successCount >= 1, `销售导入成功${res6.data.successCount}条(预期≥1)`, `successCount=${res6.data.successCount}`);

  // 7. 自动创建 Item
  const autoSalesCsv = `名称,材质,器型,成本价,成交价,销售日期,渠道,客户姓名
自动创建货品B,翡翠,手镯,1500,2500,2025-10-01,门店,自动客户B`;
  const res7 = await uploadCsv('/api/import/sales', autoSalesCsv, 'auto-sales.csv');
  assert(res7.code === 0, '自动创建销售CSV返回code=0');
  assert(res7.data.successCount >= 1, `自动创建销售成功`, `successCount=${res7.data.successCount}`);
  assert(res7.data.autoCreatedItemCount >= 1, `自动创建Item数量≥1`, `autoCreatedItemCount=${res7.data.autoCreatedItemCount}`);

  // 8. 缺少成交价
  const noPriceCsv = `名称,成本价,销售日期,渠道
缺价货品,500,2026-03-25,门店`;
  const res8 = await uploadCsv('/api/import/sales', noPriceCsv, 'no-price.csv');
  assert(res8.code === 0, '缺价CSV返回code=0');
  assert(res8.data.failCount >= 1, `缺价行失败≥1`, `failCount=${res8.data.failCount}`);

  // Summary
  console.log(`\n=== 结果: ${passed} passed, ${failed} failed ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(e => {
  console.error('Test runner error:', e);
  process.exit(1);
});
