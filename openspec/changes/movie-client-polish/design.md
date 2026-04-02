## Context

Movie App 客户端已具备基本的影片浏览、搜索、收藏和详情查看功能，但存在几处明显的体验缺陷：

1. `Favorites.vue` 只渲染 `favorite.entityId`，无影片名称/封面 — 因为 API `GET /favorites` 仅返回 `entityType` + `entityId`
2. `MovieDetail.vue` 中收藏按钮的取消收藏逻辑写了 `showToast('取消收藏功能开发中')` 占位
3. 详情页标签（genres）是纯展示标签，不可点击
4. 详情页链接到 `/series/:name`，但 `router.ts` 中没有对应路由
5. 路由守卫中使用 `alert()` 而非 Toast 通知

## Goals / Non-Goals

**Goals:**
- 收藏夹页面展示完整的实体信息（名称、封面、可跳转链接）
- 完成取消收藏功能的客户端实现
- 标签可点击跳转至筛选结果
- 系列页面可正常浏览
- 替换 `alert()` 为一致的 Toast UX

**Non-Goals:**
- 不修改 Admin 管理端
- 不实现批量收藏/取消收藏
- 不实现无限滚动或虚拟列表（后续优化）
- 不实现 SEO Meta tags

## Decisions

### Decision 1: Favorites API 返回关联实体信息 — 通过 JOIN 在服务端填充

**选择**: 修改 `getFavoriteList` handler，在查询收藏列表后，根据 `entityType` 分组批量查询对应实体表（movies、actors、publishers、comics），将名称和封面附加到响应中。

**理由**: 相比客户端逐个请求实体详情（N+1 问题），服务端批量 JOIN 只需 1-4 次额外查询。Cloudflare Workers D1 的 CPU 时间限制下，批量查询比多次网络往返更可控。

**替代方案**: 客户端根据 entityId 逐个请求详情 — 移动端弱网下体验差、请求过多。

**响应格式扩展:**
```typescript
// 现有
{ id, entityType, entityId, createdAt }
// 扩展为
{ id, entityType, entityId, createdAt, entity: { name, cover, slug } }
```

### Decision 2: 取消收藏 — 使用 checkFavorite 接口获取 favoriteId

**选择**: 在 `MovieDetail.vue` 中，通过 `GET /favorites/check/:entityType/:entityId` 判断收藏状态时，同时返回 `favoriteId`（如果已收藏）。这样取消收藏时直接用 `DELETE /favorites/:favoriteId`。

**理由**: 当前 `checkFavorite` 只返回 `{ isFavorited: boolean }`，缺少 `favoriteId`。扩展此接口最简洁，不影响其他调用方。

**替代方案**: 新增 `DELETE /favorites/by-entity/:entityType/:entityId` — 新增端点复杂度更高。

### Decision 3: 系列页面 — 复用列表页搜索逻辑

**选择**: 新增 `Series.vue` 视图，本质是调用 `GET /public/movies?search=series_name` 或新增 `?series=xxx` 查询参数。

**理由**: 系列名是电影的 `series` 字段，Public API 已有按字段筛选能力，只需新增参数即可。不需要独立的 API 端点。

**替代方案**: 创建独立的 `/api/public/series/:name` 端点 — 过度设计，复用现有列表接口更简洁。

### Decision 4: 标签筛选 — 跳转到首页携带 query 参数

**选择**: 标签点击后通过 `router.push({ path: '/', query: { genre: tag } })` 跳转首页，由 Home.vue 读取 URL 参数触发筛选。

**理由**: Home.vue 已有 genre 筛选逻辑，只需读取 URL 参数并同步到搜索状态。无需新页面。

### Decision 5: Toast 替换 alert — 复用现有 showToast

**选择**: `router.ts` 中引入已有的 `showToast` 工具函数替换 `alert()`。

**理由**: 项目已有 `showToast` 组合式函数，保持 UX 一致性。

## Risks / Trade-offs

- **[API 兼容] Favorites 响应格式扩展** → 新增 `entity` 字段为可选（旧客户端忽略即可），不删除现有字段
- **[性能] 收藏列表批量查询关联实体** → 每种 entityType 最多 1 次批量查询（`WHERE id IN (...)` ），分页限制 24 条，关联查询量可控
- **[系列页面] series 字段可能为空或不规范** → 页面需处理空结果，显示友好提示
