# actor-relations Specification

## Purpose
TBD - created by archiving change actor-publisher-relations. Update Purpose after archive.
## Requirements
### Requirement: 女优实体扩展字段

系统 MUST 在 `actors` 表中新增以下字段，以支持详情页展示和爬虫管理：

- `source`（TEXT, NOT NULL）：数据来源（如 'javbus', 'javdb'）
- `sourceId`（TEXT, NOT NULL, UNIQUE）：原站女优 ID，用于去重
- `sourceUrl`（TEXT）：原站详情页 URL
- `cover`（TEXT）：封面大图（与 avatar 不同，用于详情页头图）
- `cupSize`（TEXT）：罩杯
- `bloodType`（TEXT）：血型
- `debutDate`（TIMESTAMP）：出道日期
- `isActive`（BOOLEAN, DEFAULT true）：是否活跃
- `retireDate`（TIMESTAMP）：引退日期
- `hasDetailsCrawled`（BOOLEAN, DEFAULT false）：是否已爬取详情
- `crawlFailureCount`（INTEGER, DEFAULT 0）：详情爬取失败次数
- `lastCrawlAttempt`（TIMESTAMP）：最后一次爬取尝试时间

#### Scenario: 创建新女优实体（完整信息）

- **WHEN** 爬虫成功爬取女优详情页
- **THEN** 系统创建女优实体，所有字段填充，`hasDetailsCrawled = true`

#### Scenario: 创建新女优实体（降级模式）

- **WHEN** 爬虫无法访问女优详情页
- **THEN** 系统仅使用 `name` 和 `source` 创建实体，`hasDetailsCrawled = false`，`crawlFailureCount = 1`

#### Scenario: 女优唯一性校验

- **WHEN** 尝试创建女优时，`source` + `sourceId` 已存在
- **THEN** 系统返回现有女优实体，不重复创建

### Requirement: 电影-女优 N:M 关联表

系统 MUST 创建 `movie_actors` 关联表，字段包括：

- `id`（TEXT, PRIMARY KEY）：关联记录 ID
- `movieId`（TEXT, NOT NULL, FOREIGN KEY → movies.id）：电影 ID，CASCADE DELETE
- `actorId`（TEXT, NOT NULL, FOREIGN KEY → actors.id）：女优 ID，CASCADE DELETE
- `sortOrder`（INTEGER, DEFAULT 0）：排序字段，保持原站顺序
- `createdAt`（TIMESTAMP）：创建时间
- **唯一约束**：(movieId, actorId) 组合唯一

#### Scenario: 创建电影-女优关联

- **WHEN** 爬虫解析出电影的女优列表
- **THEN** 系统为每个女优创建 `movie_actors` 记录，`sortOrder` 按原站顺序递增

#### Scenario: 防止重复关联

- **WHEN** 尝试为同一电影添加已存在的女优
- **THEN** 系统返回唯一约束错误（409 Conflict）

#### Scenario: 级联删除

- **WHEN** 删除电影
- **THEN** 系统自动删除所有关联的 `movie_actors` 记录

#### Scenario: 更新女优作品计数

- **WHEN** 创建或删除 `movie_actors` 记录
- **THEN** 系统更新对应女优的 `movieCount` 字段

### Requirement: 女优列表 API

系统 MUST 提供 `GET /api/actors` 端点，支持以下功能：

- **分页**：`?page=1&limit=20`（默认 limit=20，最大 100）
- **排序**：`?sort=name|movieCount|createdAt`（默认 name）
- **筛选**：
  - `?nationality=日本`：按国籍筛选
  - `?isActive=true`：仅显示活跃女优
  - `?hasDetails=true`：仅显示已爬取详情的女优
- **响应格式**：
  ```json
  {
    "data": [
      {
        "id": "actor_123",
        "name": "XXX",
        "slug": "xxx",
        "avatar": "https://cdn.starye.org/actors/xxx.jpg",
        "nationality": "日本",
        "movieCount": 42,
        "isActive": true,
        "hasDetailsCrawled": true
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "totalPages": 8
    }
  }
  ```

#### Scenario: 按名称排序（默认）

- **WHEN** 请求 `GET /api/actors`
- **THEN** 系统返回按 `name` 字母顺序排序的女优列表

#### Scenario: 按作品数量排序

- **WHEN** 请求 `GET /api/actors?sort=movieCount`
- **THEN** 系统返回按 `movieCount` 降序排序的女优列表

#### Scenario: 筛选日本女优

- **WHEN** 请求 `GET /api/actors?nationality=日本`
- **THEN** 系统仅返回 `nationality = "日本"` 的女优

#### Scenario: 筛选活跃女优

- **WHEN** 请求 `GET /api/actors?isActive=true`
- **THEN** 系统仅返回 `isActive = true` 的女优

#### Scenario: 分页边界

- **WHEN** 请求 `GET /api/actors?page=99999`
- **THEN** 系统返回空数组，`totalPages` 保持实际值

### Requirement: 女优详情 API

系统 MUST 提供 `GET /api/actors/:id` 端点，返回女优完整信息及作品列表。

- **响应格式**：
  ```json
  {
    "id": "actor_123",
    "name": "XXX",
    "slug": "xxx",
    "avatar": "https://cdn.starye.org/actors/xxx.jpg",
    "cover": "https://cdn.starye.org/actors/xxx-cover.jpg",
    "bio": "简介...",
    "birthDate": "1990-01-01T00:00:00Z",
    "height": 165,
    "measurements": "B88-W58-H86",
    "cupSize": "D",
    "bloodType": "A",
    "nationality": "日本",
    "debutDate": "2010-06-01T00:00:00Z",
    "isActive": true,
    "retireDate": null,
    "movieCount": 42,
    "socialLinks": {
      "twitter": "https://twitter.com/xxx",
      "instagram": "https://instagram.com/xxx"
    },
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

- **WHEN** 请求 `GET /api/actors/actor_123`
- **THEN** 系统返回该女优的完整信息和关联电影列表

#### Scenario: 女优不存在

- **WHEN** 请求 `GET /api/actors/nonexistent`
- **THEN** 系统返回 404 错误

#### Scenario: 作品列表排序

- **WHEN** 请求女优详情
- **THEN** 关联电影按 `releaseDate` 降序排序（最新作品在前）

### Requirement: 女优管理 API（仅管理员）

系统 MUST 提供以下管理端点，仅 `admin`/`super_admin`/`movie_admin` 角色可访问：

- `POST /api/admin/actors`：创建女优
- `PUT /api/admin/actors/:id`：更新女优信息
- `DELETE /api/admin/actors/:id`：删除女优

#### Scenario: 创建女优（管理员）

- **WHEN** 管理员 POST 到 `/api/admin/actors`，提供 `name`, `source`, `sourceId`
- **THEN** 系统创建女优，返回 201 Created

#### Scenario: 创建女优（非管理员）

- **WHEN** 普通用户 POST 到 `/api/admin/actors`
- **THEN** 系统返回 403 Forbidden

#### Scenario: 更新女优信息

- **WHEN** 管理员 PUT 到 `/api/admin/actors/actor_123`，修改 `bio`
- **THEN** 系统更新字段，返回 200 OK

#### Scenario: 删除女优

- **WHEN** 管理员 DELETE 到 `/api/admin/actors/actor_123`
- **THEN** 系统删除女优，级联删除 `movie_actors` 记录，返回 204 No Content

#### Scenario: 删除女优时更新电影计数

- **WHEN** 删除女优
- **THEN** 系统更新所有关联电影的女优列表，重新计算 `movieCount`

### Requirement: 电影详情返回女优信息

系统 MUST 修改 `GET /api/movies/:id` 端点，返回关联的女优完整信息（替代原 `actors: string[]` 字段）。

- **新响应格式**：
  ```json
  {
    "id": "movie_123",
    "title": "电影标题",
    "code": "SSIS-123",
    "actors": [
      {
        "id": "actor_456",
        "name": "XXX",
        "slug": "xxx",
        "avatar": "https://cdn.starye.org/actors/xxx.jpg"
      }
    ],
    "publisher": [
      {
        "id": "pub_789",
        "name": "S1",
        "slug": "s1",
        "logo": "https://cdn.starye.org/publishers/s1.jpg"
      }
    ]
  }
  ```

#### Scenario: 获取电影详情

- **WHEN** 请求 `GET /api/movies/movie_123`
- **THEN** 系统返回电影信息，`actors` 字段为女优对象数组，按 `sortOrder` 排序

#### Scenario: 电影无女优

- **WHEN** 请求电影详情，但该电影无关联女优
- **THEN** 系统返回 `actors: []`

### Requirement: 爬虫自动关联女优

系统 MUST 在爬取电影时，自动解析女优列表并创建关联。

- **流程**：
  1. 解析电影页面，提取女优 `name` 和 `sourceUrl`
  2. 查询数据库：是否存在 `source` + `sourceId` 匹配的女优
  3. 不存在 → 爬取女优详情页，创建女优实体
  4. 创建 `movie_actors` 关联记录
  5. 更新女优 `movieCount`

#### Scenario: 爬取电影时自动创建女优

- **WHEN** 爬虫爬取电影 SSIS-123，解析出女优 "XXX"
- **THEN** 系统检查 "XXX" 是否存在，不存在则爬取详情页创建，最后创建关联

#### Scenario: 爬取电影时复用已有女优

- **WHEN** 爬虫爬取电影 SSIS-456，解析出已存在的女优 "XXX"
- **THEN** 系统直接创建关联，不重复爬取女优详情

#### Scenario: 女优详情爬取失败

- **WHEN** 爬虫无法访问女优详情页（404 或反爬拦截）
- **THEN** 系统仅使用 `name` 创建占位符女优，`hasDetailsCrawled = false`，仍创建关联

#### Scenario: 女优爬取失败次数限制

- **WHEN** 女优 `crawlFailureCount >= 3`
- **THEN** 系统跳过详情页爬取，直接使用占位符

### Requirement: Movie App - 女优列表页

系统 MUST 在 Movie App 中提供女优列表页（路由 `/actors`），支持以下功能：

- **默认排序**：按名称字母顺序
- **筛选器**：
  - 国籍下拉框
  - 活跃状态切换
  - 是否有详情筛选
- **卡片展示**：头像、名称、作品数量
- **点击跳转**：点击卡片跳转到女优详情页

#### Scenario: 访问女优列表页

- **WHEN** 用户访问 `/actors`
- **THEN** 系统展示女优列表，默认按名称排序，每页 20 条

#### Scenario: 筛选日本女优

- **WHEN** 用户选择国籍 "日本"
- **THEN** 系统刷新列表，仅显示日本女优

#### Scenario: 切换活跃状态

- **WHEN** 用户切换 "仅显示活跃女优"
- **THEN** 系统过滤掉 `isActive = false` 的女优

#### Scenario: 滚动加载更多

- **WHEN** 用户滚动到列表底部
- **THEN** 系统加载下一页女优

### Requirement: Movie App - 女优详情页

系统 MUST 在 Movie App 中提供女优详情页（路由 `/actors/:slug`），展示以下内容：

- **头部**：封面大图、头像、名称、国籍
- **资料卡片**：生日、身高、三围、罩杯、血型、出道日期、活跃状态
- **社交链接**：Twitter、Instagram 等（如有）
- **作品列表**：该女优的所有电影，按发布日期降序排序

#### Scenario: 访问女优详情页

- **WHEN** 用户访问 `/actors/xxx`
- **THEN** 系统展示女优完整资料和作品列表

#### Scenario: 女优无详情

- **WHEN** 访问 `hasDetailsCrawled = false` 的女优
- **THEN** 系统展示名称和作品列表，其他字段显示占位符（如 "信息待补全"）

#### Scenario: 点击作品跳转

- **WHEN** 用户点击作品卡片
- **THEN** 系统跳转到电影详情页

### Requirement: Dashboard - 女优管理页增强筛选

系统 MUST 在 Dashboard 的女优管理页（`/dashboard/actors`）新增筛选器：

- **是否有详情**：筛选 `hasDetailsCrawled = false` 的女优
- **失败次数**：筛选 `crawlFailureCount > 0` 的女优
- **活跃状态**：筛选 `isActive` 字段

#### Scenario: 筛选待补全女优

- **WHEN** 管理员选择 "无详情" 筛选器
- **THEN** 系统展示所有 `hasDetailsCrawled = false` 的女优

#### Scenario: 筛选失败记录

- **WHEN** 管理员选择 "失败次数 > 0"
- **THEN** 系统展示所有 `crawlFailureCount > 0` 的女优

#### Scenario: 批量补全详情

- **WHEN** 管理员勾选多个待补全女优，点击 "重新爬取"
- **THEN** 系统触发后台任务，尝试爬取这些女优的详情页

### Requirement: Dashboard - 电影编辑页选择女优

系统 MUST 在 Dashboard 的电影编辑页新增女优选择器组件，支持：

- **搜索**：输入名称模糊搜索
- **多选**：可选择多个女优
- **排序**：拖拽调整女优顺序（对应 `sortOrder`）
- **新增**：如女优不存在，支持快速创建

#### Scenario: 搜索女优

- **WHEN** 管理员在选择器中输入 "XXX"
- **THEN** 系统展示匹配的女优列表

#### Scenario: 选择多个女优

- **WHEN** 管理员勾选 3 个女优
- **THEN** 系统将这些女优添加到电影的关联列表

#### Scenario: 调整女优顺序

- **WHEN** 管理员拖拽女优卡片
- **THEN** 系统更新 `sortOrder` 字段

#### Scenario: 快速创建女优

- **WHEN** 管理员输入不存在的女优名称，点击 "创建"
- **THEN** 系统弹出创建表单，填写后保存并自动关联到电影

