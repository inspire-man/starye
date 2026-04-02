## ADDED Requirements

### Requirement: 演员筛选 MUST 使用关联表查询
Public Movies 列表接口（`GET /public/movies?actor=xxx`）SHALL 通过 `movie_actors` 关联表查询演员，而非 `movies.actors` JSON text 字段的 LIKE 模糊匹配。

#### Scenario: 按演员 slug 精确筛选
- **WHEN** 客户端请求 `GET /public/movies?actor=some-slug`，且 `actors` 表中存在 slug 为 `some-slug` 的演员
- **THEN** 返回的影片列表 MUST 仅包含通过 `movie_actors` 关联到该演员的影片

#### Scenario: 按演员名模糊筛选（兼容回退）
- **WHEN** 客户端请求 `GET /public/movies?actor=某名称`，且 `actors` 表中不存在该 slug，但存在名称模糊匹配的演员
- **THEN** 系统 SHALL 退化为 `actors.name LIKE %某名称%` 匹配，并返回关联到匹配演员的影片

#### Scenario: 演员不存在
- **WHEN** 客户端请求 `GET /public/movies?actor=nonexistent`，且数据库中无匹配演员
- **THEN** 返回空影片列表（`data: []`），HTTP 状态码 200

### Requirement: 厂商筛选 MUST 使用关联表查询
Public Movies 列表接口（`GET /public/movies?publisher=xxx`）SHALL 通过 `movie_publishers` 关联表查询厂商，而非 `movies.publisher` text 字段的 LIKE 模糊匹配。

#### Scenario: 按厂商 slug 精确筛选
- **WHEN** 客户端请求 `GET /public/movies?publisher=some-slug`，且 `publishers` 表中存在 slug 为 `some-slug` 的厂商
- **THEN** 返回的影片列表 MUST 仅包含通过 `movie_publishers` 关联到该厂商的影片

#### Scenario: 按厂商名模糊筛选（兼容回退）
- **WHEN** 客户端请求 `GET /public/movies?publisher=某厂商`，且 slug 不匹配但名称模糊匹配
- **THEN** 系统 SHALL 退化为 `publishers.name LIKE %某厂商%` 匹配

### Requirement: 影片详情 MUST 通过关联表返回演员和厂商信息
影片详情接口（`GET /public/movies/:code`）SHALL 通过 `movie_actors` 和 `movie_publishers` 关联表查询演员和厂商信息，而非读取 `movies.actors` / `movies.publisher` 旧字段。

#### Scenario: 详情页返回结构化演员列表
- **WHEN** 客户端请求某部影片详情
- **THEN** 响应中 MUST 包含从关联表查询到的演员列表，每个演员包含 `id`、`name`、`slug` 等字段

#### Scenario: 详情页返回厂商信息
- **WHEN** 客户端请求某部影片详情
- **THEN** 响应中 MUST 包含从关联表查询到的厂商信息

### Requirement: 相关影片推荐 MUST 基于关联表
影片详情接口返回的相关影片推荐 SHALL 基于 `movie_actors` 关联表计算共同演员，而非旧 `movies.actors` JSON text 字段。

#### Scenario: 基于共同演员推荐
- **WHEN** 客户端请求影片 A 的详情，影片 A 有演员 X 和 Y
- **THEN** 相关影片列表 MUST 包含与影片 A 共享演员（通过 `movie_actors` 关联）的其他影片，按共同演员数量降序排列

#### Scenario: 无共同演员
- **WHEN** 影片 A 的所有演员都没有出演其他影片
- **THEN** 相关影片列表 SHALL 为空数组（或回退到同系列推荐）

### Requirement: API 响应格式向后兼容
本次迁移 MUST 保持 API 响应的 JSON 结构与现有客户端兼容。

#### Scenario: 列表接口分页结构不变
- **WHEN** 客户端请求影片列表
- **THEN** 响应结构 MUST 保持 `{ data: Movie[], pagination: { ... } }` 格式不变

#### Scenario: 详情接口结构不变
- **WHEN** 客户端请求影片详情
- **THEN** 响应结构 MUST 保持现有字段结构，新增的关联数据以附加字段返回（不删除现有字段）
