## Context

现有 Series.vue 通过 `movieApi.getMovies({ series: name })` 获取影片列表，API 返回的是标准影片分页结构，不含系列元信息。`movies` 表已有 `series`（发行商/系列名）和 `publisher`（制作商）字段，均为文本类型，没有独立的 series 实体表。

## Changes

### 1. 后端 — 系列详情端点

新增 `GET /api/series/:name`，聚合查询计算统计数据：

```typescript
// apps/api/src/routes/public/series/index.ts
app.get('/:name', async (c) => {
  const { name } = c.req.param()
  const decodedName = decodeURIComponent(name)

  // 查询系列所有影片的聚合数据
  const stats = await db.select({
    count: count(),
    totalDuration: sum(movies.duration),
    minYear: min(movies.releaseDate),
    maxYear: max(movies.releaseDate),
    publisher: movies.publisher,  // 取第一条的厂商名（同系列厂商相同）
  }).from(movies)
    .where(eq(movies.series, decodedName))
    .groupBy(movies.publisher)

  if (!stats.length) {
    return c.json({ error: 'Series not found' }, 404)
  }

  const { count: movieCount, totalDuration, minYear, maxYear, publisher } = stats[0]

  // 查询同厂商下的其他系列
  let relatedSeries: string[] = []
  if (publisher) {
    const related = await db.selectDistinct({ series: movies.series })
      .from(movies)
      .where(and(
        eq(movies.publisher, publisher),
        ne(movies.series, decodedName),
        isNotNull(movies.series),
      ))
      .limit(8)
    relatedSeries = related.map(r => r.series!).filter(Boolean)
  }

  // 查询厂商 slug（用于链接跳转）
  const publisherRecord = publisher
    ? await db.query.publishers.findFirst({
        where: (p, { like }) => like(p.name, `%${publisher}%`),
        columns: { slug: true, name: true },
      })
    : null

  return c.json({
    name: decodedName,
    movieCount,
    totalDuration: totalDuration || 0,
    minYear: minYear ? new Date(minYear).getFullYear() : null,
    maxYear: maxYear ? new Date(maxYear).getFullYear() : null,
    publisher: publisherRecord || (publisher ? { name: publisher, slug: null } : null),
    relatedSeries,
  })
})
```

### 2. 前端 — Series.vue 增强

新增概览卡片（系列统计）：
```
┌─────────────────────────────────────────────────┐
│  系列：痴汉御用达人                                │
│  厂商：[S1 NO.1 STYLE →]                        │
│  共 45 部 · 总时长约 110小时 · 2018 - 2024年      │
└─────────────────────────────────────────────────┘
```

影片列表排序：默认 `releaseDate DESC`（API 新增 `sort=releaseDate&order=desc` 参数支持）

底部相关系列：
```
同厂商其他系列：[SSIS系列] [PRED系列] [IPX系列] ...
```

### 3. API 参数扩展

现有 `GET /api/movies?series=` 端点添加 `sort` 和 `order` 参数支持，允许按 `releaseDate` 排序。
