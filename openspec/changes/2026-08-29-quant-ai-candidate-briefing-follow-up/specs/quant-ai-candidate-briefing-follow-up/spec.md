## ADDED Requirements

### Requirement: Scope-bound candidate briefing question API

系统 MUST 提供受现有 Quant 认证边界保护的 `POST /api/quant/candidates/ai-briefing/question`。请求 MUST 包含非空问题和最多 50 个 `ts_codes`；服务端 MUST 重新读取当前认证用户最新候选快照与确定性研究事实。

#### Scenario: Ask within the current briefing scope

- **WHEN** 用户提交当前可生成简报范围内的候选代码和问题
- **THEN** 服务端只把这些代码对应的服务端事实交给 AI provider
- **AND** 返回版本化回答、问题和候选代码引用
- **AND** 不修改候选评分、研究优先级、研究动作或候选表状态

#### Scenario: Reject an invalid or foreign scope

- **WHEN** 请求包含空范围、未知代码、pending 代码、跨用户代码、空问题或超过 50 个代码
- **THEN** 服务端返回明确输入错误
- **AND** 不调用 AI provider

### Requirement: Keep candidate answers grounded

模型响应 MUST 只包含 `answer` 和 `citedCandidateCodes`。每个引用 MUST 属于当前服务端范围；未知字段、未知代码、超长回答、交易结论或未被事实支持的因果表述 MUST 被拒绝。

#### Scenario: Valid answer with candidate citations

- **WHEN** provider 返回结构正确且引用均属于当前范围的回答
- **THEN** API 返回 provider、model、生成时间、规范化问题、回答和去重后的候选代码引用

#### Scenario: Provider returns an unsafe or malformed answer

- **WHEN** provider 返回未知字段、未知候选引用、非法 JSON 或交易结论
- **THEN** API 返回版本化 invalid-response 错误
- **AND** 原始 provider 内容和 API key 不进入响应

### Requirement: Show follow-up state in the candidate briefing panel

Quant 候选简报面板 MUST 在存在可生成快照候选时显示追问输入和提交操作，并 MUST 区分 idle、loading、success、error 状态。追问成功或失败都 MUST 保持确定性候选表和已有简报事实不变。

#### Scenario: Ask and navigate to a cited candidate

- **WHEN** 用户提交问题并点击回答中的候选代码
- **THEN** 面板显示回答和引用
- **AND** 页面沿用现有详情抽屉流程打开对应候选

#### Scenario: No snapshot candidate is available

- **WHEN** 当前筛选只有 pending 条目或当前筛选为空
- **THEN** 追问提交操作处于禁用状态
- **AND** 页面不发起追问请求

### Requirement: Discard stale candidate answers

客户端 MUST 使用请求序号和当前简报范围 key 丢弃旧追问响应。筛选、候选快照、观察池或研究标记变化后，旧问题、回答、错误和范围状态 MUST 被清理。

#### Scenario: Scope changes while a question is running

- **WHEN** AI 追问尚未返回时当前筛选范围改变
- **THEN** 旧回答不得覆盖新的范围
- **AND** 用户需要在新范围内重新提交问题
