# Crawler Package

优化的爬虫包，采用工程化架构设计。

## 📁 目录结构

```
src/
├── constants/          # 常量定义
│   └── index.ts       # 浏览器参数、超时配置、镜像站点等
├── core/              # 核心类
│   └── optimized-crawler.ts  # 优化的爬虫基类
├── crawlers/          # 爬虫实现
│   └── javbus.ts      # JavBus 爬虫
├── lib/               # 基础库
│   ├── base-crawler.ts
│   ├── image-processor.ts
│   ├── queue-manager.ts
│   ├── search.ts
│   └── strategy.ts
├── strategies/        # 爬虫策略（旧版）
├── types/             # 类型定义
│   └── config.ts      # 配置类型
├── utils/             # 工具类
│   ├── api-client.ts  # API 客户端
│   ├── browser.ts     # 浏览器管理
│   └── progress.ts    # 进度监控
└── index.ts           # 包入口
```

## 🚀 使用方法

### 本地运行

```bash
# 测试 10 部影片
MAX_MOVIES=10 pnpm run test:optimized

# 完整测试
pnpm run test:optimized
```

### 环境变量

```bash
# R2 配置
R2_ACCOUNT_ID=xxx
R2_ACCESS_KEY_ID=xxx
R2_SECRET_ACCESS_KEY=xxx
R2_BUCKET_NAME=xxx
R2_PUBLIC_DOMAIN=xxx

# API 配置
API_URL=http://localhost:3000
CRAWLER_SECRET=xxx

# 爬虫配置
MAX_MOVIES=50
MAX_PAGES=5
USE_RANDOM_MIRROR=true

# 并发配置
LIST_CONCURRENCY=1
DETAIL_CONCURRENCY=2
IMAGE_CONCURRENCY=3
API_CONCURRENCY=2

# 延迟配置（毫秒）
LIST_DELAY=8000
DETAIL_DELAY=5000
IMAGE_DELAY=2000
API_DELAY=1000
```

## 🏗️ 架构特点

### 1. 模块化设计
- **核心类**：OptimizedCrawler 提供基础功能
- **工具类**：BrowserManager、ApiClient、ProgressMonitor 独立封装
- **配置管理**：统一的类型定义和默认配置

### 2. 关注点分离
- **浏览器管理**：BrowserManager 负责浏览器生命周期
- **API 通信**：ApiClient 负责 API 交互
- **进度监控**：ProgressMonitor 负责统计和显示
- **队列管理**：QueueManager 负责并发控制

### 3. 类型安全
- 完整的 TypeScript 类型定义
- 配置类型检查
- 接口约束

### 4. 可扩展性
- 继承 OptimizedCrawler 实现新爬虫
- 工具类可独立使用
- 常量集中管理

## 📊 性能优化

- **四阶段流水线**：列表页 → 详情页 → 图片 → API
- **智能延迟**：自动计算请求间隔
- **指数退避**：失败重试策略
- **并发控制**：不同阶段独立配置

## 🧪 测试

```bash
# 运行单元测试
pnpm test:unit

# 类型检查
pnpm type-check

# 代码检查
pnpm lint
```

## 📝 开发指南

### 创建新爬虫

```typescript
import type { MovieInfo } from '../lib/strategy'
import { OptimizedCrawler } from '../core/optimized-crawler'

export class MyCrawler extends OptimizedCrawler {
  protected async getMovieInfo(url: string, page: Page): Promise<MovieInfo | null> {
    // 实现爬取逻辑
  }

  async run(): Promise<void> {
    await this.init()
    // 实现运行逻辑
    await this.cleanup()
  }
}
```

### 使用工具类

```typescript
import { ApiClient, BrowserManager, ProgressMonitor } from '@starye/crawler'

// 浏览器管理
const browser = new BrowserManager({ headless: true })
await browser.launch()
const page = await browser.createPage()

// API 客户端
const api = new ApiClient({ url: 'http://localhost:3000', token: 'xxx' })
await api.syncMovie(movieData)

// 进度监控
const progress = new ProgressMonitor(100, true)
progress.init()
progress.incrementMoviesSuccess()
```
