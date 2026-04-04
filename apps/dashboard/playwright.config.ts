/* eslint-disable node/prefer-global/process */
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 60000,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report' }],
  ],
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:5173',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // 本地开发时自动启动 Dev Server
  webServer: process.env.CI
    ? undefined
    : {
        command: 'pnpm run dev',
        url: 'http://localhost:5173',
        timeout: 120000,
        reuseExistingServer: true,
        stdout: 'ignore',
        stderr: 'pipe',
      },
})
