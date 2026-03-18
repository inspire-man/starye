# public-api Specification

## Purpose
TBD - created by archiving change build-user-apps. Update Purpose after archive.
## Requirements
### Requirement: 提供漫画列表查询接口

系统 SHALL 提供 `/api/public/comics` 接口，返回漫画列表。

#### Scenario: 分页查询漫画
- **WHEN** 客户端请求 `GET /api/public/comics?page=1&limit=20`
- **THEN** 系统返回第1页的20条漫画记录（包含总数、当前页、总页数）

#### Scenario: 按分类筛选
- **WHEN** 客户端请求 `GET /api/public/comics?category=恋爱`
- **THEN** 系统返回分类为"恋爱"的所有漫画

#### Scenario: 按状态筛选
- **WHEN** 客户端请求 `GET /api/public/comics?status=ongoing`
- **THEN** 系统返回连载中的漫画

#### Scenario: 搜索漫画
- **WHEN** 客户端请求 `GET /api/public/comics?search=关键词`
- **THEN** 系统返回标题或作者包含关键词的漫画

#### Scenario: 排序
- **WHEN** 客户端请求 `GET /api/public/comics?sortBy=updatedAt&sortOrder=desc`
- **THEN** 系统按更新时间倒序返回漫画

#### Scenario: R18内容过滤（未认证用户）
- **WHEN** 未登录或未认证用户请求漫画列表
- **THEN** 系统仅返回 `isR18 = false` 的漫画

#### Scenario: R18内容可见（已认证用户）
- **WHEN** 已通过 R18 验证的用户请求漫画列表
- **THEN** 系统返回所有漫画（包括 R18）

### Requirement: 提供漫画详情查询接口

系统 SHALL 提供 `/api/public/comics/:slug` 接口，返回漫画详情。

#### Scenario: 查询非R18漫画详情
- **WHEN** 客户端请求 `GET /api/public/comics/:slug`（该漫画为非 R18）
- **THEN** 系统返回漫画的完整信息（封面、标题、作者、简介、标签、章节列表）

#### Scenario: 未认证用户查询R18漫画详情
- **WHEN** 未认证用户请求 R18 漫画详情
- **THEN** 系统返回 403 错误

#### Scenario: 已认证用户查询R18漫画详情
- **WHEN** 已认证用户请求 R18 漫画详情
- **THEN** 系统返回漫画的完整信息

#### Scenario: 查询不存在的漫画
- **WHEN** 客户端请求不存在的漫画 slug
- **THEN** 系统返回 404 错误

### Requirement: 提供章节详情查询接口

系统 SHALL 提供 `/api/public/comics/:slug/chapters/:chapterId` 接口，返回章节图片列表。

#### Scenario: 查询非R18章节详情
- **WHEN** 客户端请求某漫画的章节详情（该漫画为非 R18）
- **THEN** 系统返回该章节的所有图片 URL（数组格式）

#### Scenario: 未认证用户查询R18章节详情
- **WHEN** 未认证用户请求 R18 漫画的章节详情
- **THEN** 系统返回 403 错误

#### Scenario: 已认证用户查询R18章节详情
- **WHEN** 已认证用户请求 R18 漫画的章节详情
- **THEN** 系统返回该章节的所有图片 URL

### Requirement: 提供影片列表查询接口

系统 SHALL 提供 `/api/public/movies` 接口，返回影片列表。

#### Scenario: 分页查询影片
- **WHEN** 客户端请求 `GET /api/public/movies?page=1&limit=20`
- **THEN** 系统返回第1页的20条影片记录

#### Scenario: 按演员筛选
- **WHEN** 客户端请求 `GET /api/public/movies?actor=演员名`
- **THEN** 系统返回该演员出演的所有影片

#### Scenario: 按厂商筛选
- **WHEN** 客户端请求 `GET /api/public/movies?publisher=厂商名`
- **THEN** 系统返回该厂商发行的所有影片

#### Scenario: 按标签筛选
- **WHEN** 客户端请求 `GET /api/public/movies?genre=标签名`
- **THEN** 系统返回该标签下的所有影片

#### Scenario: 组合筛选
- **WHEN** 客户端请求 `GET /api/public/movies?actor=X&genre=Y`
- **THEN** 系统返回同时满足演员和标签条件的影片

#### Scenario: R18内容过滤（未认证用户）
- **WHEN** 未登录或未认证用户请求影片列表
- **THEN** 系统仅返回 `isR18 = false` 的影片

### Requirement: 提供影片详情查询接口

系统 SHALL 提供 `/api/public/movies/:code` 接口，返回影片详情。

#### Scenario: 查询非R18影片详情
- **WHEN** 客户端请求 `GET /api/public/movies/:code`（该影片为非 R18）
- **THEN** 系统返回影片的完整信息（封面、番号、标题、时长、发布日期、演员、厂商、系列、标签、播放源列表）

#### Scenario: 未认证用户查询R18影片详情
- **WHEN** 未认证用户请求 R18 影片详情
- **THEN** 系统返回 403 错误

#### Scenario: 已认证用户查询R18影片详情
- **WHEN** 已认证用户请求 R18 影片详情
- **THEN** 系统返回影片的完整信息

### Requirement: 提供阅读进度管理接口

系统 SHALL 提供进度保存和查询接口。

#### Scenario: 保存阅读进度
- **WHEN** 已登录用户请求 `POST /api/public/progress/reading` 并传入 `{ chapterId, page }`
- **THEN** 系统保存或更新该用户的阅读进度

#### Scenario: 查询单个阅读进度
- **WHEN** 已登录用户请求 `GET /api/public/progress/reading?chapterId=XXX`
- **THEN** 系统返回该章节的阅读进度

#### Scenario: 批量查询阅读进度
- **WHEN** 已登录用户请求 `GET /api/public/progress/reading?comicSlug=XXX`
- **THEN** 系统返回该漫画所有章节的阅读进度

#### Scenario: 未登录用户调用进度接口
- **WHEN** 未登录用户请求进度接口
- **THEN** 系统返回 401 错误

### Requirement: 提供观看进度管理接口

系统 SHALL 提供影片观看进度的保存和查询接口。

#### Scenario: 保存观看进度
- **WHEN** 已登录用户请求 `POST /api/public/progress/watching` 并传入 `{ movieCode, progress, duration }`
- **THEN** 系统保存或更新该用户的观看进度

#### Scenario: 查询观看进度
- **WHEN** 已登录用户请求 `GET /api/public/progress/watching?movieCode=XXX`
- **THEN** 系统返回该影片的观看进度

#### Scenario: 查询观看历史
- **WHEN** 已登录用户请求 `GET /api/public/progress/watching`
- **THEN** 系统返回该用户所有影片的观看进度（按更新时间倒序）

### Requirement: API支持跨域访问

系统 SHALL 配置 CORS 允许前端应用跨域访问。

#### Scenario: 预检请求
- **WHEN** 浏览器发送 OPTIONS 预检请求
- **THEN** 系统返回允许的 CORS 头（Access-Control-Allow-Origin, Access-Control-Allow-Methods 等）

#### Scenario: 携带凭证的请求
- **WHEN** 前端应用发送携带 Cookie 的请求
- **THEN** 系统返回 `Access-Control-Allow-Credentials: true` 头

### Requirement: API返回统一格式

系统 SHALL 使用统一的响应格式。

#### Scenario: 成功响应
- **WHEN** API 成功处理请求
- **THEN** 系统返回 `{ success: true, data: {...} }` 格式

#### Scenario: 错误响应
- **WHEN** API 处理失败
- **THEN** 系统返回 `{ success: false, error: { message: "错误信息", code: "ERROR_CODE" } }` 格式

#### Scenario: 分页响应
- **WHEN** API 返回分页数据
- **THEN** 系统返回 `{ success: true, data: [...], pagination: { page, limit, total, totalPages } }` 格式

