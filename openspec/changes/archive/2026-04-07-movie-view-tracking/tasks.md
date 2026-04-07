# Tasks：观看计数 + 热门算法优化

> ⚠️ 注意：本 change 包含 DB schema 变更，实施时必须先执行迁移，再部署 API，最后部署前端。

## Task 1：DB Schema 新增 viewCount 字段

**文件**：`packages/db/src/schema.ts`

在 `movies` 表定义中，`sortOrder` 字段后新增：

```typescript
viewCount: integer('view_count').default(0).notNull(),
```

**完成标准**：
- [x] schema.ts 中 movies 表含 `viewCount` 字段
- [x] `npm run type-check` 在 packages/db 通过

---

## Task 2：生成迁移文件

**执行命令**（在 `packages/db` 目录）：
```bash
npx drizzle-kit generate
```

验证生成的迁移文件（应为 `0025_*.sql`），内容 MUST 包含：
```sql
ALTER TABLE `movie` ADD `view_count` integer DEFAULT 0 NOT NULL;
```

**完成标准**：
- [x] `packages/db/drizzle/0025_normal_marten_broadcloak.sql` 迁移文件存在
- [x] 迁移内容正确（ADD COLUMN view_count）

---

## Task 3：新增观看埋点 API 路由

**文件**：`apps/api/src/routes/public/movies/index.ts`

在 `publicMoviesRoutes` 末尾追加 `POST /:code/view` 路由，使用 `sql\`view_count + 1\`` 原子自增。

**完成标准**：
- [x] `POST /public/movies/:code/view` 返回 `{ success: true }`
- [x] 影片不存在时也返回 200（不 404）
- [x] 使用 `sql\`view_count + 1\`` 原子操作

---

## Task 4：更新热门排序算法

**文件**：`apps/api/src/routes/movies/services/movie.service.ts`

`getHotMovies` 的 `orderBy` 更新为三级排序：

```typescript
orderBy: (movies, { desc }) => [desc(movies.sortOrder), desc(movies.viewCount), desc(movies.createdAt)],
```

**完成标准**：
- [x] 热门排序三级：sortOrder → viewCount → createdAt
- [x] `npm run type-check` 在 apps/api 通过

---

## Task 5：api-client.ts 新增 trackView

**文件**：`apps/movie-app/src/lib/api-client.ts`

在 `movieApi` 对象中新增方法 `trackView(movieCode)`，fire-and-forget，失败静默。

**完成标准**：
- [x] `movieApi.trackView(code)` 可调用
- [x] TypeScript 无报错
- [x] 失败时静默（不 throw）

---

## Task 6：播放页埋点

**文件**：`apps/movie-app/src/views/Player.vue`

在 `onMounted` 中调用 `movieApi.trackView(code)`，不 await。

**完成标准**：
- [x] 进入播放页时自动触发 `trackView`
- [x] 不 await，不阻塞页面渲染
- [x] 失败静默

---

## Task 7：类型检查

**完成标准**：
- [x] `npm run type-check` 在 `packages/db`、`apps/api`、`apps/movie-app` 均通过
- [x] 无新增 TypeScript 报错
