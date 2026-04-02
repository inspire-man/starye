## Why

Movie App 客户端存在多处功能缺失和体验问题，直接影响用户日常使用：

1. **收藏夹页面只显示 entityId，无影片名称和封面** — 收藏功能形同虚设
2. **取消收藏功能未实现** — 客户端显示"开发中"，但 API 已支持
3. **标签不可点击** — 详情页的分类标签无法用于快速筛选
4. **系列页面路由不存在** — 详情页链接到 `/series/:name` 但无对应路由
5. **路由守卫使用 `alert()`** — 破坏用户体验

这些问题 MUST 被修复以提供基本可用的客户端体验。

## What Changes

- **收藏夹增强**: 修改 Favorites API 返回关联实体信息（名称、封面），客户端渲染完整卡片
- **取消收藏**: 在 MovieDetail 和 Favorites 页面接入 `DELETE /favorites/:id`
- **标签交互**: 详情页 genre 标签点击后跳转到带 `?genre=xxx` 参数的列表页
- **系列浏览**: 新增 `/series/:name` 路由和页面，列出同系列影片
- **UX 优化**: 路由守卫的 `alert()` 改为 Toast 提示并重定向

## Capabilities

### New Capabilities

- `favorites-display`: 收藏夹展示增强 — API 返回关联实体信息，客户端渲染卡片
- `unfavorite`: 取消收藏功能 — 客户端调用 DELETE API，支持详情页和收藏夹页面
- `genre-filter`: 标签交互筛选 — 详情页标签可点击跳转列表页
- `series-browse`: 系列浏览页面 — 新增路由和视图组件

### Modified Capabilities

（无现有 spec 级别的行为变更）

## Impact

- **API 路由**: `apps/api/src/routes/favorites/index.ts` — 返回格式扩展
- **客户端视图**: `Favorites.vue`, `MovieDetail.vue`, `Home.vue` — UI 修改
- **客户端路由**: `router.ts` — 新增系列路由，修改路由守卫
- **客户端 API**: `api.ts` — 新增取消收藏方法
- **客户端类型**: `types.ts` — 扩展收藏类型定义
- **范围外**: Admin 管理端功能、爬虫逻辑、数据库 schema 变更
