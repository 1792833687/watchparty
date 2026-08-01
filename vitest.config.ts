import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    // 测试环境
    environment: 'jsdom',

    // 全局 setup — 使用已有的 tests/setup.ts
    setupFiles: ['./tests/setup.ts'],

    // 测试文件匹配
    include: [
      'tests/unit/**/*.test.ts',
      'tests/unit/**/*.test.tsx',
      'tests/integration/**/*.test.ts',
      'tests/integration/**/*.test.tsx',
      'src/**/*.test.ts',
      'src/**/*.test.tsx',
    ],

    // 全局变量
    globals: true,

    // 覆盖率
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.test.tsx',
        'src/**/*.d.ts',
      ],

      // 覆盖率阈值（tech-checklist §4.4）
      thresholds: {
        // 全局阈值
        statements: 70,
        branches: 65,
        functions: 70,
        lines: 70,

        // 核心系统 80%+
        'src/systems/memory/': {
          statements: 80,
          branches: 75,
          functions: 80,
          lines: 80,
        },
        'src/systems/dialogue/': {
          statements: 70,
          branches: 65,
          functions: 70,
          lines: 70,
        },
        'src/systems/map/': {
          statements: 70,
          branches: 65,
          functions: 70,
          lines: 70,
        },

        // 基础设施 70%+
        'src/infrastructure/': {
          statements: 70,
          branches: 65,
          functions: 70,
          lines: 70,
        },

        // 组件 50%+
        'src/components/': {
          statements: 50,
          branches: 40,
          functions: 50,
          lines: 50,
        },

        // lib/ 工具 90%+
        'src/lib/': {
          statements: 90,
          branches: 85,
          functions: 90,
          lines: 90,
        },
      },
    },
  },

  // 路径别名（与 tsconfig.json 保持一致）
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
