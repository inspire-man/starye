/**
 * 爬虫常量定义
 */

// 浏览器启动参数
export const BROWSER_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-infobars',
  '--window-size=1920,1080',
  '--lang=zh-CN,zh',
  '--disable-blink-features=AutomationControlled',
  '--disable-web-security',
  '--disable-features=IsolateOrigins,site-per-process',
  '--disable-dev-shm-usage',
  '--disable-accelerated-2d-canvas',
  '--disable-gpu',
  '--hide-scrollbars',
  '--mute-audio',
  '--disable-background-timer-throttling',
  '--disable-backgrounding-occluded-windows',
  '--disable-renderer-backgrounding',
] as const

// User-Agent
export const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

// HTTP 请求头
export const DEFAULT_HEADERS = {
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8,ja;q=0.7',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Sec-Ch-Ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"Windows"',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1',
} as const

// Cookie 配置
export const DEFAULT_COOKIES = [
  { name: 'existmag', value: 'all' },
  { name: 'age_verified', value: '1' },
  { name: 'dv', value: '1' },
] as const

// 超时配置
export const TIMEOUTS = {
  navigation: 45000, // 页面导航超时
  selector: 15000, // 选择器等待超时
  cloudflare: 60000, // Cloudflare 挑战超时
  api: 30000, // API 请求超时
} as const

// 重试配置
export const RETRY_CONFIG = {
  maxRetries: 3,
  retryDelay: 2000,
  exponentialBase: 1.5,
} as const

// JavBus 镜像站点
export const JAVBUS_MIRRORS = [
  'https://www.javbus.com',
  'https://busdmm.bond',
  'https://dmmbus.cyou',
  'https://cdnbus.cyou',
  'https://javsee.cyou',
] as const

// Cloudflare 检测关键词
export const CLOUDFLARE_INDICATORS = [
  'Just a moment',
  'DDoS protection',
  'Security Check',
] as const

// Driver Verify 检测关键词
export const DRIVER_VERIFY_INDICATORS = [
  'driver-verify',
  'Driver Knowledge Test',
] as const

// 年龄验证关键词
export const AGE_VERIFICATION_KEYWORDS = [
  '成年',
  'ENTER',
  'YES',
  '进入',
  '進入',
] as const
