## ADDED Requirements

### Requirement: AI 完整生成超时预算

Quant 的完整 AI 报告、问答、比较、变化解释、候选简报和决策复核 MUST 使用 300000 毫秒默认超时；当 `QUANT_AI_GENERATION_TIMEOUT_MS` 是正数时 MUST 使用其值，并将超过 600000 毫秒的值限制为 600000 毫秒。

#### Scenario: 默认预算允许长报告完成

- **WHEN** 未配置 `QUANT_AI_GENERATION_TIMEOUT_MS`
- **THEN** 所有完整 AI 生成器的请求截止时间为 300000 毫秒
- **AND** 生成器不会使用现有的 20000 或 30000 毫秒默认/上限

#### Scenario: 配置预算受上限保护

- **WHEN** `QUANT_AI_GENERATION_TIMEOUT_MS` 为正数
- **THEN** 服务端使用该值或 600000 毫秒中的较小值
- **AND** 非正数、非有限数和缺失值回到 300000 毫秒

### Requirement: 长 AI 路由不受普通 API 超时截断

完整 AI 生成 POST 路由 MUST 绕过普通 API 的 30000 毫秒超时，包括决策助手、研究摘要、研究问答、变化解释、研究比较、候选简报和候选简报追问。AI 配置连接测试 MUST 保持普通短请求路径。

#### Scenario: 长 AI 请求等待完整响应

- **WHEN** 长 AI 路由调用模型超过 30000 毫秒但仍在 AI 预算内
- **THEN** API 中间件继续等待路由结果
- **AND** 完整响应通过现有字段校验后再返回或持久化

#### Scenario: 连接测试保持快速失败

- **WHEN** AI 配置连接测试上游无响应
- **THEN** 连接测试使用独立短超时并返回现有连接错误码
- **AND** 配置测试不会占用 5 至 10 分钟的生成预算

### Requirement: 超时仍然保持完整性边界

AI 请求超时、上游错误或响应非法时 MUST 返回现有结构化错误。系统 MUST 丢弃未完成的 AI 内容；决策助手 MUST 保存确定性快照，研究摘要等生成结果 MUST 继续遵循现有持久化边界。

#### Scenario: 决策助手在长任务超时后降级

- **WHEN** AI 在 600000 毫秒内仍未返回完整有效响应
- **THEN** 决策助手保存 `ai.status = failed` 的确定性评估
- **AND** 最终来源保持 `deterministic`
