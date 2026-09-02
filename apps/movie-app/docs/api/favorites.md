# 收藏功能前端集成

收藏 API 的 HTTP 契约以 API 路由和运行时 OpenAPI 为准：

- ../../../api/src/routes/favorites/index.ts
- http://localhost:8080/api/openapi.json

## 路由

| 方法 | 路径 | 用途 |
|------|------|------|
| GET | /api/favorites | 分页读取当前用户收藏 |
| POST | /api/favorites | 添加收藏，重复添加保持幂等 |
| DELETE | /api/favorites/:id | 删除当前用户收藏 |
| GET | /api/favorites/check/:entityType/:entityId | 查询收藏状态 |

支持的实体类型为 movie、actor、publisher 和 comic。

## 认证

前端通过 Better Auth session/cookie 访问 API。浏览器请求保持当前 session，不在组件中手写 Bearer token 或复制 cookie。

## 推荐用法

Movie App 已封装：

- src/lib/api-client.ts：favoritesApi
- src/composables/useFavorites.ts：列表、分页、添加、删除和状态查询

~~~ts
const favorites = useFavorites({
  entityType: 'movie',
  autoLoad: true,
})

await favorites.addFavorite('movie', movieId)
await favorites.removeFavorite(favoriteId)
const state = await favorites.checkIsFavorited('movie', movieId)
~~~

列表响应包含 data 和 pagination，pagination 包含 total、page、limit 和 totalPages。添加、删除和状态查询失败时由 api-client 和 composable 转换为前端错误状态。

组件测试见 src/composables/__tests__/useFavorites.test.ts。跨应用测试入口见 ../E2E-TEST-GUIDE.md。
