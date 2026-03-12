## ADDED Requirements

### Requirement: 配置文件结构
系统 SHALL 提供结构化的配置对象，包含所有可调整的参数。

#### Scenario: 配置对象包含完整参数
- **WHEN** 爬虫启动时加载配置
- **THEN** 配置对象 MUST 包含以下部分：
  - `concurrency`: 并发控制参数（manga, chapter, imageBatch）
  - `limits`: 限流控制参数（maxMangasPerRun, maxChaptersPerNew, maxChaptersPerUpdate, timeoutMinutes）
  - `incremental`: 增量策略开关（enabled, skipCompleted, prioritizeUpdates）
  - `retry`: 重试策略参数（maxAttempts, backoffMs）

#### Scenario: 配置参数有类型约束
- **WHEN** 加载配置文件
- **THEN** 所有并发数 MUST 为正整数
- **AND** 超时时间 MUST 为正数（分钟）
- **AND** 布尔开关 MUST 为 true/false

### Requirement: 环境检测
系统 SHALL 自动检测运行环境并应用对应配置。

#### Scenario: 检测 GitHub Actions 环境
- **WHEN** 环境变量 `CI` = "true"
- **THEN** 配置对象的 `isCI` 字段为 true
- **AND** 自动应用 GitHub Actions 优化配置

#### Scenario: 本地开发环境
- **WHEN** 环境变量 `CI` 不存在或为 "false"
- **THEN** 配置对象的 `isCI` 字段为 false
- **AND** 可以使用更激进的并发配置（可选）

### Requirement: 环境变量覆盖
系统 SHALL 支持通过环境变量覆盖默认配置。

#### Scenario: 环境变量覆盖并发数
- **WHEN** 设置环境变量 `CRAWLER_MANGA_CONCURRENCY=5`
- **THEN** 配置的 `concurrency.manga` 为 5（而非默认 2）

#### Scenario: 环境变量覆盖限流参数
- **WHEN** 设置环境变量 `CRAWLER_MAX_MANGAS=20`
- **THEN** 配置的 `limits.maxMangasPerRun` 为 20（而非默认 15）

#### Scenario: 无环境变量使用默认值
- **WHEN** 未设置任何环境变量
- **THEN** 所有配置使用代码中定义的默认值

### Requirement: 配置验证
系统 SHALL 在启动时验证配置参数的合法性。

#### Scenario: 并发数不能为 0
- **WHEN** 配置的任何并发数 ≤ 0
- **THEN** 系统抛出错误："并发数必须为正整数"
- **AND** 爬虫不启动

#### Scenario: 超时时间合理性检查
- **WHEN** 配置的 `timeoutMinutes` > 350 且运行在 CI 环境
- **THEN** 系统记录警告："超时设置超过 GitHub Actions 限制（360 分钟）"

#### Scenario: 章节限制合理性
- **WHEN** `maxChaptersPerNew` > `maxChaptersPerUpdate`
- **THEN** 系统记录警告："新漫画章节限制大于更新限制，可能不合理"

### Requirement: 配置日志输出
系统 SHALL 在启动时输出当前使用的配置参数。

#### Scenario: 启动日志包含配置信息
- **WHEN** 爬虫启动
- **THEN** 日志 MUST 包含：
  - 运行环境（CI/本地）
  - 并发配置（manga/chapter/imageBatch）
  - 限流配置（maxMangasPerRun, maxChaptersPerNew）
  - 增量策略状态（enabled/disabled）

#### Scenario: 敏感信息不输出
- **WHEN** 输出配置日志
- **THEN** 不包含 API tokens、secrets 等敏感信息

### Requirement: 运行时配置不可变
系统 SHALL 确保配置在运行时不被修改。

#### Scenario: 配置对象为只读
- **WHEN** 爬虫运行过程中
- **THEN** 配置对象 MUST 为 frozen（Object.freeze）
- **AND** 尝试修改配置抛出错误

### Requirement: 配置文件位置
系统 SHALL 使用约定的配置文件位置。

#### Scenario: 配置文件路径
- **WHEN** 爬虫启动时查找配置
- **THEN** 按以下顺序查找：
  1. `packages/crawler/src/config/crawl.config.ts`（代码内默认配置）
  2. 环境变量覆盖
- **AND** 不支持外部配置文件（简化实现）
