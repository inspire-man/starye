## Context

当前爬虫架构完全串行，单次爬取需要 67 小时。目标环境是 GitHub Actions (ubuntu-latest)，资源限制为 2 核 CPU、7GB 内存、6 小时超时。需要在这些约束下实现每日增量爬取。

**当前架构痛点**：
- 漫画、章节、图片三层循环全部使用 `for...await`，完全串行
- 没有爬取状态管理，每次都从头开始
- 单个 Puppeteer Page 实例被串行复用
- 图片处理（下载 + Sharp + R2上传）串行执行，单章节 250 张图需 14 分钟

**技术约束**：
- GitHub Actions 共享网络带宽，过高并发可能不稳定
- 源站（92hm.life）可能有反爬机制，需保守并发
- 内存限制 7GB，需控制并发避免 OOM
- 爬虫运行在 Node.js 环境（非 Cloudflare Workers）

## Goals / Non-Goals

**Goals:**
- 首次全量爬取能在 6 小时内完成（通过分批策略）
- 每日增量爬取控制在 1 小时内
- 图片处理速度提升 20x（批量并发）
- 支持断点续传，超时时能保存进度
- 保守的并发策略，避免触发反爬
- 可配置的并发参数，适应不同环境

**Non-Goals:**
- 不实现分布式爬取（单机够用）
- 不做复杂的反爬对抗（User-Agent + Referer 足够）
- 不优化 Puppeteer 性能（HappyDOM 已做快速路径）
- 不改变数据模型结构（只增字段不改表）
- 不支持手动触发时的实时进度推送

## Decisions

### 决策 1: 三级并发控制架构

**决定**：采用 `p-map` 实现漫画级、章节级、图片级三层并发控制。

```typescript
// 级别 1: 漫画并发 (2)
await pMap(mangas, async (manga) => {
  // 级别 2: 章节并发 (2)
  await pMap(chapters, async (chapter) => {
    // 级别 3: 图片批量并发 (10)
    const batches = chunk(images, 10)
    for (const batch of batches) {
      await Promise.all(batch.map(processImage))
    }
  }, { concurrency: 2 })
}, { concurrency: 2 })
```

**备选方案**：
- 方案 A: 使用 Worker Threads
  - ❌ 复杂度高，Puppeteer 在 Worker 中不稳定
- 方案 B: 子进程池
  - ❌ 启动开销大，GitHub Actions 资源有限
- 方案 C: async-pool
  - ✅ 类似但 p-map 更简洁，功能更丰富

**为什么选 p-map**：
- 轻量级，无额外进程开销
- 支持并发控制、错误处理、映射结果
- 社区成熟（7M+ 周下载量）

### 决策 2: 增量爬取的数据库设计

**决定**：在 `comics` 表增加爬取状态字段，不新建表。

```typescript
// packages/db/schema.ts
export const comics = sqliteTable('comics', {
  // 现有字段...
  crawlStatus: text('crawl_status')
    .$type<'pending' | 'partial' | 'complete'>()
    .default('pending'),
  lastCrawledAt: integer('last_crawled_at', { mode: 'timestamp' }),
  totalChapters: integer('total_chapters').default(0),
  crawledChapters: integer('crawled_chapters').default(0),
  isSerializing: integer('is_serializing', { mode: 'boolean' }).default(true),
})
```

**备选方案**：
- 方案 A: 新建 `crawl_queue` 表
  - ❌ 增加表关联复杂度，查询变慢
- 方案 B: 使用 Redis 缓存状态
  - ❌ 项目没有 Redis，增加依赖成本

**为什么不新建表**：
- 状态与漫画强相关，1:1 关系
- 避免 JOIN 查询，性能更好
- 简化 API 逻辑，单表查询即可

### 决策 3: 保守并发参数

**决定**：基于 GitHub Actions 环境设置固定并发数。

```typescript
const CRAWL_CONFIG = {
  concurrency: {
    manga: 2,        // 2 个漫画并发
    chapter: 2,      // 每个漫画 2 章并发
    imageBatch: 10,  // 每批 10 张图片
  },
  limits: {
    maxMangasPerRun: 15,       // 每次最多 15 个漫画
    maxChaptersPerNew: 5,      // 新漫画限制 5 章
    maxChaptersPerUpdate: 20,  // 更新时限制 20 章
    timeoutMinutes: 300,       // 5 小时软超时
  },
}
```

**备选方案**：
- 方案 A: 动态自适应并发
  - ❌ 复杂度高，需监控内存/CPU
- 方案 B: 激进并发 (5/5/20)
  - ❌ 容易触发反爬，不稳定

**为什么保守**：
- GitHub Actions 资源共享，不稳定
- 源站可能限流，保守策略更可靠
- 2x2x10 = 40 并发已足够（相比当前 1）

### 决策 4: API 批量查询设计

**决定**：新增批量状态查询端点，减少网络往返。

```typescript
// GET /api/admin/comics/batch-status?slugs=manga1,manga2,...
{
  "manga1": {
    exists: true,
    status: "partial",
    crawledChapters: 5,
    totalChapters: 45,
    lastCrawledAt: "2026-03-10T10:00:00Z"
  },
  "manga2": { ... }
}
```

**备选方案**：
- 方案 A: 保持单个查询
  - ❌ 28 个漫画 = 28 次 API 调用，慢
- 方案 B: GraphQL
  - ❌ 项目没有 GraphQL，过度设计

**为什么批量查询**：
- 28 次请求 → 1 次请求，节省 ~5-10 秒
- 减少 Cloudflare Workers CPU 时间消耗
- 简单实现，RESTful 风格

### 决策 5: 断点续传策略

**决定**：使用"软超时"机制，5 小时后停止接收新任务。

```typescript
const startTime = Date.now()
const SOFT_TIMEOUT = 5 * 60 * 60 * 1000 // 5 小时

for (const manga of mangas) {
  if (Date.now() - startTime > SOFT_TIMEOUT) {
    console.log('⏰ 接近超时，停止新任务')
    break
  }
  await processManga(manga)
}
```

**备选方案**：
- 方案 A: 硬超时（process.exit）
  - ❌ 可能丢失正在处理的数据
- 方案 B: 持久化任务队列
  - ❌ 复杂度高，需要外部存储

**为什么软超时**：
- 简单可靠，不丢数据
- 利用 GitHub Actions 的 6 小时限制
- 下次运行时自动继续（基于数据库状态）

## Risks / Trade-offs

### 风险 1: 内存溢出 (OOM)
**[风险]** 2 漫画 × 2 章节 × 10 图片 × 2MB = ~80MB 缓冲，Sharp 处理时膨胀 3-4x = ~320MB。如果并发过高或图片过大，可能 OOM。

**[缓解]**:
- 监控实际内存使用（console.log memory usage）
- 设置 `--max-old-space-size=5120` (5GB limit)
- 及时释放 Buffer（处理完立即 null）
- 图片批次大小可配置，发现问题可降低

### 风险 2: 源站反爬触发
**[风险]** 40 并发下载可能触发 92hm.life 的限流或封 IP。

**[缓解]**:
- 保守并发策略（2/2/10）
- User-Agent + Referer 模拟浏览器
- 失败后自动重试 (5 次，指数退避)
- 监控失败率，超过 20% 自动降速

### 风险 3: 数据不一致
**[风险]** 并发更新同一漫画的状态字段可能产生竞争。

**[缓解]**:
- 漫画级别串行（2 并发，不会同时更新同一个）
- 状态更新使用原子操作（SQLite 事务）
- 章节完成后批量更新计数，而非逐个

### 风险 4: 首次运行仍然很慢
**[风险]** 即使并发优化，全量爬取仍可能超 6 小时。

**[缓解]**:
- 分批策略：每次最多 15 个漫画
- 新漫画限制 5 章（后续渐进完成）
- 优先处理连载中的漫画
- 记录进度，多天完成初始化

### Trade-off 1: 配置复杂度 vs 灵活性
**[取舍]** 为了适应不同环境，引入配置系统增加了代码复杂度。

**[权衡]**:
- 获得：可在本地/CI 切换策略，方便调试
- 失去：代码行数增加 ~100 行
- **决定**：接受复杂度，配置带来的灵活性更重要

### Trade-off 2: 数据完整性 vs 速度
**[取舍]** 新漫画只爬 5 章，用户会看到不完整的数据。

**[权衡]**:
- 获得：首次运行能在时限内完成
- 失去：用户体验下降（部分章节缺失）
- **决定**：添加 UI 标识"正在更新中..."，用户知情

### Trade-off 3: 串行 Page vs 多 Page 实例
**[取舍]** 继续使用单个 Page 实例（串行），而非为每个漫画创建独立 Page。

**[权衡]**:
- 获得：节省内存（每个 Page ~100MB），避免 Puppeteer 不稳定
- 失去：漫画级并发受限（只能在 API/图片层并发）
- **决定**：当前 2 漫画并发已足够，不需要多 Page

## Migration Plan

**部署步骤**：

1. **数据库迁移** (无停机)
   ```bash
   # 1. 生成迁移文件
   pnpm --filter @starye/db generate
   
   # 2. 执行迁移（添加新字段，默认值兼容）
   pnpm --filter @starye/db migrate
   
   # 3. 验证字段存在
   wrangler d1 execute starye-db --command "PRAGMA table_info(comics);"
   ```

2. **API 端点部署** (向后兼容)
   - 新增端点不影响现有调用
   - 部署到生产环境
   - 验证 `/api/admin/comics/batch-status` 可访问

3. **爬虫代码部署** (渐进式)
   - 先部署到 dev 分支测试
   - 手动触发 `workflow_dispatch` 验证
   - 观察日志和性能指标
   - 确认无问题后合并到 main

4. **灰度策略** (可选)
   - 第一天：限制 5 个漫画
   - 第二天：限制 10 个漫画
   - 第三天：全量 15 个漫画

**回滚策略**：

- **代码回滚**：Git revert 相关 commit
- **数据库回滚**：新字段可为 NULL，不影响原有逻辑
- **配置回滚**：将 `CRAWL_CONFIG.concurrency` 全部设为 1（恢复串行）
- **Fallback 模式**：代码中保留 `LEGACY_MODE` 开关，可紧急切回旧逻辑

**监控指标**：

- 爬取时长（期望 < 6h）
- 成功率（期望 > 95%）
- 内存峰值（期望 < 5GB）
- 失败任务数（期望 < 5%）
- API 响应时间（批量查询 < 500ms）

## Open Questions

1. **章节限制策略确认**
   - ❓ 新漫画限制 5 章是否合理？还是应该 10 章？
   - 建议：根据第一次运行实际耗时调整

2. **失败重试的持久化**
   - ❓ 是否需要记录失败的漫画/章节到数据库？
   - 当前方案：失败后下次自动重试（基于状态）
   - 替代方案：新建 `failed_tasks` 表记录失败原因

3. **通知机制**
   - ❓ 爬取完成后是否需要通知（Discord/Slack）？
   - 当前方案：仅 GitHub Actions Summary
   - 后续可扩展 Webhook

4. **优先级算法**
   - ❓ "连载中 + 有新章节"如何判断？
   - 建议：`isSerializing = true AND lastCrawledAt < NOW() - 7 days`

5. **图片去重**
   - ❓ 是否需要检查 R2 中图片是否已存在？
   - 当前方案：基于章节级别跳过（章节存在则图片已存在）
   - 潜在优化：检查 R2 key 避免重复上传
