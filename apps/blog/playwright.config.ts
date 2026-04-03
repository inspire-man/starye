/* eslint-disable node/prefer-global/process */
import { defineConfig, devices } from '@playwright/test'

/**
 * Blog Playwright E2E 测试配置
 * 使用 page.route() mock API 响应，无需真实后端服务
 */
export default defineConfig({
  testDir: './e2e',

  timeout: 30000,

  retries: process.env.CI ? 2 : 0,

  workers: process.env.CI ? 1 : undefined,

  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],

  use: {
    baseURL: 'http://localhost:3002/blog',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: 'pnpm run dev',
    url: 'http://localhost:3002/blog/',
    timeout: 120000,
    reuseExistingServer: !process.env.CI,
    stdout: 'ignore',
    stderr: 'pipe',
  },
})
