import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  // 测试目录
  testDir: './tests/e2e',

  // 测试文件匹配
  testMatch: '**/*.spec.ts',

  // 并行执行
  fullyParallel: true,

  // CI 中禁止 test.only
  forbidOnly: !!process.env.CI,

  // CI 中失败重试
  retries: process.env.CI ? 2 : 0,

  // 并行 worker 数
  workers: process.env.CI ? 1 : undefined,

  // Reporter
  reporter: [
    ['html', { outputFolder: './playwright-report' }],
    ['list'],
  ],

  // 全局配置
  use: {
    // 开发服务器地址
    baseURL: 'http://localhost:3000',

    // 截图策略
    screenshot: 'only-on-failure',

    // Trace 策略
    trace: 'on-first-retry',

    // 视频记录
    video: 'retain-on-failure',
  },

  // 目标浏览器
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],

  // 开发服务器
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },

  // 超时配置
  timeout: 30 * 1000,
  expect: {
    timeout: 10 * 1000,
  },
});
