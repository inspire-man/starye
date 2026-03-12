## ADDED Requirements

### Requirement: 漫画爬取状态字段
系统 SHALL 在 `comics` 表中添加爬取状态相关字段。

#### Scenario: 数据库 schema 包含状态字段
- **WHEN** 执行数据库迁移
- **THEN** `comics` 表 MUST 包含以下字段：
  - `crawl_status`: TEXT ('pending' | 'partial' | 'complete')，默认 'pending'
  - `last_crawled_at`: INTEGER (timestamp)，可为 NULL
  - `total_chapters`: INTEGER，默认 0
  - `crawled_chapters`: INTEGER，默认 0
  - `is_serializing`: INTEGER (boolean)，默认 1 (true)

#### Scenario: 向后兼容性
- **WHEN** 现有漫画数据没有新字段
- **THEN** 新字段值为默认值
- **AND** 系统将其视为 `pending` 状态，正常处理

### Requirement: 爬取状态更新
系统 SHALL 在爬取过程中更新漫画的状态字段。

#### Scenario: 开始爬取新漫画
- **WHEN** 开始处理 `crawl_status` 为 `pending` 的漫画
- **THEN** 系统更新 `last_crawled_at` 为当前时间
- **AND** 记录 `total_chapters` 为章节列表长度

#### Scenario: 部分完成更新状态
- **WHEN** 漫画处理了部分章节（因章节限制）
- **THEN** 系统更新 `crawled_chapters` 为已处理数量
- **AND** 更新 `crawl_status` 为 `partial`
- **AND** 更新 `last_crawled_at` 为当前时间

#### Scenario: 完成所有章节
- **WHEN** 漫画的所有章节都已处理完成
- **THEN** 系统更新 `crawl_status` 为 `complete`
- **AND** 更新 `crawled_chapters` = `total_chapters`
- **AND** 更新 `last_crawled_at` 为当前时间

#### Scenario: 发现新章节更新计数
- **WHEN** 连载中漫画有新章节被处理
- **THEN** 系统增加 `total_chapters` 计数
- **AND** 增加 `crawled_chapters` 计数
- **AND** 保持 `crawl_status` 为 `complete`（连载中始终 complete）

### Requirement: 状态查询接口
系统 SHALL 提供查询漫画爬取状态的 API 接口。

#### Scenario: 单个漫画状态查询
- **WHEN** 调用 `GET /api/admin/comics/{slug}/status`
- **THEN** 返回该漫画的爬取状态信息：
  ```json
  {
    "exists": true,
    "status": "partial",
    "totalChapters": 45,
    "crawledChapters": 5,
    "lastCrawledAt": "2026-03-10T10:00:00Z",
    "isSerializing": true
  }
  ```

#### Scenario: 批量漫画状态查询
- **WHEN** 调用 `GET /api/admin/comics/batch-status?slugs=manga1,manga2,manga3`
- **THEN** 返回所有漫画的状态信息（Map 格式）
- **AND** 不存在的漫画返回 `{ exists: false }`

#### Scenario: 状态查询需要认证
- **WHEN** 调用状态查询接口
- **THEN** 请求 MUST 包含有效的 `x-service-token` 或管理员 Session
- **AND** 未认证请求返回 401 Unauthorized

### Requirement: 失败任务记录
系统 SHALL 记录处理失败的漫画和章节，便于后续排查和重试。

#### Scenario: 章节处理失败不更新计数
- **WHEN** 某个章节处理失败（抛出异常）
- **THEN** 系统记录错误日志
- **AND** 不增加 `crawled_chapters` 计数
- **AND** 该章节保持"未处理"状态

#### Scenario: 下次运行自动重试失败章节
- **WHEN** 下次爬取运行时检查章节列表
- **THEN** 系统获取已存在的章节 slugs
- **AND** 未在列表中的章节视为"未处理"
- **AND** 自动重新尝试处理

### Requirement: 进度查询和监控
系统 SHALL 提供爬取进度的查询和统计功能。

#### Scenario: 获取整体爬取进度
- **WHEN** 调用 `GET /api/admin/comics/crawl-progress`
- **THEN** 返回爬取进度统计：
  ```json
  {
    "total": 156,
    "pending": 20,
    "partial": 15,
    "complete": 121,
    "serializing": 45
  }
  ```

#### Scenario: 日志包含进度信息
- **WHEN** 爬虫处理每个漫画
- **THEN** 日志 MUST 包含进度信息："处理漫画 8/15 - {title}"
- **AND** 显示预计剩余时间（可选）
