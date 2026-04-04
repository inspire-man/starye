## Context

当前数据流：

```
JavBus Crawler
  └── getMovieInfo() → players: []          ← JavBus 无播放源（元数据站）
        └── apiClient.syncMovie()
              └── POST /api/movies/sync
                    └── syncMovieData()     ← 不处理 players 字段（根本原因）
                          └── DB: players 表为空
```

Admin sync（已正确实现 players 写入）但爬虫未调用：
```
POST /api/admin/sync → syncCrawlerData() → syncMovieData() in admin/sync/handlers.ts
  ✓ const { players: playerData, ...movieData } = data
  ✓ db.insert(players).values(...)
```

## Changes

### 1. 修复同步服务（`sync.service.ts`）

扩展 `SyncMovieDataOptions` 类型，添加可选 `players` 字段：

```typescript
export interface SyncMovieDataOptions {
  movies: Array<{
    code: string
    title: string
    // ... 现有字段
    players?: Array<{
      sourceName: string
      sourceUrl: string
      quality?: string
      sortOrder?: number
    }>
  }>
  mode?: 'upsert' | 'insert' | 'update'
}
```

在 `syncMovieData()` 中，影片 upsert 成功后，若 `players` 非空则写入 `players` 表：

```typescript
// 写入 players
if (movieData.players && movieData.players.length > 0) {
  await db.delete(playersTable).where(eq(playersTable.movieId, existingMovie?.id ?? insertedId))
  await db.insert(playersTable).values(
    movieData.players.map((p, idx) => ({
      id: crypto.randomUUID(),
      movieId: existingMovie?.id ?? insertedId,
      sourceName: p.sourceName,
      sourceUrl: p.sourceUrl,
      quality: p.quality ?? null,
      sortOrder: p.sortOrder ?? idx,
    }))
  )
}
```

### 2. 新增播放源补充脚本（`enrich-players.ts`）

独立脚本，用于对已入库但无播放源的影片，从 JavDB 批量补爬磁力链接：

```
输入：通过 /api/admin/movies?hasPlayers=false 获取缺少播放源的影片 code 列表
处理：用 JavDB 策略搜索每个 code，提取磁力链接
输出：调用 POST /api/movies/sync 批量写入 players
```

脚本位置：`packages/crawler/src/scripts/enrich-players.ts`

运行方式：
```bash
pnpm crawl:enrich-players --limit 100 --dry-run
```

## Data Model

`players` 表已存在于 schema，无需变更：
```typescript
export const players = sqliteTable('player', {
  id: text('id').primaryKey(),
  movieId: text('movie_id').notNull().references(() => movies.id, { onDelete: 'cascade' }),
  sourceName: text('source_name').notNull(),
  sourceUrl: text('source_url').notNull(),
  quality: text('quality'),
  sortOrder: integer('sort_order').default(0),
  averageRating: integer('average_rating'),
  ratingCount: integer('rating_count'),
  ...
})
```

## 非目标

- 不改造 JavBus 爬虫（该站无播放源，爬取无意义）
- 不修改 admin sync 端点（已正确实现）
- 不引入实时播放源检测（种子健康度）
