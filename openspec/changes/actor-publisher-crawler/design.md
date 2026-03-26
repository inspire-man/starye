## Context

当前电影爬虫（`JavBusCrawler`）在爬取电影详情页时已经解析了女优详情页 URL（`actorDetails`）和厂商详情页 URL（`publisherUrl`），但这些 URL 仅用于创建基础记录，未进行后续的详情爬取。数据库中 actors 表有 1000+ 记录，publishers 表有 500+ 记录，但大部分记录的 `hasDetailsCrawled=false`，缺失头像、简介等关键信息。

**当前状态：**
- `JavBusStrategy` 已实现 `crawlActorDetails()` 和 `crawlPublisherDetails()` 方法
- actors 表：`hasDetailsCrawled=false` 约占 80%
- publishers 表：`hasDetailsCrawled=false` 约占 85%
- 电影爬虫每天 00:00 UTC 运行，漫画爬虫每天 18:00 UTC 运行
- 已有 `FailedTaskRecorder`、`OptimizedCrawler`、批量查询等基础设施

**约束条件：**
- GitHub Actions 单次运行最大 6 小时超时
- JavBus 反爬机制严格，需要较长延迟（8-10秒/请求）
- 需避免与现有爬虫时间冲突
- 头像图片非必需，失败不应阻塞整体流程

## Goals / Non-Goals

**Goals:**
- 实现独立的女优爬虫和厂商爬虫，完全复用现有架构模式
- 支持增量爬取（跳过已完成记录）
- 实现优先级排序（高热度优先）
- 支持失败恢复机制
- 提供详细的数据完整度统计
- 女优爬虫目标：150 个/天，成功率 >90%，头像覆盖率 >95%
- 厂商爬虫目标：100 个/天，成功率 >90%，Logo 覆盖率 >90%

**Non-Goals:**
- 不修改现有电影爬虫的核心逻辑（仅添加 URL 同步）
- 不实现实时爬取（保持定时任务模式）
- 不为女优/厂商添加播放源等复杂数据（仅基础元数据）
- 不在本次变更中实现"补全模式"（已爬取但数据不完整的记录）

## Decisions

### 决策 1：独立爬虫 vs 集成到电影爬虫

**选择：独立爬虫**

**理由：**
- 解耦：电影、女优、厂商爬虫独立运行，互不影响
- 灵活调度：可单独触发女优爬虫而不影响电影爬虫
- 增量友好：女优/厂商数据积累后，可独立补全历史数据
- 失败隔离：女优爬虫失败不影响电影数据入库

**替代方案：**
- 在电影爬虫中内联爬取：会显著延长电影爬虫运行时间，且重复爬取同一女优

### 决策 2：时间调度策略

**选择：电影 → 女优 → 厂商，错峰 2 小时**

**时间安排：**
- 电影爬虫：00:00 UTC (08:00 UTC+8)
- 女优爬虫：00:00 UTC (08:00 UTC+8)，电影爬虫结束后
- 厂商爬虫：08:00 UTC (16:00 UTC+8)

**理由：**
- 电影爬虫先运行，产生女优/厂商 URL 数据源
- 女优爬虫紧接着运行，利用新鲜数据
- 厂商爬虫延后，避免连续高负载
- 避开漫画爬虫时间（18:00 UTC）

**替代方案：**
- 全部在一个 workflow 中顺序执行：超过 6 小时限制风险高

### 决策 3：优先级排序策略

**选择：movieCount DESC + crawlFailureCount ASC**

**排序公式：**
```typescript
priority = movieCount * 10 - crawlFailureCount * 20 + newActorBonus
newActorBonus = lastCrawlAttempt === null ? 15 : 0
```

**理由：**
- 高热度女优优先（movieCount 大的用户关注度高）
- 惩罚多次失败记录（crawlFailureCount 高的可能是无效 URL）
- 新女优加成（从未尝试过的记录优先处理）

**替代方案：**
- FIFO：简单但不考虑热度
- 随机：无法保证高价值数据优先处理

### 决策 4：批量查询 vs 逐个查询

**选择：批量查询（batchQueryActorStatus）**

**理由：**
- 避免 N+1 查询问题
- 参考漫画爬虫和电影爬虫的成功实践
- 单次 API 调用查询 100+ 记录，响应时间 <1000ms

**API 设计：**
```
GET /api/admin/actors/batch-status?ids=id1,id2,id3
Response: { "id1": { exists: true, hasDetailsCrawled: false, ... }, ... }
```

### 决策 5：数据完整性验证

**选择：完整度评分机制**

**字段权重：**
- 女优：avatar (25%), bio (20%), birthDate (15%), height (15%), measurements (10%), nationality (15%)
- 厂商：logo (30%), website (20%), description (20%), foundedYear (15%), country (15%)

**完整度阈值：**
- `< 0.3`：数据过少，标记失败并重试
- `0.3 - 0.7`：基本可用
- `> 0.7`：数据良好

**理由：**
- 确保数据质量，避免空记录
- 头像/Logo 权重最高但非必需（失败不阻塞）
- 为未来的"补全模式"提供指标

### 决策 6：头像处理策略

**选择：非必需字段，失败不阻塞**

**实现：**
```typescript
try {
  details.avatar = await downloadAvatar(...)
} catch {
  // 记录警告但继续
  console.warn('头像下载失败，继续处理其他字段')
}
```

**理由：**
- 头像 URL 可能失效、CDN 不稳定
- 其他元数据（简介、生日）更关键
- 符合用户要求："头像非必须"

### 决策 7：失败重试策略

**选择：三级重试 + 永久失败标记**

**重试规则：**
- `crawlFailureCount = 0`：正常队列
- `crawlFailureCount = 1-2`：低优先级队列，延迟重试
- `crawlFailureCount >= 3`：标记为永久失败，跳过（需人工介入）

**恢复模式：**
```bash
pnpm crawl:actor --recovery  # 重试 crawlFailureCount <= 2 的记录
```

**理由：**
- 避免无限重试浪费资源
- 3 次失败通常表示 URL 无效或被封禁
- 恢复模式允许手动干预后重试

### 决策 8：并发与延迟配置

**选择：参考电影爬虫配置**

**配置值：**
- 女优爬虫：concurrency=2, delay=8000ms
- 厂商爬虫：concurrency=2, delay=8000ms

**理由：**
- JavBus 对女优/厂商页面的反爬与电影页面类似
- 已在电影爬虫中验证，成功率 >90%
- GitHub Actions 环境资源有限，保守配置

## Risks / Trade-offs

### [风险] JavBus 女优页面结构变化

**问题：** `crawlActorDetails()` 依赖固定的 DOM 结构，页面改版会导致解析失败

**缓解：**
- 在爬虫中添加结构验证（检查关键元素是否存在）
- 失败率超过 50% 时发送告警
- 失败记录保存到 `.actor-failed-tasks.json`，便于调试

---

### [风险] 电影爬虫未同步 URL

**问题：** 如果电影爬虫在女优爬虫前未成功同步 `actorDetails` URL，女优爬虫无数据可爬

**缓解：**
- 女优爬虫启动时检查待爬取数量，若 < 10 则跳过（避免空运行）
- 电影爬虫添加 URL 同步成功日志
- 监控 actors 表的 `sourceUrl IS NOT NULL` 数量

---

### [权衡] 数据新鲜度 vs 爬取频率

**权衡：** 每天运行一次可能无法及时补全新女优

**决策：**
- 优先保证稳定性，避免频繁爬取触发封禁
- 电影爬虫每天产生 ~20 个新女优，女优爬虫处理 150 个，足够覆盖
- 未来可扩展：每周运行一次"全量补全模式"

---

### [权衡] 优先级排序 vs 公平性

**权衡：** 高热度女优优先，可能导致低热度女优长期未爬取

**决策：**
- 接受这个权衡，高热度数据对用户价值更大
- 新女优加成机制确保所有女优至少被尝试一次
- 未来可添加"最久未爬取"维度平衡

---

### [风险] GitHub Actions 超时

**问题：** 女优爬虫处理 150 个，按 8 秒/个，需 20 分钟。但包含失败重试、API 调用，可能接近 1 小时

**缓解：**
- 设置 `maxActors` 限制（150 个）
- 软超时检测（接近 5.5 小时时优雅退出）
- 失败任务保存到文件，下次运行或恢复模式处理

## Migration Plan

### Phase 1：API 端口开发（第 1-2 天）

**新增端口：**
1. `GET /api/admin/actors/batch-status?ids=...`
2. `GET /api/admin/publishers/batch-status?ids=...`
3. `GET /api/admin/actors/pending?limit=150`
4. `GET /api/admin/publishers/pending?limit=100`
5. `POST /api/admin/actors/:id/details`
6. `POST /api/admin/publishers/:id/details`

**实现步骤：**
1. 在 `apps/api/src/routes/admin/actors/index.ts` 添加端口
2. 在 `apps/api/src/routes/admin/publishers/index.ts` 添加端口
3. 添加 Valibot schemas 到 `apps/api/src/schemas/admin.ts`
4. 测试：使用 Postman/curl 验证响应格式
5. 性能测试：批量查询 100 个 ID，响应时间 <1000ms

### Phase 2：爬虫核心开发（第 3-5 天）

**新增文件：**
- `packages/crawler/src/crawlers/actor-crawler.ts`
- `packages/crawler/src/crawlers/publisher-crawler.ts`
- `packages/crawler/scripts/run-actor.ts`
- `packages/crawler/scripts/run-publisher.ts`

**实现步骤：**
1. 创建 `ActorCrawler` 类
   - 继承 `OptimizedCrawler` 或直接使用 `pMap` + `BrowserManager`
   - 实现 `fetchPendingActors()`, `sortByPriority()`, `processActor()`
   - 集成 `FailedTaskRecorder`
   - 添加数据完整度统计
2. 创建 `PublisherCrawler` 类（结构类似）
3. 扩展 `ApiClient`
   - 添加 `fetchPendingActors()`, `batchQueryActorStatus()`, `syncActorDetails()`
4. 本地测试
   - 使用 `pnpm crawl:actor --max=5` 测试小批量
   - 验证失败恢复：`pnpm crawl:actor --recovery`

### Phase 3：电影爬虫改造（第 6 天）

**修改文件：**
- `packages/crawler/src/crawlers/javbus.ts`

**改造点：**
1. 在 `getMovieInfo()` 后收集 `actorDetails` 和 `publisherUrl`
2. 添加 `syncActorsAndPublishers()` 方法
   - 批量调用 `/api/admin/actors/sync` 和 `/api/admin/publishers/sync`
   - 创建或更新 actors/publishers 记录，设置 `sourceUrl` 和 `hasDetailsCrawled=false`
3. 在 `run()` 结束前调用该方法
4. 添加统计日志

### Phase 4：GitHub Actions 配置（第 7 天）

**新增文件：**
- `.github/workflows/daily-actor-crawl.yml`
- `.github/workflows/daily-publisher-crawl.yml`

**配置要点：**
- 时间：女优 00:00 UTC，厂商 08:00 UTC
- 超时：360 分钟（6 小时）
- 环境变量：复用 movie crawl 配置
- 日志上传：保存 `.actor-failed-tasks.json` 为 artifact

**workflow_dispatch 参数：**
- `max_actors`: 默认 150
- `max_publishers`: 默认 100
- `recovery_mode`: 是否恢复模式

### Phase 5：测试与调优（第 8-9 天）

**测试清单：**
- [ ] 本地测试：女优爬虫 10 个，检查数据完整性
- [ ] 本地测试：厂商爬虫 10 个，检查数据完整性
- [ ] 本地测试：失败恢复模式
- [ ] GitHub Actions 测试：手动触发 workflow，观察运行时间
- [ ] API 性能测试：批量查询响应时间
- [ ] 数据验证：抽样检查数据库中女优/厂商数据完整度

**调优项：**
- 根据实际成功率调整 `maxActors` 和 `maxPublishers`
- 根据响应时间调整 `delay` 配置
- 优化优先级排序公式权重

### Rollback 策略

**如遇严重问题：**
- **Phase 1-2 失败**：删除新增 API 端口和爬虫文件，不影响现有系统
- **Phase 3 失败**：回滚电影爬虫改动（git revert），女优/厂商爬虫仍可独立运行
- **Phase 4-5 失败**：禁用 GitHub Actions workflows，手动触发爬虫

## Technical Details

### ActorCrawler 核心结构

```typescript
export class ActorCrawler {
  private browserManager: BrowserManager
  private apiClient: ApiClient
  private strategy: JavBusStrategy
  private failedTasks = new FailedTaskRecorder()
  
  private stats = {
    totalActors: 0,
    processedActors: 0,
    skippedActors: 0,
    failedActors: 0,
    dataCompleteness: {
      hasAvatar: 0,
      hasBio: 0,
      hasBirthDate: 0,
    },
  }
  
  async run() {
    // 1. 获取待爬取列表
    const pendingActors = await this.apiClient.fetchPendingActors(150)
    
    // 2. 优先级排序
    const sorted = this.sortByPriority(pendingActors)
    
    // 3. 并发爬取
    await pMap(sorted, async (actor) => {
      await this.processActor(actor)
    }, { concurrency: 2 })
    
    // 4. 统计报告
    this.printStats()
  }
  
  private sortByPriority(actors: Actor[]): Actor[] {
    return actors.toSorted((a, b) => {
      const scoreA = this.calculatePriority(a)
      const scoreB = this.calculatePriority(b)
      return scoreB - scoreA
    })
  }
  
  private calculatePriority(actor: Actor): number {
    let score = actor.movieCount * 10
    score -= actor.crawlFailureCount * 20
    if (!actor.lastCrawlAttempt) score += 15
    return score
  }
  
  private async processActor(actor: Actor) {
    const page = await this.browserManager.createPage()
    
    try {
      const details = await this.strategy.crawlActorDetails(actor.sourceUrl, page)
      
      if (!details) throw new Error('解析失败')
      
      // 数据完整性检查
      const completeness = this.calculateCompleteness(details)
      if (completeness < 0.3) {
        throw new Error(`数据过少 (${(completeness * 100).toFixed(0)}%)`)
      }
      
      // 同步到 API
      await this.apiClient.syncActorDetails(actor.id, details)
      
      this.stats.processedActors++
      this.updateDataCompletenessStats(details)
    } 
    catch (error) {
      this.failedTasks.record(actor.sourceUrl, error, actor.crawlFailureCount + 1)
      this.stats.failedActors++
    }
    finally {
      await page.close()
    }
  }
  
  private calculateCompleteness(details: ActorDetails): number {
    const fields = ['avatar', 'bio', 'birthDate', 'height', 'measurements', 'nationality']
    const weights = [0.25, 0.20, 0.15, 0.15, 0.10, 0.15]
    
    let score = 0
    fields.forEach((field, i) => {
      if (details[field]) score += weights[i]
    })
    
    return score
  }
}
```

### API 端口实现

**批量状态查询：**
```typescript
adminActors.get('/batch-status', serviceAuth(['admin']), async (c) => {
  const idsParam = c.req.query('ids')
  const ids = idsParam.split(',').map(s => s.trim()).filter(Boolean)
  
  const results = await db.query.actors.findMany({
    where: (actors, { inArray }) => inArray(actors.id, ids),
    columns: {
      id: true,
      hasDetailsCrawled: true,
      crawlFailureCount: true,
      movieCount: true,
      lastCrawlAttempt: true,
      sourceUrl: true,
    },
  })
  
  const statusMap: Record<string, ActorStatus> = {}
  for (const id of ids) {
    const result = results.find(r => r.id === id)
    statusMap[id] = result ? { exists: true, ...result } : { exists: false }
  }
  
  return c.json(statusMap)
})
```

**待爬取列表：**
```typescript
adminActors.get('/pending', serviceAuth(['admin']), async (c) => {
  const limit = Number(c.req.query('limit') || 150)
  
  const actors = await db.query.actors.findMany({
    where: and(
      eq(actors.hasDetailsCrawled, false),
      isNotNull(actors.sourceUrl),
      lt(actors.crawlFailureCount, 3),
    ),
    orderBy: [
      desc(actors.movieCount),
      asc(actors.crawlFailureCount),
      asc(actors.lastCrawlAttempt),
    ],
    limit,
  })
  
  return c.json({
    actors,
    total: actors.length,
    highPriority: actors.filter(a => a.movieCount >= 10).length,
  })
})
```

### 电影爬虫 URL 同步

```typescript
// 在 JavBusCrawler.run() 中
private collectedActorDetails: Map<string, ActorDetail> = new Map()
private collectedPublisherUrls: Map<string, string> = new Map()

// 在 processMovie() 后收集
private async processMovie(url: string, page: Page) {
  const movieInfo = await this.getMovieInfo(url, page)
  
  // 收集女优 URL
  movieInfo.actorDetails?.forEach(detail => {
    if (!this.collectedActorDetails.has(detail.name)) {
      this.collectedActorDetails.set(detail.name, detail)
    }
  })
  
  // 收集厂商 URL
  if (movieInfo.publisherUrl) {
    const publisherName = movieInfo.publisher
    if (!this.collectedPublisherUrls.has(publisherName)) {
      this.collectedPublisherUrls.set(publisherName, movieInfo.publisherUrl)
    }
  }
  
  // ... 继续处理
}

// 在 run() 结束前同步
private async syncActorsAndPublishers() {
  console.log('\n📊 同步女优和厂商数据...')
  
  // 批量同步女优
  await this.apiClient.sync('/api/admin/actors/batch-sync', {
    actors: Array.from(this.collectedActorDetails.values()),
  })
  
  // 批量同步厂商
  await this.apiClient.sync('/api/admin/publishers/batch-sync', {
    publishers: Array.from(this.collectedPublisherUrls.entries()).map(([name, url]) => ({
      name,
      sourceUrl: url,
    })),
  })
  
  console.log(`✅ 女优: ${this.collectedActorDetails.size} 个`)
  console.log(`✅ 厂商: ${this.collectedPublisherUrls.size} 个`)
}
```

### GitHub Actions Workflow

```yaml
name: Daily Actor Crawl

on:
  schedule:
    - cron: '0 0 * * *'  # 每天 00:00 UTC (08:00 UTC+8)
  workflow_dispatch:
    inputs:
      max_actors:
        description: '最大爬取女优数'
        required: false
        default: '150'
      recovery_mode:
        description: '恢复模式'
        required: false
        default: 'false'

jobs:
  crawl:
    runs-on: ubuntu-latest
    timeout-minutes: 360
    
    steps:
      - name: Checkout
        uses: actions/checkout@v6
      
      # ... (Chrome 安装等)
      
      - name: Run Actor Crawler
        env:
          API_URL: ${{ secrets.API_URL }}
          CRAWLER_SECRET: ${{ secrets.CRAWLER_SECRET }}
          MAX_ACTORS: ${{ inputs.max_actors || '150' }}
          RECOVERY_MODE: ${{ inputs.recovery_mode || 'false' }}
          ACTOR_CONCURRENCY: '2'
          ACTOR_DELAY: '8000'
        run: |
          if [ "$RECOVERY_MODE" = "true" ]; then
            pnpm --filter @starye/crawler run crawl:actor --recovery
          else
            pnpm --filter @starye/crawler run crawl:actor
          fi
      
      - name: Upload Logs
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: actor-crawler-logs-${{ github.run_number }}
          path: packages/crawler/.actor-failed-tasks.json
```

## Open Questions

1. **是否需要"补全模式"**：爬取 `hasDetailsCrawled=true` 但数据不完整的记录？（建议：Phase 2 添加）

2. **是否需要为女优/厂商添加图片变体**：如 thumb/preview？（建议：Phase 1 仅上传原图）

3. **是否需要独立的 crawler-admin 接口**：查看爬虫统计、触发恢复等？（建议：Phase 2 添加）

4. **厂商 Logo 下载失败率预期**：如果 Logo 失败率 >50%，是否调整为非必需？（建议：观察 Phase 1 数据后决策）
