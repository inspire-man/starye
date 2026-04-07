# Design：观看计数 + 热门算法优化

## 总体架构

```
movie-app                         API                      DB
─────────────────────             ─────────────────────    ──────────
MoviePlay.vue  onMounted  ──►  POST /public/movies/:code/view  ──►  UPDATE movie
                                                                     SET view_count++
```

---

## A. DB Schema 变更

### 修改 packages/db/src/schema.ts

在 `movies` 表（`sqliteTable('movie', {...})`）中，在 `sortOrder` 字段后面新增：

```typescript
viewCount: integer('view_count').default(0).notNull(),
```

**位置**：放在 `sortOrder` 下方、`crawlStatus` 之前，语义上属于"统计字段"区域。

### 迁移文件 0025_movie_view_count.sql

```sql
-- 新增 view_count 字段，已有数据默认为 0
ALTER TABLE movie ADD COLUMN view_count INTEGER NOT NULL DEFAULT 0;
```

**迁移说明**：
- SQLite `ALTER TABLE ADD COLUMN` 支持 `DEFAULT` 值，所有现有行自动填充 0
- D1 支持直接执行此 DDL，无需数据 backfill
- 迁移文件命名遵循现有序号规则（当前最大为 0024，新文件为 0025）

---

## B. API 设计

### B1 — POST /public/movies/:code/view

**路由位置**：`apps/api/src/routes/public/movies/index.ts`（追加到 `publicMoviesRoutes`）

**设计要点**：

```typescript
.post(
  '/:code/view',
  async (c) => {
    const db = c.get('db')
    const { code } = c.req.param()
    // fire-and-forget：不验证影片存在性，减少查询
    await db
      .update(movies)
      .set({ viewCount: sql`${movies.viewCount} + 1` })
      .where(eq(movies.code, code))
    return c.json({ success: true })
  }
)
```

**选择 `sql` 表达式而非先查后写的原因**：
- 原子操作，避免并发竞争
- 减少一次 SELECT 查询（Cloudflare Workers CPU 时间敏感）

**不验证影片存在性的理由**：
- 如果 code 不存在，`UPDATE` 影响 0 行，静默成功
- 避免额外 SELECT 查询
- 埋点接口不应因影片删除而 404，影响播放页体验

**无需登录**：提高上报率，匿名用户的观看也应计入热门。

### B2 — 热门排序更新

**文件**：`apps/api/src/routes/movies/services/movie.service.ts`

当前（上次 change 修复后）：
```typescript
orderBy: [desc(movies.sortOrder), desc(movies.createdAt)]
```

改为：
```typescript
orderBy: [desc(movies.sortOrder), desc(movies.viewCount), desc(movies.createdAt)]
```

**排序优先级解释**：
1. `sortOrder DESC`：人工置顶/权重优先（运营干预能力保留）
2. `viewCount DESC`：真实热度
3. `createdAt DESC`：同等条件下，新内容靠前（保持发现性）

---

## C. 前端设计

### C1 — api-client.ts 新增 trackView

```typescript
export const movieApi = {
  // ... 现有方法 ...
  async trackView(movieCode: string): Promise<void> {
    try {
      await apiFetch(`/public/movies/${movieCode}/view`, { method: 'POST' })
    } catch {
      // 静默忽略，不影响播放体验
    }
  },
}
```

**返回 `void` 而非 `ApiResponse`**：调用方不需要处理响应，强调 fire-and-forget 语义。

### C2 — 播放页上报时机

**文件**：需要确认播放页组件路径（`src/views/MoviePlay.vue` 或含播放器逻辑的组件）

**上报时机**：`onMounted`（组件挂载时，代表用户进入播放页）

```typescript
onMounted(() => {
  // fire-and-forget，不 await，不影响页面加载
  movieApi.trackView(movieCode.value)
})
```

**不在 watch/onPlay 中触发的理由**：简化实现，播放页加载即代表观看意图；后续可改为"播放 30 秒以上才计数"。

---

## 关键决策

| 决策点 | 选择 | 理由 |
|---|---|---|
| viewCount 存储位置 | movies 表新列 | 最简单，避免新建 view_log 表；不需要时间序列数据 |
| 去重策略 | 不去重 | 简化实现；个人项目刷量风险低；后续可加 CF KV TTL |
| 埋点接口认证 | 无需登录 | 最大化数据收集；热门算法需要匿名用户数据 |
| UPDATE 原子操作 | `sql\`view_count + 1\`` | 避免竞争条件；Cloudflare Workers 并发可能同时处理多请求 |
| 热门排序权重 | sortOrder > viewCount > createdAt | 保留人工运营能力；自然热度作为主要排序因子 |

---

## 部署顺序（重要）

```
1. 执行 DB 迁移（D1 migrations apply）
   → 确保 view_count 字段存在
2. 部署 API（含新路由 + 更新的 hot 排序）
3. 部署 movie-app（含 trackView 埋点）
```

**MUST** 严格按此顺序，否则步骤 2 的 `UPDATE ... SET view_count = ...` 会因字段不存在而报错。
