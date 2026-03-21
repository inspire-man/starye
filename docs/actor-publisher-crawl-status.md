# 女优/厂商详情爬取状态追踪

## 概述

当爬虫从电影页面提取到女优和厂商信息时，最初只会获得基本的名称和关联关系。
详细信息（如女优的身高、三围、生日，或厂商的成立年份、简介等）需要单独访问详情页才能获取。

## 数据库字段

`actors` 和 `publishers` 表中都有以下字段：

- `hasDetailsCrawled`: boolean - 标记是否已爬取详情
- `sourceUrl`: string - 详情页 URL
- `crawlFailureCount`: int - 爬取失败次数

## 如何查看爬取状态

### 1. 管理端 - 统计信息

访问管理端的 `/actors` 或 `/publishers` 页面，顶部会显示统计卡片：

```
┌─────────────────┬─────────────────┬─────────────────┐
│  总女优数       │  已爬取详情     │  待爬取详情     │
│  1,234          │  1,000 (81%)    │  234            │
│                 │                 │  其中 180 个    │
│                 │                 │  有详情页链接   │
└─────────────────┴─────────────────┴─────────────────┘
```

**说明**：
- "待爬取详情"：`hasDetailsCrawled = false` 的数量
- "其中 X 个有详情页链接"：有 `sourceUrl` 的数量，这些可以被爬虫补全

### 2. 管理端 - 过滤待爬取

勾选"仅显示待爬取详情"复选框，可以快速查看哪些女优/厂商还缺少详情。

### 3. 客户端 - 详情页提示

访问女优或厂商详情页时，如果 `hasDetailsCrawled = false`，会显示黄色提示框：

```
┌────────────────────────────────┐
│ ⚠️  详细信息待补全              │
└────────────────────────────────┘
```

## API 端点

### 查询女优列表（带过滤）

```http
GET /api/admin/actors?onlyPending=true&page=1&limit=50
```

**参数**：
- `onlyPending`: "true" 仅返回 `hasDetailsCrawled = false` 的女优

### 查询统计信息

```http
GET /api/admin/actors/stats
```

**响应**：
```json
{
  "total": 1234,
  "crawled": 1000,
  "pending": 234,
  "withSourceUrl": 180,
  "crawledPercentage": 81
}
```

厂商使用相同的接口模式：
- `/api/admin/publishers?onlyPending=true`
- `/api/admin/publishers/stats`

## 爬虫行为

### 电影同步时

1. 爬虫从电影页面提取女优和厂商名称
2. 调用 `POST /api/movies/sync` 同步数据
3. API 检查数据库中是否已存在该女优/厂商：
   - 如果已存在：增加 `movieCount`
   - 如果不存在：创建新记录，`hasDetailsCrawled = false`

### 增量更新检测

当爬虫遇到已存在的电影（通过 `code` 匹配）时：
- ✅ **电影本身**：跳过爬取
- ❌ **女优/厂商详情**：不会主动检查是否需要补全

这意味着：如果一部电影已存在，但其关联的女优/厂商还没有详情，爬虫不会自动去补全。

## 如何补全女优/厂商详情

### 方案 1：重新运行完整爬虫（不推荐）

删除电影记录后重新爬取，会重新创建女优/厂商关联并尝试爬取详情。

### 方案 2：开发专门的详情爬虫（推荐）

创建一个独立的爬虫脚本：

```typescript
// packages/crawler/scripts/crawl-actor-details.ts

async function crawlActorDetails() {
  // 查询所有 hasDetailsCrawled = false 且有 sourceUrl 的女优
  const actors = await api.getActors({ onlyPending: true })
  
  for (const actor of actors) {
    if (!actor.sourceUrl) continue
    
    try {
      // 访问详情页，提取详细信息
      const details = await scrapeActorDetails(actor.sourceUrl)
      
      // 更新数据库
      await api.updateActor(actor.id, {
        ...details,
        hasDetailsCrawled: true
      })
    }
    catch (error) {
      // 增加失败计数
      await api.updateActor(actor.id, {
        crawlFailureCount: actor.crawlFailureCount + 1
      })
    }
  }
}
```

### 方案 3：在电影爬虫中添加详情补全逻辑

修改 `JavBusCrawler`，在处理每部电影时：

```typescript
async processMovie(movie) {
  // 1. 同步电影基本信息
  await this.syncMovie(movie)
  
  // 2. 检查女优详情是否需要补全
  for (const actorName of movie.actors) {
    const actor = await api.getActorByName(actorName)
    if (actor && !actor.hasDetailsCrawled && actor.sourceUrl) {
      await this.crawlActorDetails(actor)
    }
  }
  
  // 3. 检查厂商详情是否需要补全
  if (movie.publisher) {
    const publisher = await api.getPublisherByName(movie.publisher)
    if (publisher && !publisher.hasDetailsCrawled && publisher.sourceUrl) {
      await this.crawlPublisherDetails(publisher)
    }
  }
}
```

## 总结

- **查看状态**：使用管理端的统计卡片和过滤选项
- **跟踪进度**：`hasDetailsCrawled` 字段明确标记是否已补全
- **识别可爬取**：`sourceUrl` 字段判断是否有详情页链接
- **客户端体验**：未补全的详情会显示黄色提示，不会影响基本功能
