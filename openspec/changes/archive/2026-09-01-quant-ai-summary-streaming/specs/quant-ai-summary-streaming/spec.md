## ADDED Requirements

### Requirement: 研究摘要必须提供可观察的 SSE 生命周期

系统 MUST 提供 `POST /api/quant/research/runs/:runId/summary/stream`。服务端 MUST 先发送 `started`，AI transport 收到有效文本增量时发送 `delta`，最终摘要完成持久化后发送 `completed`。响应 MUST 使用 `text/event-stream` 和 `Cache-Control: no-store`，并继续执行当前用户隔离。

#### Scenario: 流式模型持续返回增量

- **WHEN** 已登录用户请求有效研究运行，且保存的 AI 响应模式为 `stream`
- **THEN** 页面先收到 `started`，随后收到一个或多个带累计字符数的 `delta`
- **AND** 最终收到经过结构化校验和持久化的 `completed` 摘要

#### Scenario: 非流式模型走同一页面入口

- **WHEN** 已登录用户保存的 AI 响应模式为 `json`
- **THEN** 页面收到 `started` 后等待完整响应
- **AND** 完整响应验证和保存成功后收到 `completed`，接口契约保持一致

### Requirement: 增量内容必须与最终研究结论隔离

系统 MUST 将增量文本限定为进度信息。半截 JSON、空响应、结构化校验失败或 D1 写入失败时，系统 MUST 发送 `error` 事件，且该请求对应的摘要记录数量保持不变。`completed` MUST 只携带已通过现有版本、枚举、证据引用和因子影响校验的视图。

#### Scenario: 上游返回半截或非法内容

- **WHEN** AI stream 在完成标记前结束，或最终内容未通过摘要结构校验
- **THEN** 客户端收到可识别的 AI 错误码和消息
- **AND** 页面保留确定性研究结论，半截内容不显示为已完成摘要

#### Scenario: 持久化失败

- **WHEN** 生成内容有效但摘要写入失败
- **THEN** 客户端收到失败事件并显示可重试状态
- **AND** 页面不接收 `completed` 事件

### Requirement: 页面必须显示流式进度并保持现有重试语义

Quant 客户端 MUST 解析 SSE 帧边界、事件类型和 JSON 数据，向摘要组件提供响应模式与累计接收字数。组件 MUST 只渲染已完成摘要作为推荐内容，生成失败时沿用现有配置入口和重试入口。页面在 390px 视口下 MUST 保持无页面级横向溢出。

#### Scenario: 用户等待 AI 复核

- **WHEN** 摘要生成仍在进行
- **THEN** 页面显示实际响应模式和已接收字符数
- **AND** 页面保持生成中状态，不把增量文本当作最终推荐

#### Scenario: 用户重试失败请求

- **WHEN** SSE 返回 AI timeout、upstream 或 invalid response 错误
- **THEN** 页面显示现有可读错误并允许再次生成
- **AND** 已保存的历史摘要和确定性报告继续可读
