## 1. 数据验证与准备

- [x] 1.1 验证关联表数据覆盖率：查询 `movie_actors` 和 `movie_publishers` 记录数，与 `movies` 表中 `actors IS NOT NULL` 和 `publisher IS NOT NULL` 的记录对比，确认关联表数据完整。完成标准：覆盖率 > 95% 或差异可解释
- [x] 1.2 确认关联表索引已建立：检查 `packages/db/src/schema.ts` 中 `idx_movie_actor_actor_id` 和 `idx_movie_pub_publisher_id` 索引定义存在。完成标准：索引定义存在且已部署

## 2. 列表接口筛选迁移

- [x] 2.1 在 `apps/api/src/routes/public/movies/index.ts` 中引入 `movieActors`, `moviePublishers`, `actors`, `publishers` schema。完成标准：import 编译通过
- [x] 2.2 重写演员筛选逻辑：将 `like(movies.actors, ...)` 替换为 EXISTS 子查询，先精确匹配 `actors.slug`，未命中退化为 `actors.name LIKE`。完成标准：`GET /public/movies?actor=xxx` 返回正确结果
- [x] 2.3 重写厂商筛选逻辑：将 `like(movies.publisher, ...)` 替换为 EXISTS 子查询，先精确匹配 `publishers.slug`，未命中退化为 `publishers.name LIKE`。完成标准：`GET /public/movies?publisher=xxx` 返回正确结果
- [x] 2.4 验证 count 查询也使用了相同的新条件（分页总数一致）。完成标准：列表分页的 `total` 与实际过滤结果数一致

## 3. 详情接口迁移

- [x] 3.1 将影片详情查询从 `db.query.movies.findFirst` 改为带 `with` 的关系查询，关联 `movieActors.actor` 和 `moviePublishers.publisher`。完成标准：详情接口返回结构化演员/厂商对象
- [x] 3.2 在响应中将关联查询结果映射为兼容格式（保留原有字段结构，附加结构化信息）。完成标准：现有客户端不因响应格式变化而报错

## 4. 相关影片推荐迁移

- [x] 4.1 重写相关影片查询：基于 `movie_actors` 关联表找共同演员影片，按共同演员数排序，取前 6 部。完成标准：详情页相关影片推荐返回合理结果
- [x] 4.2 保留同系列推荐逻辑，与共同演员推荐合并去重。完成标准：系列影片仍出现在相关推荐中

## 5. 端到端验证

- [x] 5.1 本地启动 API（`pnpm dev`），使用浏览器或 curl 测试以下场景：无筛选列表、按演员筛选、按厂商筛选、按标签筛选、影片详情、相关影片推荐。完成标准：所有场景返回 200 且数据合理
- [x] 5.2 类型检查通过（`pnpm --filter=@apps/api typecheck`）。完成标准：无 TypeScript 编译错误
- [x] 5.3 部署验证：推送后确认 Cloudflare Workers 部署成功且线上接口可用。完成标准：线上 `/public/movies` 和 `/public/movies/:code` 正常响应
