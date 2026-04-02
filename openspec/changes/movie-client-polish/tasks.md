## 1. Favorites API 扩展

- [ ] 1.1 修改 `apps/api/src/routes/favorites/handlers/favorite.handler.ts` 中的 `getFavoriteList`：查询收藏列表后，按 entityType 分组批量查询关联实体表（movies/actors/publishers/comics），将 `{ name, cover, slug }` 附加为 `entity` 字段。完成标准：`GET /favorites` 返回的每条记录包含 `entity` 字段
- [ ] 1.2 修改 `checkFavoriteHandler`：当 `isFavorited: true` 时，额外返回 `favoriteId`。完成标准：`GET /favorites/check/movie/:id` 返回 `{ isFavorited: true, favoriteId: "xxx" }`
- [ ] 1.3 更新 favorites 相关的 Valibot schema（`schemas/favorite.ts`），扩展响应类型。完成标准：TypeScript 类型检查通过

## 2. 客户端 — 收藏夹展示增强

- [ ] 2.1 更新 `apps/movie-app/src/types.ts`，扩展 Favorite 类型定义添加 `entity` 可选字段。完成标准：类型定义包含 entity
- [ ] 2.2 重写 `Favorites.vue` 的收藏卡片渲染：使用 `entity.name` 和 `entity.cover` 展示名称和封面图，点击跳转对应详情页。完成标准：收藏夹页面显示实体名称和封面而非 entityId
- [ ] 2.3 处理 `entity: null` 的情况，显示「内容已删除」占位提示。完成标准：已删除实体的收藏项有友好提示

## 3. 客户端 — 取消收藏

- [ ] 3.1 在 `api.ts` 中添加 `deleteFavorite(favoriteId: string)` 方法。完成标准：API 方法可调用 `DELETE /favorites/:id`
- [ ] 3.2 修改 `MovieDetail.vue` 中的收藏按钮逻辑：利用 checkFavorite 返回的 favoriteId，已收藏时点击调用 deleteFavorite。完成标准：详情页可正常取消收藏，替换「开发中」占位
- [ ] 3.3 确认 `Favorites.vue` 的删除功能正常工作（已有 `removeFavorite` 逻辑，验证即可）。完成标准：收藏夹页面可取消收藏

## 4. 客户端 — 标签交互筛选

- [ ] 4.1 修改 `MovieDetail.vue` 中 genre 标签的渲染，将 `<span>` 改为 `<RouterLink :to="{ path: '/', query: { genre: tag } }">`。完成标准：标签点击可跳转到首页
- [ ] 4.2 修改 `Home.vue`，在 `onMounted` 或 `watch` 中读取 `route.query.genre` 并同步到筛选状态。完成标准：通过 `/?genre=xxx` 访问首页自动筛选

## 5. 客户端 — 系列浏览页面

- [ ] 5.1 在 `router.ts` 中新增 `/series/:name` 路由。完成标准：路由注册存在
- [ ] 5.2 创建 `views/Series.vue` 视图组件，调用 `GET /public/movies?series=xxx`（或复用 search 参数）展示同系列影片。完成标准：系列页面可正常加载并展示影片列表
- [ ] 5.3 如果 Public API 不支持 `?series=xxx` 参数，在 `apps/api/src/routes/public/movies/index.ts` 中添加 series 筛选条件。完成标准：API 支持 series 筛选

## 6. 客户端 — UX 优化

- [ ] 6.1 在 `router.ts` 的路由守卫中将 `alert()` 替换为 `showToast()`（引入现有的 Toast 工具）。完成标准：未登录访问受保护页面时显示 Toast 而非 alert 弹窗
- [ ] 6.2 将 `Favorites.vue` 中的 `confirm()` 和 `alert()` 替换为 Toast 或自定义确认弹窗。完成标准：收藏夹页面无原生弹窗

## 7. 端到端验证

- [ ] 7.1 本地启动完整服务（API + movie-app），验证收藏夹展示、取消收藏、标签筛选、系列页面、Toast 提示。完成标准：所有功能可正常操作
- [ ] 7.2 TypeScript 类型检查通过（API 和 movie-app）。完成标准：`pnpm typecheck` 无错误
