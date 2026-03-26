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

#### 电影爬虫
```bash
# 测试 10 部影片
MAX_MOVIES=10 pnpm run test:optimized

# 完整测试
pnpm run test:optimized
```

#### 女优爬虫
```bash
# 本地测试（最多 5 个女优）
MAX_ACTORS=5 pnpm crawl:actor

# 正常运行（默认 100 个）
pnpm crawl:actor

# 恢复模式（重试失败任务）
RECOVERY_MODE=true pnpm crawl:actor
```

#### 厂商爬虫
```bash
# 本地测试（最多 5 个厂商）
MAX_PUBLISHERS=5 pnpm crawl:publisher

# 正常运行（默认 100 个）
pnpm crawl:publisher

# 恢复模式
RECOVERY_MODE=true pnpm crawl:publisher
```

### GitHub Actions 触发

#### 女优爬虫
- **定时任务**: 每天 00:00 UTC 自动运行
- **手动触发**: Actions → Daily Actor Crawl → Run workflow
  - `max_actors`: 最大爬取数量（默认 150）
  - `recovery_mode`: 是否启用恢复模式（默认 false）

#### 厂商爬虫
- **定时任务**: 每天 08:00 UTC 自动运行
- **手动触发**: Actions → Daily Publisher Crawl → Run workflow
  - `max_publishers`: 最大爬取数量（默认 100）
  - `recovery_mode`: 是否启用恢复模式（默认 false）

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

#### 代理池配置（可选）

代理池提供了更强的反检测能力和 IP 轮换机制，适用于高频爬取场景：

```bash
# 代理服务器列表（逗号分隔）
PROXY_POOL=proxy1.com:8080,proxy2.com:8080,proxy3.com:8080

# 代理认证（如需要）
PROXY_USERNAME=user
PROXY_PASSWORD=pass

# 代理协议（默认: http）
PROXY_PROTOCOL=http  # 可选: http | https | socks5

# 轮换策略（默认: on-failure）
PROXY_ROTATION_STRATEGY=on-failure  # 可选: round-robin | on-failure | least-latency

# 健康检查配置
PROXY_HEALTH_CHECK_INTERVAL=300000   # 健康检查间隔（毫秒，默认: 5分钟）
PROXY_HEALTH_CHECK_TIMEOUT=10000     # 健康检查超时（毫秒，默认: 10秒）
PROXY_MAX_CONSECUTIVE_FAILURES=3     # 最大连续失败次数（默认: 3）
PROXY_TEST_URL=https://www.google.com  # 健康检查测试 URL
```

**轮换策略说明**:
- `round-robin`: 轮询所有健康代理，平衡负载
- `on-failure`: 使用首选代理直到失败才切换，减少切换开销
- `least-latency`: 自动选择延迟最低的代理，优化性能

**健康检查机制**:
- 定期测试所有代理的可用性
- 连续失败达到阈值后自动标记为不健康
- 成功后重置失败计数并更新延迟统计
- 实时监控代理池状态

**使用建议**:
- 本地开发：使用 `on-failure` 策略 + 较长健康检查间隔（10分钟）
- 生产环境：使用 `least-latency` 策略 + 较短健康检查间隔（3分钟）
- 高频爬取：使用 `round-robin` 策略平衡代理负载

#### 爬虫配置（旧版，JavBus 使用）
```bash
MAX_MOVIES=50              # **必需**：最大爬取影片数（无默认值，必须显式设置）
MAX_PAGES=5                # 最大爬取页数（默认: 5）
USE_RANDOM_MIRROR=true     # 使用随机镜像（默认: false）
```

> **重要**：`MAX_MOVIES` 环境变量现在是必需的，如果未设置将导致脚本错误退出。这是为了防止配置错误导致的意外行为。

#### 增量爬取功能（2026-03-19 新增）

爬虫现在支持智能增量爬取，通过批量状态查询跳过已存在内容，显著提升爬取效率：

- **批量状态查询**：在爬取前调用 `/api/admin/movies/batch-status` 或 `/api/admin/comics/batch-status` 批量查询已存在内容
- **自动过滤**：跳过已存在的影片/漫画，仅爬取新内容
- **增量统计**：实时显示已存在数量、新增数量、增量命中率
- **容错处理**：批量查询失败时自动回退到全量爬取模式

**增量统计示例输出**：
```
📈 爬虫统计:
  运行时间: 180s
  发现影片: 100
  已存在: 60 (60.0%)
  新增: 40 (40.0%)
  处理中: 40
  成功: 38
  失败: 2
  处理速度: 12.67 部/分钟
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

#### 女优/厂商爬虫配置

```bash
# 并发控制
ACTOR_CONCURRENCY=2              # 女优并发数 (默认: 2)
ACTOR_DELAY=8000                 # 女优请求延迟（毫秒，默认: 8000）
PUBLISHER_CONCURRENCY=2          # 厂商并发数 (默认: 2)
PUBLISHER_DELAY=8000             # 厂商请求延迟（毫秒，默认: 8000）

# 数量限制
MAX_ACTORS=150                   # 女优最大爬取数（默认: 100）
MAX_PUBLISHERS=100               # 厂商最大爬取数（默认: 100）

# 恢复模式
RECOVERY_MODE=false              # 是否恢复失败任务（默认: false）
```

**工作流程**:
1. **数据来源**: 女优/厂商从电影爬虫中自动收集（batch-sync）
2. **增量爬取**: 自动跳过已爬取且头像/logo已在 R2 的记录
3. **头像补全**: 已爬取但图片是外链的会自动补全到 R2
4. **优先级排序**: 按作品数量、失败次数、最后尝试时间排序
5. **失败恢复**: 失败任务保存到 `.actor-failed-tasks.json` / `.publisher-failed-tasks.json`

#### 漫画爬虫配置（新版，Comic Crawler 使用）

爬虫会自动检测运行环境（本地 vs CI），并使用相应的默认值。你可以通过环境变量覆盖任何配置：

```bash
# 并发控制
CRAWLER_MANGA_CONCURRENCY=2          # 漫画级并发数 (默认: 2)
CRAWLER_CHAPTER_CONCURRENCY=2        # 章节级并发数 (默认: 2)
CRAWLER_IMAGE_BATCH=10               # 图片批量上传数 (默认: 10)

# 数量限制
CRAWLER_MAX_MANGAS=15                # 每次运行最多处理漫画数 (默认: 15)
CRAWLER_MAX_CHAPTERS_NEW=5           # 新漫画最多处理章节数 (默认: 5)
CRAWLER_MAX_CHAPTERS_UPDATE=20       # 更新漫画最多处理章节数 (默认: 20)

# 软超时（分钟）
CRAWLER_TIMEOUT_MINUTES=300          # 运行软超时时间 (默认: 300)

# 反检测配置（2026-03-13 新增）
CRAWLER_BASE_DELAY=8000              # 基础延迟（毫秒，默认: 8000）
CRAWLER_MAX_RETRIES=3                # 最大重试次数 (默认: 3)
CRAWLER_ENABLE_SESSION=true          # 启用会话管理 (默认: true)
```

**配置说明**:

- **多级并发**: 爬虫同时在漫画、章节、图片三个层级并发处理
  - 默认: 2 × 2 × 10 = 40 并发度
  - 可通过环境变量调整以平衡速度和稳定性

- **数量限制**: 控制每次运行的处理量，避免超时和资源耗尽
  - 新漫画: 限制章节数，避免一次性爬取过多
  - 更新漫画: 连载作品可处理更多新章节

- **增量策略**: 自动跳过已完成且非连载的漫画，优先处理：
  1. 连载中有更新的漫画（最高优先级）
  2. 部分完成的漫画
  3. 新发现的漫画
  4. 已完结的漫画（最低优先级）

- **软超时**: 接近 GitHub Actions 的 6 小时硬超时前优雅退出，避免数据丢失

- **反检测机制** (2026-03-13 新增):
  - **智能延迟**: 基础延迟 + 随机化 + 自适应调整
  - **请求头伪装**: 轮换真实浏览器请求头
  - **Cookie 管理**: 维护会话 Cookie，模拟真实用户
  - **错误重试**: 针对不同错误类型的智能重试策略
  - **成功率监控**: 自动降速机制，成功率 < 70% 时增加延迟
  - **失败恢复**: 自动记录失败任务，支持恢复重试

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

## 🛡️ 反检测与错误恢复

### 反检测机制

爬虫集成了完整的反检测基础设施，有效降低被识别为机器人的风险：

#### 1. Cookie 和会话管理
```typescript
// 自动建立和维护会话
const session = new CrawlerSession(baseUrl)
await session.initialize(page) // 访问首页获取 Cookie
await session.applyCookies(page) // 后续请求应用 Cookie
```

#### 2. 请求头伪装
- 轮换多套真实浏览器请求头
- 包含完整的 `Accept`、`Accept-Language`、`Sec-Fetch-*` 等字段
- 错误时自动更换请求头

#### 3. 智能延迟策略
```typescript
// 三层延迟机制
delay = baseDelay + random(0, randomDelay)

// 错误后增加延迟
if (error) {
  delay *= errorBackoffMultiplier
}

// 成功率低时自动降速
if (successRate < '70%') {
  delay *= autoSlowdownMultiplier
}
```

#### 4. 错误分类与处理

| 错误类型 | 处理策略 | 说明 |
|---------|---------|------|
| ERR_ABORTED | 增加延迟 + 轮换请求头 + 重试 | 连接被主动中止 |
| TIMEOUT | 增加超时时间 + 重试 | 请求超时 |
| CONNECTION_REFUSED | 长时间退避（60秒）| 可能 IP 被封 |
| HTTP_ERROR | 跳过不重试 | 资源不存在 |

#### 5. 成功率监控
- 滑动窗口记录最近 20 次请求
- 实时计算成功率
- 成功率 < 70% 时触发自动降速

### 失败任务恢复

爬虫支持失败任务的自动记录和恢复重试：

#### 自动记录
```bash
# 正常运行，失败任务会自动保存
pnpm --filter @starye/crawler crawl:manga

# 失败任务保存在
# - 漫画爬虫: ./.crawler-failed-tasks.json
# - 电影爬虫: ./.javbus-failed-tasks.json
```

#### 恢复重试
```typescript
// 漫画爬虫恢复模式
const crawler = new ComicCrawler(
  config,
  strategy,
  startUrl,
  { recoveryMode: true }
)
await crawler.run()

// 电影爬虫恢复模式
const crawler = new JavBusCrawler({
  ...config,
  recoveryMode: true
})
await crawler.run()
```

详见: [失败任务恢复文档](./RECOVERY.md)

### 防重复机制

#### 漫画爬虫
- ✅ 批量查询漫画状态
- ✅ 跳过已存在的章节
- ✅ 优先级排序（连载中 > 部分完成 > 新漫画 > 已完成）

#### 电影爬虫
- ✅ 批量查询影片状态
- ✅ 跳过已存在的影片

### 配置示例

#### 漫画爬虫（保守配置）
```bash
CRAWLER_BASE_DELAY=8000         # 8秒基础延迟
CRAWLER_MAX_RETRIES=3           # 最多重试3次
CRAWLER_ENABLE_SESSION=true     # 启用会话管理
CRAWLER_MANGA_CONCURRENCY=2     # 2个漫画并发
```

#### 电影爬虫（稳定配置）
```bash
CRAWLER_BASE_DELAY=6000         # 6秒基础延迟
CRAWLER_MAX_RETRIES=2           # 最多重试2次
DETAIL_CONCURRENCY=2            # 2个详情页并发
```

### 故障排查

#### 问题：频繁出现 ERR_ABORTED 错误
**解决方案**：
1. 增加基础延迟：`CRAWLER_BASE_DELAY=10000`（10秒）
2. 增加重试次数：`CRAWLER_MAX_RETRIES=5`
3. 降低并发度：`CRAWLER_MANGA_CONCURRENCY=1`
4. 检查成功率统计，确保 > 90%

#### 问题：连接被拒绝（CONNECTION_REFUSED）
**解决方案**：
1. 可能 IP 被临时封禁，等待 1-5 分钟后重试
2. 使用恢复模式重试失败任务
3. 考虑降低爬取频率或更换网络

#### 问题：超时错误频繁
**解决方案**：
1. 网络环境不佳，增加超时时间（代码中自动处理）
2. 检查目标网站是否可访问
3. 降低并发度减少网络压力

详见: `openspec/changes/fix-crawler-abort-errors/`

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
