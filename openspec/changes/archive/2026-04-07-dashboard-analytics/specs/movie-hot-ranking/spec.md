## ADDED Requirements

### Requirement: 管理端热门影片排行接口
系统 MUST 提供 `GET /api/admin/movies/analytics` 接口，返回热门影片排行数据，仅限管理员访问。

- MUST 返回 `viewCount` 最高的前 10 部影片
- MUST 包含字段：`id`、`code`、`title`、`coverImage`、`viewCount`、`isR18`
- MUST 按 `viewCount DESC` 排序
- MUST 仅限管理员鉴权（非管理员 MUST 返回 403）
- viewCount 全为 0 时 MUST 返回按 createdAt DESC 的前 10 部（作为冷启动兜底）

#### Scenario: 正常获取热门排行
- **WHEN** 管理员请求 `GET /api/admin/movies/analytics`
- **THEN** MUST 返回 `{ success: true, data: { hotMovies: [...], ... } }`，hotMovies 最多 10 条，按 viewCount DESC 排序

#### Scenario: 非管理员访问
- **WHEN** 普通用户请求 `GET /api/admin/movies/analytics`
- **THEN** MUST 返回 403 Forbidden

#### Scenario: 无 viewCount 数据时的冷启动
- **WHEN** 所有影片 viewCount 均为 0
- **THEN** MUST 返回最新创建的 10 部影片作为兜底排行

### Requirement: Dashboard 热门影片排行展示
Dashboard 首页 MUST 展示热门影片 Top 10 列表，辅助管理员了解内容热度。

- MUST 显示排名序号、影片标题、viewCount 数值
- MUST 提供点击跳转管理端影片详情的入口
- 数据加载中 MUST 显示 skeleton 占位
- 无数据时 MUST 显示"暂无观看数据"提示

#### Scenario: 展示热门排行列表
- **WHEN** Dashboard 首页加载完成
- **THEN** 热门影片 section MUST 展示按 viewCount 降序的影片列表，含序号和 viewCount

#### Scenario: 数据加载中状态
- **WHEN** analytics API 请求进行中
- **THEN** MUST 显示 skeleton 加载占位，不显示空状态
