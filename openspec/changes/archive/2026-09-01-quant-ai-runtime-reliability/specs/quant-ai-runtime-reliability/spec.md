## Purpose

让 Quant 的 AI 研究请求在长耗时中转场景下持续可观察、可配置、可重试，同时把完整性校验和确定性研究结论保持在可靠边界内。

## ADDED Requirements

### Requirement: AI 运行参数必须按用户持久化并可回读

系统 MUST 为每个用户保存 `responseMode` 和 `generationTimeoutMs`。响应模式 MUST 为 `stream` 或 `json`；生成预算 MUST 位于 300000 至 600000 毫秒之间。新配置和历史配置缺少字段时，服务端 MUST 使用 `stream` 与 300000 毫秒默认值，并通过同一用户边界回读实际保存值。部署环境预算可以进一步限制单次请求，但不能放宽用户配置的上限。

#### Scenario: 保存并回读运行参数

- **WHEN** 用户保存合法的流式模式和 600000 毫秒预算
- **THEN** AI 配置 API 返回对应字段
- **AND** 后续 AI 请求使用该用户的流式模式与有效预算

#### Scenario: 拒绝越界运行参数

- **WHEN** 请求提交未知响应模式、低于 300000 或高于 600000 毫秒的预算
- **THEN** API 返回受控的配置校验错误
- **AND** 已保存配置保持原值

### Requirement: AI transport 必须同时支持 SSE 与完整 JSON

transport MUST 按运行配置发送 `stream: true` 或 `stream: false`。流式响应 MUST 解析 `data:` 事件中的增量文本、完成原因和 `[DONE]` 标记，再将完整内容交给现有结构化响应校验；完整 JSON 响应 MUST 保持现有 Chat Completions 与 Responses 形状兼容。半截、空内容、非法 JSON、超出长度或 `length` 完成原因 MUST 生成受控错误，且不得进入 AI 研究快照。

#### Scenario: 中转平台返回流式内容

- **WHEN** AI 以多个 SSE 事件返回结构化 JSON 文本并以 `[DONE]` 结束
- **THEN** transport 合并增量文本并返回完整内容与完成原因
- **AND** 上层研究流程按原有版本、枚举、证据引用和内容边界执行校验

#### Scenario: 中转平台返回非流式内容

- **WHEN** 用户选择 JSON 模式且 AI 返回完整 JSON 响应
- **THEN** transport 返回与现有调用方兼容的内容结果
- **AND** 请求体中的 `stream` 为 `false`

### Requirement: 长耗时和 524 必须形成可识别的失败状态

AI 请求达到本地预算或上游返回 HTTP 524 时，系统 MUST 返回 AI 超时错误码和可读原因；该错误 MUST 与结构化响应错误、配置错误和普通上游错误区分。超时结果 MUST 保留确定性研究报告、因子分数、参考价格和当前已保存快照，用户可以在现有 AI 入口重新发起请求。

#### Scenario: Gateway 返回 524

- **WHEN** 中转平台或 Gateway 返回 HTTP 524
- **THEN** API 将其归类为 AI timeout 并返回 504 语义
- **AND** 页面显示超时原因与重试入口，确定性结论保持可见

#### Scenario: 本地预算耗尽

- **WHEN** 请求超过有效生成预算且上游尚未完成
- **THEN** transport 中止请求并返回受控超时错误
- **AND** 半截内容不会写入摘要、决策助手或候选 AI 会话

### Requirement: 配置界面必须显示实际运行选择和完整性边界

AI 配置界面 MUST 提供流式/非流式模式控件与 5/10 分钟预算控件，并显示当前保存值。AI 失败时，研究详情 MUST 保留确定性研究状态、证据缺口和失败原因；页面在 390px 视口下 MUST 换行且无页面级横向溢出。

#### Scenario: 用户检查 AI 运行方式

- **WHEN** 用户打开已保存的 AI 配置
- **THEN** 可以看到当前响应模式和生成预算
- **AND** 未保存修改时测试按钮和保存状态仍遵循现有配置边界

#### Scenario: AI 超时后查看研究详情

- **WHEN** AI 请求超时或返回 524
- **THEN** 研究详情显示确定性结论、数据完整性状态和超时原因
- **AND** AI 未完成内容不会被标记为已纳入或已持久化
