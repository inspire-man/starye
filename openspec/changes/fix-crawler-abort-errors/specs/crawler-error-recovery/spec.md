# 爬虫错误恢复能力规范

## ADDED Requirements

### Requirement: 错误分类

爬虫 **SHALL** 对不同类型的错误进行分类，并采取相应的处理策略。

#### Scenario: 识别 ERR_ABORTED 错误

- **WHEN** 捕获到错误对象
- **AND** 错误消息包含 "ERR_ABORTED"
- **THEN** 系统 **MUST** 将其分类为 "连接被主动中止" 错误
- **AND** 应用最高级别的重试策略

#### Scenario: 识别 TimeoutError

- **WHEN** 捕获到错误对象
- **AND** 错误类型为 `TimeoutError` 或消息包含 "timeout"
- **THEN** 系统 **MUST** 将其分类为 "导航超时" 错误
- **AND** 增加超时时间后重试

#### Scenario: 识别 ERR_CONNECTION_REFUSED

- **WHEN** 捕获到错误对象
- **AND** 错误消息包含 "ERR_CONNECTION_REFUSED"
- **THEN** 系统 **MUST** 将其分类为 "连接被拒绝" 错误
- **AND** 触发长时间退避（可能 IP 被封）

#### Scenario: 识别 HTTP 4xx/5xx 错误

- **WHEN** HTTP 响应状态码为 4xx 或 5xx
- **THEN** 系统 **MUST** 将其分类为 "HTTP 错误"
- **AND** 跳过重试（资源不存在或服务器错误）

#### Scenario: 未知错误处理

- **WHEN** 错误不匹配任何已知类型
- **THEN** 系统 **SHALL** 将其分类为 "未知错误"
- **AND** 应用标准重试策略（最多 2 次）

### Requirement: 智能重试策略

爬虫 **SHALL** 根据错误类型实施不同的重试策略。

#### Scenario: ERR_ABORTED 重试

- **WHEN** 发生 ERR_ABORTED 错误
- **THEN** 系统应立即增加延迟时间（2 倍基础延迟）
- **AND** 更换请求头配置
- **AND** 最多重试 3 次
- **AND** 如 3 次后仍失败，跳过该资源

#### Scenario: Timeout 重试

- **WHEN** 发生导航超时错误
- **THEN** 系统应增加超时限制（1.5 倍）
- **AND** 最多重试 2 次
- **AND** 如仍超时，跳过该资源

#### Scenario: Connection Refused 重试

- **WHEN** 发生连接被拒绝错误
- **THEN** 系统应等待至少 60 秒（长时间退避）
- **AND** 仅重试 1 次
- **AND** 如仍被拒绝，**MUST** 中止整个爬取任务（可能 IP 被封）

#### Scenario: HTTP 错误不重试

- **WHEN** 发生 404 或 500 等 HTTP 错误
- **THEN** 系统 **MUST NOT** 重试
- **AND** 记录错误日志
- **AND** 继续处理下一个资源

#### Scenario: 重试次数限制

- **WHEN** 达到最大重试次数
- **THEN** 系统 **MUST** 停止重试该资源
- **AND** 记录最终失败日志
- **AND** 继续处理队列中的其他资源

### Requirement: 错误上下文管理

爬虫 **SHALL** 维护每个爬取任务的错误上下文，用于决策重试策略。

#### Scenario: 创建错误上下文

- **WHEN** 开始处理一个新资源
- **THEN** 系统应创建错误上下文对象
- **AND** 上下文 **MUST** 包含：
  - 当前重试次数
  - 当前延迟时间
  - 当前超时设置
  - 资源 URL
  - 请求头配置

#### Scenario: 更新错误上下文

- **WHEN** 发生错误并决定重试
- **THEN** 系统应更新上下文中的重试次数
- **AND** 根据错误类型调整延迟和超时参数
- **AND** 可能更换请求头配置

#### Scenario: 传递错误上下文

- **WHEN** 调用重试逻辑
- **THEN** 系统 **SHALL** 传递完整的错误上下文
- **AND** 重试函数应基于上下文做出决策

### Requirement: 请求头轮换

爬虫 **SHALL** 支持在重试时更换请求头配置，以绕过检测。

#### Scenario: 准备多套请求头

- **WHEN** 爬虫初始化
- **THEN** 系统应准备多套真实的请求头配置（至少 2 套）
- **AND** 每套配置应略有差异（不同 User-Agent、Accept-Language 等）

#### Scenario: 轮换请求头

- **WHEN** ERR_ABORTED 错误发生且需要重试
- **THEN** 系统应切换到下一套请求头配置
- **AND** 应用新配置到 Page 对象
- **AND** 记录切换事件到日志

#### Scenario: 请求头循环使用

- **WHEN** 所有预设配置都已使用
- **THEN** 系统应从第一套配置重新开始
- **AND** 可选择性添加更多随机性

### Requirement: 失败任务记录

爬虫 **SHALL** 记录所有失败的任务，便于后续分析和恢复。

#### Scenario: 记录失败任务

- **WHEN** 资源处理最终失败（超过最大重试次数）
- **THEN** 系统 **MUST** 记录以下信息：
  - 资源 URL
  - 失败原因（错误类型）
  - 尝试次数
  - 最后一次错误消息
  - 时间戳

#### Scenario: 输出失败摘要

- **WHEN** 爬取任务完成
- **THEN** 系统 **SHALL** 输出失败任务的统计信息
- **AND** 包含失败 URL 列表
- **AND** 按错误类型分组显示

#### Scenario: 失败任务恢复

- **WHEN** 需要重新爬取失败的资源
- **THEN** 系统 **SHOULD** 支持从失败记录中读取 URL 列表
- **AND** 使用更保守的参数（更长延迟、更低并发）重新爬取

### Requirement: IP 封禁检测

爬虫 **SHALL** 检测 IP 被封禁的情况，并采取相应措施。

#### Scenario: 检测 IP 封禁信号

- **WHEN** 连续 5 次请求都发生 ERR_CONNECTION_REFUSED
- **THEN** 系统 **MUST** 判定为 IP 可能被封禁
- **AND** 输出警告日志："⚠️  疑似 IP 被封禁"

#### Scenario: 暂停爬取任务

- **WHEN** 检测到 IP 被封禁
- **THEN** 系统 **SHALL** 暂停当前爬取任务
- **AND** 等待至少 5 分钟
- **AND** 记录暂停事件

#### Scenario: 尝试恢复

- **WHEN** 等待时间结束
- **THEN** 系统 **SHOULD** 尝试访问目标网站首页
- **AND** 如仍被拒绝，**MUST** 完全中止任务
- **AND** 如成功，恢复爬取任务并降低速度（延迟增加 2 倍）
