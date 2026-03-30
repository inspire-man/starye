import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright E2E 测试配置
 * 用于 Aria2 集成和评分系统的集成测试
 */
export default defineConfig({
  // 测试目录
  testDir: './e2e',
  
  // 测试超时（集成测试可能较慢）
  timeout: 60000,
  
  // 失败时重试次数
  retries: 1,
  
  // 并行执行
  workers: 1, // 集成测试通常需要串行执行
  
  // 报告器
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results/results.json' }]
  ],
  
  // 全局设置
  use: {
    // 基础 URL
    baseURL: 'http://localhost:5173',
    
    // 截图设置
    screenshot: 'only-on-failure',
    
    // 视频录制
    video: 'retain-on-failure',
    
    // 追踪
    trace: 'retain-on-failure',
    
    // 浏览器配置
    viewport: { width: 1280, height: 720 },
    
    // 忽略 HTTPS 错误
    ignoreHTTPSErrors: true,
    
    // 用户代理
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  },
  
  // 测试项目（不同浏览器）
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  
  // Web 服务器配置
  // 注意: 运行 E2E 测试前需要手动启动服务
  // 或使用 reuseExistingServer 复用已运行的服务
  webServer: {
    command: 'pnpm run dev',
    url: 'http://localhost:5173',
    timeout: 30000,
    reuseExistingServer: true, // 使用已运行的服务
  },
})
