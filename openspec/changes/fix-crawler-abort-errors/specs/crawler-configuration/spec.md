# 爬虫配置能力规范

## ADDED Requirements

### Requirement: 反检测配置

爬虫 **SHALL** 支持通过配置文件或环境变量设置反检测相关参数。

#### Scenario: 配置延迟参数

- **WHEN** 读取爬虫配置
- **THEN** 系统 **MUST** 支持以下延迟配置项：
  - `baseDelay`: 基础延迟时间（ms）
  - `randomDelay`: 随机延迟范围（ms）
  - `errorBackoffMultiplier`: 错误退避倍数
  - `maxDelay`: 最大延迟上限（ms）

#### Scenario: 配置重试参数

- **WHEN** 读取错误恢复配置
- **THEN** 系统 **MUST** 支持以下重试配置项：
  - `maxRetries`: 最大重试次数（默认 3）
  - `retryDelayMultiplier`: 重试延迟倍数（默认 2.0）
  - `longBackoffDuration`: 长时间退避时长（ms，默认 60000）

#### Scenario: 配置请求头模板

- **WHEN** 读取反检测配置
- **THEN** 系统 **SHOULD** 支持自定义请求头模板
- **AND** 至少提供 2 套预设模板

#### Scenario: 配置成功率阈值

- **WHEN** 读取监控配置
- **THEN** 系统 **MUST** 支持以下配置项：
  - `successRateWindow`: 成功率窗口大小（默认 20）
  - `lowSuccessRateThreshold`: 低成功率阈值（默认 0.7）
  - `autoSlowdownMultiplier`: 自动降速倍数（默认 1.5）

### Requirement: 环境特定配置

爬虫 **SHALL** 根据运行环境（本地 vs GitHub Actions）自动调整配置。

#### Scenario: 检测运行环境

- **WHEN** 爬虫初始化
- **THEN** 系统 **MUST** 检测环境变量 `CI` 或 `GITHUB_ACTIONS`
- **AND** 如存在，判定为 CI 环境

#### Scenario: CI 环境使用保守配置

- **WHEN** 运行在 CI 环境
- **THEN** 系统 **SHALL** 使用更保守的参数：
  - 更长的基础延迟（8-10 秒）
  - 更低的并发数（1-2）
  - 更多的重试次数（3-5）

#### Scenario: 本地环境使用快速配置

- **WHEN** 运行在本地开发环境
- **THEN** 系统 **MAY** 使用更快的参数：
  - 较短的延迟（3-5 秒）
  - 适中的并发数（2-4）
  - 标准重试次数（2-3）

#### Scenario: 环境变量覆盖

- **WHEN** 设置了特定的环境变量（如 `CRAWLER_BASE_DELAY`）
- **THEN** 系统 **MUST** 使用环境变量值覆盖默认配置
- **AND** 优先级：环境变量 > 环境特定配置 > 默认配置

### Requirement: 爬虫策略配置

爬虫 **SHALL** 允许每个策略（site-92hm、javbus 等）使用不同的配置。

#### Scenario: 策略级配置覆盖

- **WHEN** 初始化特定爬虫策略
- **THEN** 策略 **MAY** 提供自己的配置覆盖
- **AND** 覆盖应只影响该策略实例

#### Scenario: 漫画爬虫专用配置

- **WHEN** 初始化 site-92hm 策略
- **THEN** 系统 **SHALL** 应用漫画爬虫的特定配置：
  - `baseDelay`: 8000ms（较保守）
  - `maxRetries`: 3
  - `enableSessionManagement`: true
  - `enableHeaderRotation`: true

#### Scenario: 影片爬虫专用配置

- **WHEN** 初始化 javbus 策略
- **THEN** 系统 **SHALL** 应用影片爬虫的特定配置：
  - `baseDelay`: 6000ms（当前稳定值）
  - `detailConcurrency`: 2（可选优化为 3）
  - `maxRetries`: 2

### Requirement: 配置验证

爬虫 **SHALL** 验证配置的合法性，避免不合理的参数导致问题。

#### Scenario: 验证延迟范围

- **WHEN** 加载延迟配置
- **THEN** 系统 **MUST** 验证：
  - `baseDelay` >= 1000ms（至少 1 秒）
  - `maxDelay` >= `baseDelay`
  - `errorBackoffMultiplier` >= 1.0

#### Scenario: 验证重试参数

- **WHEN** 加载重试配置
- **THEN** 系统 **MUST** 验证：
  - `maxRetries` 在 0-10 范围内
  - `retryDelayMultiplier` >= 1.0
  - `longBackoffDuration` >= 10000ms

#### Scenario: 配置验证失败

- **WHEN** 配置验证失败
- **THEN** 系统 **MUST** 输出错误日志
- **AND** 使用默认安全值
- **AND** 明确告知用户哪个配置项有问题

### Requirement: 配置文档化

每个配置项 **SHALL** 有清晰的文档说明。

#### Scenario: 配置项类型定义

- **WHEN** 开发者查看配置类型
- **THEN** 每个配置项 **MUST** 有 TypeScript 类型定义
- **AND** 包含 JSDoc 注释说明用途

#### Scenario: 配置示例

- **WHEN** 用户查看配置文档
- **THEN** 系统 **SHOULD** 提供完整的配置示例
- **AND** 包含不同场景的推荐值

#### Scenario: 默认值文档

- **WHEN** 配置项未设置
- **THEN** 文档 **MUST** 明确说明默认值
- **AND** 解释为什么选择该默认值

### Requirement: 运行时配置调整

爬虫 **SHOULD** 支持在运行时根据情况动态调整部分配置。

#### Scenario: 自动增加延迟

- **WHEN** 成功率低于阈值
- **THEN** 系统 **SHALL** 自动增加当前延迟时间
- **AND** 增加幅度由 `autoSlowdownMultiplier` 控制

#### Scenario: 记录配置变更

- **WHEN** 配置在运行时被调整
- **THEN** 系统 **MUST** 输出日志记录变更
- **AND** 日志 **SHOULD** 包含旧值和新值

#### Scenario: 配置恢复

- **WHEN** 成功率恢复到正常水平
- **THEN** 系统 **MAY** 逐渐恢复到原始配置
- **AND** 恢复 **MUST** 是渐进的（每次减少 10-20%）
