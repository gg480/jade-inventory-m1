import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    testTimeout: 30000,
    hookTimeout: 30000,
    // 测试时使用独立的 test.db
    env: {
      DATABASE_URL: 'file:./prisma/db/test.db',
    },
    include: ['tests/**/*.test.ts'],
  },
});
