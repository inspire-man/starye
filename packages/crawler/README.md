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

#### R2 配置
```bash
R2_ACCOUNT_ID=xxx
R2_ACCESS_KEY_ID=xxx
R2_SECRET_ACCESS_KEY=xxx
R2_BUCKET_NAME=xxx
R2_PUBLIC_DOMAIN=xxx
```

#### API 配置
```bash
API_URL=http://localhost:3000
CRAWLER_SECRET=xxx
```

#### 爬虫配置（旧版，JavBus 使用）
```bash
MAX_MOVIES=50
MAX_PAGES=5
USE_RANDOM_MIRROR=true
```

#### 并发配置（旧版，JavBus 使用）
```bash
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

#### 漫画爬虫配置（新版，Comic Crawler 使用）

爬虫会自动检测运行环境（本地 vs CI），并使用相应的默认值。你可以通过环境变量覆盖任何配置：

```bash
# 并发控制
CRAWLER_CONCURRENCY_MANGA=5          # 漫画级并发数 (默认: CI=5, 本地=1)
CRAWLER_CONCURRENCY_CHAPTER=2         # 章节级并发数 (默认: CI=2, 本地=1)
CRAWLER_CONCURRENCY_IMAGE_BATCH=10    # 图片批量上传数 (默认: CI=10, 本地=5)

# 数量限制
CRAWLER_LIMIT_MAX_MANGAS_PER_RUN=20          # 每次运行最多处理漫画数 (默认: CI=20, 本地=15)
CRAWLER_LIMIT_MAX_CHAPTERS_PER_NEW=5         # 新漫画最多处理章节数 (默认: CI=5, 本地=3)
CRAWLER_LIMIT_MAX_CHAPTERS_PER_UPDATE=20     # 更新漫画最多处理章节数 (默认: CI=20, 本地=10)

# 增量策略
CRAWLER_INCREMENTAL_ENABLED=true      # 启用增量爬取 (默认: true)

# 软超时（分钟）
CRAWLER_LIMIT_TIMEOUT_MINUTES=300     # 运行软超时时间 (默认: CI=300, 本地=360)
```

**配置说明**:

- **多级并发**: 爬虫同时在漫画、章节、图片三个层级并发处理，总并发度 = `manga × chapter × imageBatch`
  - CI 默认: 5 × 2 × 10 = 100
  - 本地默认: 1 × 1 × 5 = 5

- **数量限制**: 控制每次运行的处理量，避免超时和资源耗尽
  - 新漫画: 限制章节数，避免一次性爬取过多
  - 更新漫画: 连载作品可处理更多新章节

- **增量策略**: 自动跳过已完成且非连载的漫画，优先处理：
  1. 连载中有更新的漫画（最高优先级）
  2. 部分完成的漫画
  3. 新发现的漫画
  4. 已完结的漫画（最低优先级）

- **软超时**: 接近 GitHub Actions 的 6 小时硬超时前优雅退出，避免数据丢失

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

### JavBus 爬虫（旧版）
- **四阶段流水线**：列表页 → 详情页 → 图片 → API
- **智能延迟**：自动计算请求间隔
- **指数退避**：失败重试策略
- **并发控制**：不同阶段独立配置

### Comic 爬虫（新版 - 2026-03-11 优化）

#### 优化前性能
- **单章节处理**: ~14 分钟
- **单漫画处理**: ~42 分钟 (6 章)
- **总体吞吐**: ~2 漫画/小时
- **处理方式**: 串行处理（图片、章节、漫画）

#### 优化后性能

| 环境 | 并发配置 (M/C/I) | 单章节 | 单漫画 (6章) | 总体吞吐 | 提速倍数 |
|------|-----------------|--------|-------------|---------|---------|
| **CI** | 5/2/10 | ~1 分钟 | ~3 分钟 | ~20 漫画/小时 | **14x** |
| **本地** | 1/1/5 | ~3 分钟 | ~18 分钟 | ~3 漫画/小时 | **2.3x** |

**核心优化**:
1. **多级并发架构**：使用 `p-map` 实现漫画、章节、图片三级并发
2. **增量爬取**：数据库驱动的状态管理，智能跳过已完成内容
3. **优先级队列**：连载更新 > 部分完成 > 新漫画 > 已完结
4. **批量 API 查询**：减少数据库往返次数
5. **软超时机制**：优雅处理 GitHub Actions 时间限制

详见: `openspec/changes/crawler-incremental-optimization/`

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
