## ADDED Requirements

### Requirement: 漫画级别去重检查
系统 SHALL 在处理漫画前查询数据库状态，跳过已完整爬取的漫画。

#### Scenario: 跳过已完成的漫画
- **WHEN** 漫画的 `crawl_status` 为 `complete` 且 `is_serializing` 为 `false`（已完结）
- **THEN** 系统跳过该漫画的所有处理
- **AND** 记录日志"跳过已完结漫画: {title}"

#### Scenario: 检查连载中漫画的更新
- **WHEN** 漫画的 `crawl_status` 为 `complete` 且 `is_serializing` 为 `true`（连载中）
- **THEN** 系统获取最新章节列表
- **AND** 对比数据库已有章节
- **AND** 仅处理新增的章节

#### Scenario: 继续处理未完成的漫画
- **WHEN** 漫画的 `crawl_status` 为 `pending` 或 `partial`
- **THEN** 系统处理该漫画
- **AND** 应用章节数量限制策略

### Requirement: 优先级队列排序
系统 SHALL 根据漫画状态和类型对爬取队列进行优先级排序。

#### Scenario: 优先级排序规则
- **WHEN** 获取到漫画列表
- **THEN** 系统按以下优先级排序：
  1. 连载中 + 有新章节 + 最近更新（7天内）
  2. 新漫画（`crawl_status` = `pending`）
  3. 部分完成的漫画（`crawl_status` = `partial`）
  4. 其他
- **AND** 同优先级内按 `lastCrawledAt` 升序排列

### Requirement: 章节数量限制
系统 SHALL 根据漫画状态限制单次处理的章节数量。

#### Scenario: 新漫画限制章节数
- **WHEN** 漫画 `crawl_status` 为 `pending` 且总章节数 > 配置的 `maxChaptersPerNew`（默认 5）
- **THEN** 系统仅处理前 N 章（从第 1 章开始）
- **AND** 更新 `crawl_status` 为 `partial`
- **AND** 记录 `crawled_chapters = N`

#### Scenario: 更新时限制章节数
- **WHEN** 连载中漫画有 > 配置的 `maxChaptersPerUpdate`（默认 20）个新章节
- **THEN** 系统仅处理最新的 20 章
- **AND** 记录日志"章节过多，仅处理最新 20 章"

#### Scenario: 渐进完成部分爬取的漫画
- **WHEN** 漫画 `crawl_status` 为 `partial`
- **THEN** 系统从 `crawled_chapters + 1` 开始继续爬取
- **AND** 最多处理 `maxChaptersPerNew` 章（默认 5）
- **AND** 直到所有章节完成，更新 `crawl_status` 为 `complete`

### Requirement: 每次运行的漫画数量限制
系统 SHALL 限制单次运行处理的漫画总数，确保在时限内完成。

#### Scenario: 应用漫画数量上限
- **WHEN** 列表中有 28 个漫画需要处理
- **AND** 配置的 `maxMangasPerRun` 为 15
- **THEN** 系统仅处理前 15 个（按优先级）
- **AND** 剩余 13 个留待下次运行

#### Scenario: 少于上限时全部处理
- **WHEN** 列表中有 8 个漫画需要处理
- **AND** 配置的 `maxMangasPerRun` 为 15
- **THEN** 系统处理全部 8 个漫画

### Requirement: 软超时机制
系统 SHALL 实现软超时保护，避免 GitHub Actions 6 小时硬超时导致数据丢失。

#### Scenario: 接近超时自动停止
- **WHEN** 运行时长超过配置的 `timeoutMinutes`（默认 300 分钟）
- **THEN** 系统停止接收新的漫画任务
- **AND** 等待当前正在处理的任务完成
- **AND** 记录日志"接近超时限制，优雅退出"
- **AND** 返回成功状态码

#### Scenario: 正常完成无超时
- **WHEN** 所有漫画处理完成且未超时
- **THEN** 系统正常退出
- **AND** 记录统计信息（处理数量、耗时等）

### Requirement: 批量状态查询优化
系统 SHALL 使用批量 API 查询漫画状态，避免 N+1 查询问题。

#### Scenario: 一次查询所有漫画状态
- **WHEN** 获取到 28 个漫画的 slug 列表
- **THEN** 系统调用批量状态查询 API：`GET /api/admin/comics/batch-status?slugs=slug1,slug2,...`
- **AND** 一次请求返回所有漫画的状态信息
- **AND** 不再逐个查询单个漫画状态
