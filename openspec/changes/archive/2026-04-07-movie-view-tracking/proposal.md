# 观看计数 + 热门算法优化（方向 E）

## 背景

当前"热门影片"使用 `sortOrder`（人工权重）排序，缺乏真实用户行为数据支撑。若所有影片 `sortOrder` 相同，则热门排序退化为时间倒序，没有体现真正的热门度。

需要引入**真实观看计数**（`viewCount`），并将其纳入热门算法，使"热门"区块能反映用户实际兴趣。

## 目标

- `movies` 表新增 `viewCount` 字段（整数，默认 0）
- 新增 `POST /api/public/movies/:code/view` 埋点接口，用户进入影片播放页时触发
- 热门算法更新为：`sortOrder DESC` → `viewCount DESC` → `createdAt DESC`
- movie-app 播放页 (`/movie/:code/play`) 自动上报观看

## 非目标

- **不做**去重（不以 userId / IP 去重，每次页面加载均计数）；简化优先，后续可加
- **不做** dashboard 展示 viewCount（只写不读于前台，dashboard 数据分析留后续）
- **不做** 日/周热门榜（单列 viewCount 已足够当前需求）
- **不做**跨影片推荐算法（相关影片保持现有演员共同推荐逻辑）

## 范围

**涉及应用**：`packages/db`（schema + migration）、`apps/api`、`apps/movie-app`

### A. DB 变更（packages/db）

- `packages/db/src/schema.ts`：在 `movies` 表新增 `viewCount: integer('view_count').default(0).notNull()`
- 生成迁移文件 `packages/db/drizzle/0025_movie_view_count.sql`：
  ```sql
  ALTER TABLE movie ADD COLUMN view_count INTEGER NOT NULL DEFAULT 0;
  ```

### B. API 变更（apps/api）

**B1 — 观看埋点接口**
- 路由：`POST /api/public/movies/:code/view`
- 无需登录（匿名可上报）
- 逻辑：`UPDATE movie SET view_count = view_count + 1 WHERE code = :code`
- 不验证影片是否存在（避免额外查询，`UPDATE` 影响行数为 0 时静默忽略）
- 响应：`{ success: true }` 或静默 200

**B2 — 热门排序更新**
- 文件：`apps/api/src/routes/movies/services/movie.service.ts`（或 `apps/api/src/routes/public/movies/index.ts` 中的 hot 路由）
- `getHotMovies` 排序改为：`[desc(movies.sortOrder), desc(movies.viewCount), desc(movies.createdAt)]`

### C. 前端变更（apps/movie-app）

**C1 — API 客户端**
- `apps/movie-app/src/lib/api-client.ts` 新增 `movieApi.trackView(movieCode)` 方法

**C2 — 播放页上报**
- 文件：`apps/movie-app/src/views/MoviePlay.vue`（或含播放器的页面）
- `onMounted` 时调用 `movieApi.trackView(movieCode)`，fire-and-forget（不阻塞渲染，失败静默忽略）

## 风险

- **DB 迁移**：`ALTER TABLE ADD COLUMN` 在 D1 (SQLite) 上是 DDL 操作，**MUST** 在生产环境执行迁移后才能部署 API，否则 viewCount 字段不存在会导致 UPDATE 失败
- **viewCount 膨胀**：不去重的简单自增在爬虫刷量时会失效，当前阶段可接受；后续可通过 CF Workers KV 实现 TTL 去重
- **埋点时机**：播放页加载时触发（而非播放完成），存在用户进入即离开的虚假计数，当前阶段可接受

## 依赖关系

- 本 change 与 `movie-history-genre` **相互独立**，可并行实施，但 DB 迁移必须先于 API 部署
