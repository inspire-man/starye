/* eslint-disable node/prefer-global/process */
/**
 * 爬虫配置示例
 * 包含各种反爬虫策略的配置选项
 */

import type { CrawlerConfig } from './src/lib/base-crawler'

// ============================================
// 基础配置（无代理）
// ============================================
export const basicConfig: CrawlerConfig = {
  r2: {
    accountId: process.env.R2_ACCOUNT_ID || '',
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
    bucketName: process.env.R2_BUCKET_NAME || '',
    publicUrl: process.env.R2_PUBLIC_URL || '',
  },
  api: {
    url: process.env.API_URL || 'http://localhost:3000',
    token: process.env.CRAWLER_SECRET || '',
  },
  puppeteer: {
    // 使用本地 Chrome 浏览器（推荐）
    // Windows:
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    // macOS:
    // executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    // Linux:
    // executablePath: '/usr/bin/google-chrome',
  },
}

// ============================================
// 使用代理的配置
// ============================================
export const proxyConfig: CrawlerConfig = {
  ...basicConfig,
  // 代理配置需要在 base-crawler.ts 中实现
  // 这里仅作为示例
  proxy: {
    server: 'http://proxy.example.com:8080',
    username: 'your-username',
    password: 'your-password',
  },
}

// ============================================
// 使用 Tor 网络的配置（高匿名性）
// ============================================
export const torConfig: CrawlerConfig = {
  ...basicConfig,
  proxy: {
    server: 'socks5://127.0.0.1:9050', // Tor 默认端口
  },
}

// ============================================
// 环境变量配置
// ============================================
// 在 .env 文件中添加：
// PUPPETEER_EXECUTABLE_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe
// PROXY_SERVER=http://proxy.example.com:8080
// PROXY_USERNAME=your-username
// PROXY_PASSWORD=your-password

export const envConfig: CrawlerConfig = {
  r2: {
    accountId: process.env.R2_ACCOUNT_ID || '',
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
    bucketName: process.env.R2_BUCKET_NAME || '',
    publicUrl: process.env.R2_PUBLIC_URL || '',
  },
  api: {
    url: process.env.API_URL || 'http://localhost:3000',
    token: process.env.CRAWLER_SECRET || '',
  },
  puppeteer: {
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
  },
  proxy: process.env.PROXY_SERVER
    ? {
        server: process.env.PROXY_SERVER,
        username: process.env.PROXY_USERNAME,
        password: process.env.PROXY_PASSWORD,
      }
    : undefined,
}

// ============================================
// 推荐的代理服务商
// ============================================
/*
1. Bright Data (原 Luminati)
   - 住宅代理，质量最高
   - 价格较贵
   - https://brightdata.com

2. Smartproxy
   - 性价比高
   - 支持住宅和数据中心代理
   - https://smartproxy.com

3. Oxylabs
   - 企业级代理
   - 稳定性好
   - https://oxylabs.io

4. 911 S5 / IPRoyal
   - 价格便宜
   - 适合小规模使用
   - https://iproyal.com

5. 自建代理
   - 使用 VPS + Squid/Shadowsocks
   - 成本最低但需要技术能力
*/

// ============================================
// 使用说明
// ============================================
/*
1. 安装本地 Chrome 浏览器
   - 下载：https://www.google.com/chrome/
   - 配置 executablePath 指向 Chrome 可执行文件

2. 配置代理（可选但推荐）
   - 购买住宅代理服务
   - 配置代理服务器地址和认证信息
   - 在 base-crawler.ts 中添加代理支持

3. 降低爬取频率
   - 每个请求间隔 5-10 秒
   - 避免并发请求
   - 分时段爬取

4. 使用镜像站点
   - JavBus 有多个镜像
   - 自动切换功能已在 JavBusStrategy 中实现

5. 监控和调试
   - 使用 test-anti-detection.ts 脚本测试
   - 观察浏览器行为（headless: false）
   - 检查日志输出

6. 应对封禁
   - 如果遇到 driver-verify，立即停止
   - 更换 IP 地址
   - 等待 24 小时后重试
   - 考虑使用不同的镜像站点
*/
