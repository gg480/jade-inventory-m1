/**
 * 健康检查 API 测试
 * 验证测试框架工作正常 + /api/health 基本功能
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupTestDb, teardownTestDb } from './helpers/setup';
import { apiGet } from './helpers/client';

describe('GET /api/health', () => {
  beforeAll(async () => {
    await setupTestDb();
  }, 30000);

  afterAll(async () => {
    await teardownTestDb();
  });

  it('应该返回 code=0 和正确的数据结构', async () => {
    const res = await apiGet('/api/health');

    expect(res.code).toBe(0);
    expect(res.message).toBe('ok');
    expect(res.data).toBeDefined();
    expect(res.data.status).toBe('ok');
  });

  it('应该包含 timestamp 字段且为 ISO 格式', async () => {
    const res = await apiGet('/api/health');

    expect(res.data.timestamp).toBeDefined();
    // 验证是有效的 ISO 时间字符串
    expect(new Date(res.data.timestamp).toISOString()).toBe(res.data.timestamp);
  });

  it('应该包含 version 字段', async () => {
    const res = await apiGet('/api/health');

    expect(res.data.version).toBeDefined();
    expect(typeof res.data.version).toBe('string');
    expect(res.data.version).not.toBe('unknown');
  });

  it('应该包含 db 连接状态', async () => {
    const res = await apiGet('/api/health');

    expect(res.data.db).toBeDefined();
    expect(res.data.db.connected).toBe(true);
    expect(typeof res.data.db.itemCount).toBe('number');
    expect(typeof res.data.db.dictMaterialCount).toBe('number');
  });

  it('应该包含 uptime 字段且为正数', async () => {
    const res = await apiGet('/api/health');

    expect(typeof res.data.uptime).toBe('number');
    expect(res.data.uptime).toBeGreaterThan(0);
  });

  it('响应时间应小于 500ms', async () => {
    const start = Date.now();
    await apiGet('/api/health');
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(500);
  });
});
