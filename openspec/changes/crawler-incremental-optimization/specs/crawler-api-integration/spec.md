## MODIFIED Requirements

### Requirement: 批量漫画状态查询 API
系统 MUST 提供批量查询漫画爬取状态的 API 端点，支持一次查询多个漫画的状态信息。

#### Scenario: 批量查询接口定义
- **WHEN** 调用 `GET /api/admin/comics/batch-status`
- **AND** Query 参数 `slugs` 为逗号分隔的 slug 列表（如 "manga1,manga2,manga3"）
- **THEN** 返回 200 OK 和 JSON 对象：
  ```json
  {
    "manga1": {
      "exists": true,
      "status": "complete",
      "totalChapters": 45,
      "crawledChapters": 45,
      "lastCrawledAt": "2026-03-10T10:00:00Z",
      "isSerializing": true
    },
    "manga2": {
      "exists": false
    }
  }
  ```

#### Scenario: 批量查询性能要求
- **WHEN** 查询 30 个漫画的状态
- **THEN** 响应时间 MUST < 500ms
- **AND** 使用单次数据库查询（SQL IN 子句）

#### Scenario: 批量查询需要认证
- **WHEN** 调用批量状态查询接口
- **THEN** 请求 MUST 包含有效的 `x-service-token` Header
- **OR** 请求 MUST 包含管理员 Session Cookie
- **AND** 未认证请求返回 401 Unauthorized

#### Scenario: slugs 参数为空
- **WHEN** Query 参数 `slugs` 为空字符串或不存在
- **THEN** 返回 400 Bad Request
- **AND** 错误信息："slugs parameter is required"

#### Scenario: 单个 slug 查询兼容
- **WHEN** Query 参数 `slugs` 只包含一个 slug
- **THEN** 返回格式与多个 slug 一致（对象形式）
- **AND** 不返回数组

### Requirement: 漫画爬取进度更新 API
系统 MUST 提供更新漫画爬取进度的 API 端点。

#### Scenario: 更新爬取进度
- **WHEN** 调用 `POST /api/admin/comics/{slug}/progress`
- **AND** Body 为：
  ```json
  {
    "status": "partial",
    "crawledChapters": 5,
    "totalChapters": 45
  }
  ```
- **THEN** 更新数据库中对应漫画的状态
- **AND** 自动更新 `last_crawled_at` 为当前时间
- **AND** 返回 200 OK

#### Scenario: 进度更新需要认证
- **WHEN** 调用进度更新接口
- **THEN** 请求 MUST 包含有效的 `x-service-token` Header
- **AND** 未认证请求返回 401 Unauthorized

#### Scenario: 漫画不存在时创建
- **WHEN** 更新不存在的漫画进度
- **THEN** 系统自动创建漫画记录（如果有基本信息）
- **OR** 返回 404 Not Found（如果无法创建）

#### Scenario: 并发更新冲突处理
- **WHEN** 两个请求同时更新同一漫画进度
- **THEN** 使用数据库事务保证原子性
- **AND** 后到达的请求覆盖前一个（last-write-wins）

### Requirement: 已存在章节查询优化
系统 MUST 优化已存在章节的查询接口，支持缓存和批量查询。

#### Scenario: 章节查询支持缓存
- **WHEN** 调用 `GET /api/admin/comics/{slug}/existing-chapters`
- **THEN** 响应包含 `Cache-Control` Header
- **AND** 缓存时间为 5 分钟（爬取期间章节不变）

#### Scenario: 返回章节 slugs 数组
- **WHEN** 查询已存在章节
- **THEN** 返回章节 slug 数组（字符串数组）
- **AND** 不包含完整章节对象（减少数据传输）

### Requirement: 爬取统计查询 API
系统 MUST 提供整体爬取统计信息的查询接口。

#### Scenario: 获取爬取统计
- **WHEN** 调用 `GET /api/admin/comics/crawl-stats`
- **THEN** 返回 200 OK 和统计信息：
  ```json
  {
    "total": 156,
    "pending": 20,
    "partial": 15,
    "complete": 121,
    "serializing": 45,
    "lastCrawlAt": "2026-03-11T02:00:00Z"
  }
  ```

#### Scenario: 统计信息包含时间范围
- **WHEN** Query 参数包含 `since=2026-03-01`
- **THEN** 仅统计该日期后爬取/更新的漫画

### Requirement: API 错误处理标准化
系统 MUST 为所有爬取相关 API 提供标准化的错误响应。

#### Scenario: 错误响应格式
- **WHEN** API 调用发生错误
- **THEN** 返回标准错误格式：
  ```json
  {
    "error": {
      "code": "INVALID_SLUGS",
      "message": "slugs parameter is required",
      "details": {}
    }
  }
  ```

#### Scenario: 数据库错误处理
- **WHEN** 数据库查询失败
- **THEN** 返回 500 Internal Server Error
- **AND** 记录详细错误日志（但不暴露给客户端）
- **AND** 错误信息："Database operation failed"

### Requirement: API 性能监控
系统 SHOULD 记录批量查询 API 的性能指标。

#### Scenario: 记录查询耗时
- **WHEN** 批量状态查询完成
- **THEN** 日志包含查询耗时："批量查询 28 个漫画，耗时 245ms"

#### Scenario: 慢查询告警
- **WHEN** 批量查询耗时 > 1 秒
- **THEN** 记录警告日志："批量查询过慢，耗时 {duration}ms"
