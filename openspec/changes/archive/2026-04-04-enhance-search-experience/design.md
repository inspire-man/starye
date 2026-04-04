## Context

现有搜索能力分散：
- `apps/api/src/routes/public/movies/index.ts` 支持 `?search=` 过滤影片标题
- `apps/api/src/routes/actors/` 支持按 name 筛选演员列表
- 前端 `Home.vue` 仅在加载完成后在内存中过滤，不支持 URL 化

## Changes

### 1. 后端 — 统一搜索端点

新增 `GET /api/search?q=<keyword>&types=movie,actor,publisher&limit=5`：

```typescript
// apps/api/src/routes/public/search/index.ts
app.get('/search', async (c) => {
  const { q, types = 'movie,actor,publisher', limit = 5 } = c.req.query()
  const typeList = types.split(',')
  const results: { movies?: [], actors?: [], publishers?: [] } = {}

  if (typeList.includes('movie')) {
    results.movies = await db.query.movies.findMany({
      where: (m, { or, like, eq }) => or(like(m.title, `%${q}%`), eq(m.code, q)),
      columns: { id, code, title, slug, coverImage, isR18 },
      limit,
    })
  }
  if (typeList.includes('actor')) {
    results.actors = await db.query.actors.findMany({
      where: (a, { like }) => like(a.name, `%${q}%`),
      columns: { id, name, slug, avatar },
      limit,
    })
  }
  if (typeList.includes('publisher')) {
    results.publishers = await db.query.publishers.findMany({
      where: (p, { like }) => like(p.name, `%${q}%`),
      columns: { id, name, slug, logo },
      limit,
    })
  }
  return c.json({ q, results })
})
```

### 2. 前端 — 搜索页（`Search.vue`）

路由：`/search?q=<keyword>`

页面结构：
```
[搜索框] (与 URL 双向绑定)
  ├── 影片结果 (n)
  │     └── 影片卡片列表
  ├── 演员结果 (n)
  │     └── 演员头像+名称列表
  └── 厂商结果 (n)
        └── 厂商名称+作品数列表
```

### 3. 前端 — 自动补全组件（`SearchBar.vue`）

- 输入 debounce 300ms 后请求 `/api/search?q=&limit=3&types=movie,actor,publisher`
- 下拉列表展示候选项（movie：番号+标题，actor：头像+名称，publisher：名称）
- 点击候选项跳转到对应详情页
- 按 Enter 跳转到 `/search?q=<keyword>` 全结果页
- Escape 关闭下拉
- 搜索框集成到顶部导航栏（Header.vue 或 Layout）

### 4. URL 状态管理

```typescript
// Search.vue
const route = useRoute()
const router = useRouter()
const keyword = ref(route.query.q as string || '')

watch(keyword, (val) => {
  router.replace({ query: { q: val } })
})
```
