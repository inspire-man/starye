# Spec: Publisher Relations

## ADDED Requirements

### Requirement: 厂商实体扩展字段

系统 MUST 在 `publishers` 表中新增以下字段，以支持详情页展示和爬虫管理：

- `source`（TEXT, NOT NULL）：数据来源（如 'javbus', 'javdb'）
- `sourceId`（TEXT, NOT NULL, UNIQUE）：原站厂商 ID，用于去重
- `sourceUrl`（TEXT）：原站详情页 URL
- `hasDetailsCrawled`（BOOLEAN, DEFAULT false）：是否已爬取详情
- `crawlFailureCount`（INTEGER, DEFAULT 0）：详情爬取失败次数
- `lastCrawlAttempt`（TIMESTAMP）：最后一次爬取尝试时间

#### Scenario: 创建新厂商实体（完整信息）

- **WHEN** 爬虫成功爬取厂商详情页
- **THEN** 系统创建厂商实体，所有字段填充，`hasDetailsCrawled = true`

#### Scenario: 创建新厂商实体（降级模式）

- **WHEN** 爬虫无法访问厂商详情页
- **THEN** 系统仅使用 `name` 和 `source` 创建实体，`hasDetailsCrawled = false`，`crawlFailureCount = 1`

#### Scenario: 厂商唯一性校验

- **WHEN** 尝试创建厂商时，`source` + `sourceId` 已存在
- **THEN** 系统返回现有厂商实体，不重复创建

### Requirement: 电影-厂商 N:M 关联表

系统 MUST 创建 `movie_publishers` 关联表，字段包括：

- `id`（TEXT, PRIMARY KEY）：关联记录 ID
- `movieId`（TEXT, NOT NULL, FOREIGN KEY → movies.id）：电影 ID，CASCADE DELETE
- `publisherId`（TEXT, NOT NULL, FOREIGN KEY → publishers.id）：厂商 ID，CASCADE DELETE
- `sortOrder`（INTEGER, DEFAULT 0）：排序字段
- `createdAt`（TIMESTAMP）：创建时间
- **唯一约束**：(movieId, publisherId) 组合唯一

#### Scenario: 创建电影-厂商关联

- **WHEN** 爬虫解析出电影的厂商信息
- **THEN** 系统创建 `movie_publishers` 记录

#### Scenario: 防止重复关联

- **WHEN** 尝试为同一电影添加已存在的厂商
- **THEN** 系统返回唯一约束错误（409 Conflict）

#### Scenario: 级联删除

- **WHEN** 删除电影
- **THEN** 系统自动删除所有关联的 `movie_publishers` 记录

#### Scenario: 更新厂商作品计数

- **WHEN** 创建或删除 `movie_publishers` 记录
- **THEN** 系统更新对应厂商的 `movieCount` 字段

### Requirement: 厂商列表 API

系统 MUST 提供 `GET /api/publishers` 端点，支持以下功能：

- **分页**：`?page=1&limit=20`（默认 limit=20，最大 100）
- **排序**：`?sort=name|movieCount|createdAt`（默认 name）
- **筛选**：
  - `?country=日本`：按国家筛选
  - `?hasDetails=true`：仅显示已爬取详情的厂商
- **响应格式**：
  ```json
  {
    "data": [
      {
        "id": "pub_123",
        "name": "S1 NO.1 STYLE",
        "slug": "s1",
        "logo": "https://cdn.starye.org/publishers/s1.jpg",
        "country": "日本",
        "movieCount": 1200,
        "hasDetailsCrawled": true
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 50,
      "totalPages": 3
    }
  }
  ```

#### Scenario: 按名称排序（默认）

- **WHEN** 请求 `GET /api/publishers`
- **THEN** 系统返回按 `name` 字母顺序排序的厂商列表

#### Scenario: 按作品数量排序

- **WHEN** 请求 `GET /api/publishers?sort=movieCount`
- **THEN** 系统返回按 `movieCount` 降序排序的厂商列表

#### Scenario: 筛选日本厂商

- **WHEN** 请求 `GET /api/publishers?country=日本`
- **THEN** 系统仅返回 `country = "日本"` 的厂商

#### Scenario: 筛选已有详情的厂商

- **WHEN** 请求 `GET /api/publishers?hasDetails=true`
- **THEN** 系统仅返回 `hasDetailsCrawled = true` 的厂商

#### Scenario: 分页边界

- **WHEN** 请求 `GET /api/publishers?page=99999`
- **THEN** 系统返回空数组，`totalPages` 保持实际值

### Requirement: 厂商详情 API

系统 MUST 提供 `GET /api/publishers/:id` 端点，返回厂商完整信息及作品列表。

- **响应格式**：
  ```json
  {
    "id": "pub_123",
    "name": "S1 NO.1 STYLE",
    "slug": "s1",
    "logo": "https://cdn.starye.org/publishers/s1.jpg",
    "website": "https://s1s1s1.com",
    "description": "日本知名AV制作公司...",
    "foundedYear": 2001,
    "country": "日本",
    "movieCount": 1200,
    "movies": [
      {
        "id": "movie_456",
        "title": "电影标题",
        "code": "SSIS-123",
        "slug": "ssis-123",
        "coverImage": "https://cdn.starye.org/movies/ssis-123.jpg",
        "releaseDate": "2023-01-15T00:00:00Z"
      }
    ]
  }
  ```

#### Scenario: 获取完整详情

- **WHEN** 请求 `GET /api/publishers/pub_123`
- **THEN** 系统返回该厂商的完整信息和关联电影列表

#### Scenario: 厂商不存在

- **WHEN** 请求 `GET /api/publishers/nonexistent`
- **THEN** 系统返回 404 错误

#### Scenario: 作品列表排序

- **WHEN** 请求厂商详情
- **THEN** 关联电影按 `releaseDate` 降序排序（最新作品在前）

### Requirement: 厂商管理 API（仅管理员）

系统 MUST 提供以下管理端点，仅 `admin`/`super_admin`/`movie_admin` 角色可访问：

- `POST /api/admin/publishers`：创建厂商
- `PUT /api/admin/publishers/:id`：更新厂商信息
- `DELETE /api/admin/publishers/:id`：删除厂商

#### Scenario: 创建厂商（管理员）

- **WHEN** 管理员 POST 到 `/api/admin/publishers`，提供 `name`, `source`, `sourceId`
- **THEN** 系统创建厂商，返回 201 Created

#### Scenario: 创建厂商（非管理员）

- **WHEN** 普通用户 POST 到 `/api/admin/publishers`
- **THEN** 系统返回 403 Forbidden

#### Scenario: 更新厂商信息

- **WHEN** 管理员 PUT 到 `/api/admin/publishers/pub_123`，修改 `description`
- **THEN** 系统更新字段，返回 200 OK

#### Scenario: 删除厂商

- **WHEN** 管理员 DELETE 到 `/api/admin/publishers/pub_123`
- **THEN** 系统删除厂商，级联删除 `movie_publishers` 记录，返回 204 No Content

#### Scenario: 删除厂商时更新电影计数

- **WHEN** 删除厂商
- **THEN** 系统更新所有关联电影的厂商列表，重新计算 `movieCount`

### Requirement: 电影详情返回厂商信息

系统 MUST 修改 `GET /api/movies/:id` 端点，返回关联的厂商完整信息（替代原 `publisher: string` 字段）。

- **新响应格式**：
  ```json
  {
    "id": "movie_123",
    "title": "电影标题",
    "code": "SSIS-123",
    "publishers": [
      {
        "id": "pub_789",
        "name": "S1 NO.1 STYLE",
        "slug": "s1",
        "logo": "https://cdn.starye.org/publishers/s1.jpg"
      }
    ]
  }
  ```

#### Scenario: 获取电影详情

- **WHEN** 请求 `GET /api/movies/movie_123`
- **THEN** 系统返回电影信息，`publishers` 字段为厂商对象数组

#### Scenario: 电影无厂商

- **WHEN** 请求电影详情，但该电影无关联厂商
- **THEN** 系统返回 `publishers: []`

### Requirement: 爬虫自动关联厂商

系统 MUST 在爬取电影时，自动解析厂商信息并创建关联。

- **流程**：
  1. 解析电影页面，提取厂商 `name` 和 `sourceUrl`
  2. 查询数据库：是否存在 `source` + `sourceId` 匹配的厂商
  3. 不存在 → 爬取厂商详情页，创建厂商实体
  4. 创建 `movie_publishers` 关联记录
  5. 更新厂商 `movieCount`

#### Scenario: 爬取电影时自动创建厂商

- **WHEN** 爬虫爬取电影 SSIS-123，解析出厂商 "S1"
- **THEN** 系统检查 "S1" 是否存在，不存在则爬取详情页创建，最后创建关联

#### Scenario: 爬取电影时复用已有厂商

- **WHEN** 爬虫爬取电影 SSIS-456，解析出已存在的厂商 "S1"
- **THEN** 系统直接创建关联，不重复爬取厂商详情

#### Scenario: 厂商详情爬取失败

- **WHEN** 爬虫无法访问厂商详情页（404 或反爬拦截）
- **THEN** 系统仅使用 `name` 创建占位符厂商，`hasDetailsCrawled = false`，仍创建关联

#### Scenario: 厂商爬取失败次数限制

- **WHEN** 厂商 `crawlFailureCount >= 3`
- **THEN** 系统跳过详情页爬取，直接使用占位符

### Requirement: Movie App - 厂商列表页

系统 MUST 在 Movie App 中提供厂商列表页（路由 `/publishers`），支持以下功能：

- **默认排序**：按名称字母顺序
- **筛选器**：
  - 国家下拉框
  - 是否有详情筛选
- **卡片展示**：Logo、名称、作品数量
- **点击跳转**：点击卡片跳转到厂商详情页

#### Scenario: 访问厂商列表页

- **WHEN** 用户访问 `/publishers`
- **THEN** 系统展示厂商列表，默认按名称排序，每页 20 条

#### Scenario: 筛选日本厂商

- **WHEN** 用户选择国家 "日本"
- **THEN** 系统刷新列表，仅显示日本厂商

#### Scenario: 滚动加载更多

- **WHEN** 用户滚动到列表底部
- **THEN** 系统加载下一页厂商

### Requirement: Movie App - 厂商详情页

系统 MUST 在 Movie App 中提供厂商详情页（路由 `/publishers/:slug`），展示以下内容：

- **头部**：Logo、名称、国家
- **资料卡片**：官网、成立年份、简介
- **作品列表**：该厂商的所有电影，按发布日期降序排序

#### Scenario: 访问厂商详情页

- **WHEN** 用户访问 `/publishers/s1`
- **THEN** 系统展示厂商完整资料和作品列表

#### Scenario: 厂商无详情

- **WHEN** 访问 `hasDetailsCrawled = false` 的厂商
- **THEN** 系统展示名称和作品列表，其他字段显示占位符（如 "信息待补全"）

#### Scenario: 点击作品跳转

- **WHEN** 用户点击作品卡片
- **THEN** 系统跳转到电影详情页

### Requirement: Dashboard - 厂商管理页增强筛选

系统 MUST 在 Dashboard 的厂商管理页（`/dashboard/publishers`）新增筛选器：

- **是否有详情**：筛选 `hasDetailsCrawled = false` 的厂商
- **失败次数**：筛选 `crawlFailureCount > 0` 的厂商

#### Scenario: 筛选待补全厂商

- **WHEN** 管理员选择 "无详情" 筛选器
- **THEN** 系统展示所有 `hasDetailsCrawled = false` 的厂商

#### Scenario: 筛选失败记录

- **WHEN** 管理员选择 "失败次数 > 0"
- **THEN** 系统展示所有 `crawlFailureCount > 0` 的厂商

#### Scenario: 批量补全详情

- **WHEN** 管理员勾选多个待补全厂商，点击 "重新爬取"
- **THEN** 系统触发后台任务，尝试爬取这些厂商的详情页

### Requirement: Dashboard - 电影编辑页选择厂商

系统 MUST 在 Dashboard 的电影编辑页新增厂商选择器组件，支持：

- **搜索**：输入名称模糊搜索
- **多选**：可选择多个厂商
- **新增**：如厂商不存在，支持快速创建

#### Scenario: 搜索厂商

- **WHEN** 管理员在选择器中输入 "S1"
- **THEN** 系统展示匹配的厂商列表

#### Scenario: 选择厂商

- **WHEN** 管理员勾选 1 个厂商
- **THEN** 系统将该厂商添加到电影的关联列表

#### Scenario: 快速创建厂商

- **WHEN** 管理员输入不存在的厂商名称，点击 "创建"
- **THEN** 系统弹出创建表单，填写后保存并自动关联到电影
