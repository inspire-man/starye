## Why

Public Movies API（`/public/movies` 和 `/public/movies/:code`）的演员筛选、厂商筛选和相关影片推荐，目前仍在使用 `movies.actors`（JSON text）和 `movies.publisher`（text）这两个旧冗余字段进行 `LIKE` 查询。

但项目已建立了规范化的关联表 `movie_actors` 和 `movie_publishers`，且 Monthly Data Cleanup 定时任务（每月 1 号）会将这两个旧字段清空为 NULL。**一旦 cleanup 执行，按演员/厂商筛选和相关影片推荐将完全失效。**

这是一个紧急的数据一致性问题，MUST 在下次 cleanup 执行前完成迁移。

## What Changes

- 将 `/public/movies` 列表接口的演员筛选从 `like(movies.actors, ...)` 迁移到 `movie_actors` 关联表 JOIN 查询
- 将 `/public/movies` 列表接口的厂商筛选从 `like(movies.publisher, ...)` 迁移到 `movie_publishers` 关联表 JOIN 查询
- 将 `/public/movies/:code` 详情接口的相关影片推荐从 `like(movies.actors, ...)` 迁移到基于 `movie_actors` 关联表的查询
- 将 `/public/movies/:code` 详情接口返回的演员/厂商信息从旧 JSON 字段改为通过关联表查询

## Capabilities

### New Capabilities

（无新增能力，本变更为已有能力的内部实现迁移）

### Modified Capabilities

（无 spec 级别的行为变更，API 对外接口保持不变，仅数据查询来源切换）

## Impact

- **API 路由**: `apps/api/src/routes/public/movies/index.ts` — 主要修改文件
- **API 路由**: `apps/api/src/routes/movies/handlers/movies.handler.ts` — 可能涉及的旧路由
- **数据库**: 查询将使用 `movie_actors` / `movie_publishers` 关联表的 JOIN，需确认索引已存在（`idx_movie_actor`, `idx_movie_pub` 等）
- **性能**: JOIN 查询可能比 LIKE 模糊匹配稍慢或稍快，需要实际验证（D1 上的表现）
- **范围外**: Admin API 已使用关联表查询，不在本次变更范围内；客户端代码无需修改（API 响应格式不变）
