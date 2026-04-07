## ADDED Requirements

### Requirement: 管理端 Genre 分布接口
`GET /api/admin/movies/analytics` 接口 MUST 同时返回 Genre 分布数据（与热门排行合并为同一接口，单次请求获取全部分析数据）。

- MUST 返回所有影片（含 R18）的 genre 聚合列表
- 每条记录 MUST 包含：`genre`（名称）、`count`（影片数）
- MUST 按 `count DESC` 排序，最多返回 50 条
- 空 genre（`''` 或 `null`）MUST 被过滤，不出现在结果中
- 管理端 MUST 包含 R18 影片（与公开 `/genres` 接口的 R18 过滤行为不同）

#### Scenario: 正常获取 Genre 分布
- **WHEN** 管理员请求 `GET /api/admin/movies/analytics`
- **THEN** 响应 MUST 包含 `genreDistribution` 数组，每条含 `genre` 和 `count`，按 count DESC 排序

#### Scenario: 管理端包含 R18 影片的 genre
- **WHEN** 数据库中存在 R18 影片含有专属 genre（如"uncensored"）
- **THEN** genreDistribution MUST 包含该 genre，count 含 R18 影片计数

#### Scenario: 空 genre 被过滤
- **WHEN** 部分影片 genres 数组含空字符串 `''`
- **THEN** 空字符串 genre MUST 不出现在 genreDistribution 结果中

### Requirement: Dashboard Genre 分布展示
Dashboard 首页 MUST 展示 Genre 分布列表，辅助管理员了解内容类型构成。

- MUST 显示 genre 名称、影片数量、以及相对占比进度条（count / totalMovies * 100%）
- MUST 最多展示前 20 个 genre（页面空间限制）
- 数据加载中 MUST 显示 skeleton 占位

#### Scenario: 展示 Genre 分布列表
- **WHEN** Dashboard 首页加载完成
- **THEN** Genre 分布 section MUST 展示 genre 名称、count 和可视化进度条

#### Scenario: 超过 20 个 genre 时截断
- **WHEN** 接口返回 35 个 genre
- **THEN** 前端 MUST 仅展示前 20 个，其余不渲染
