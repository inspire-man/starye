## ADDED Requirements

### Requirement: 公共电影列表支持 publisher 模糊过滤
`GET /api/public/movies` 接口 **SHALL** 接受 `publisher` 查询参数，并按 `movies.publisher` 字段进行模糊匹配过滤。

#### Scenario: 按 publisher 名称过滤
- **WHEN** 请求 `GET /api/public/movies?publisher=SOD`
- **THEN** 返回结果中每条记录的 `publisher` 字段均包含字符串 "SOD"

#### Scenario: 无 publisher 参数时不过滤
- **WHEN** 请求 `GET /api/public/movies`（不带 publisher 参数）
- **THEN** 返回结果不受 publisher 限制，与修复前行为一致

### Requirement: 公共电影列表支持排序参数
`GET /api/public/movies` 接口 **SHALL** 接受 `sortBy` 和 `sortOrder` 查询参数，并按指定字段和方向排序返回结果。

#### Scenario: 按发布日期升序排序
- **WHEN** 请求 `GET /api/public/movies?sortBy=releaseDate&sortOrder=asc`
- **THEN** 返回列表按 `releaseDate` 升序排列

#### Scenario: 按标题字母序排序
- **WHEN** 请求 `GET /api/public/movies?sortBy=title&sortOrder=asc`
- **THEN** 返回列表按 `title` 字母升序排列

#### Scenario: 无排序参数时默认按创建时间降序
- **WHEN** 请求 `GET /api/public/movies`（不带 sortBy/sortOrder）
- **THEN** 返回结果按 `createdAt DESC` 排序（保持现有行为）

### Requirement: 热门电影榜单优先展示高 sortOrder 影片
`GET /api/public/movies/featured/hot` 接口 **SHALL** 按 `sortOrder DESC, createdAt DESC` 排序，使管理员手动置顶的影片优先展示。

#### Scenario: sortOrder 高的影片排在前面
- **WHEN** 存在 sortOrder=10 和 sortOrder=0 的两部影片时请求热门榜单
- **THEN** sortOrder=10 的影片出现在 sortOrder=0 的影片之前

#### Scenario: sortOrder 相同时按创建时间兜底
- **WHEN** 多部影片的 sortOrder 相同
- **THEN** 创建时间较新的影片排在前面
