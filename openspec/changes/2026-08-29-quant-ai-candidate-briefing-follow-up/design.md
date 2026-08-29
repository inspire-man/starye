## 方案

### API 与领域层

- 新增 `apps/api/src/domain/quant/ai-candidate-briefing-question.ts`，沿用 Quant AI provider 的 OpenAI-compatible chat completion、超时、配置和错误分类模式。
- 请求包含 `ts_codes` 和 `question`。路由先通过现有认证边界，再读取当前用户最新候选快照；范围代码必须属于快照输入代码和服务端候选视图。
- 追问 prompt 使用服务端构造的研究优先级事实，采用有限长度和紧凑字段；模型只能返回 `answer` 与 `citedCandidateCodes`。
- domain 层校验回答长度、未知字段、未知候选引用及交易结论/未经支持的因果表述，并返回版本化结果。

### Quant 页面

- `QuantAiCandidateBriefing.vue` 在已有简报面板中增加问题输入、提交按钮、idle/loading/success/error 状态和候选代码引用。
- `App.vue` 发送当前可生成范围代码和问题；成功结果只在请求序号与范围 key 同时匹配时写入。
- 筛选、候选快照、观察池和研究标记变化时清除问题、回答、错误和请求中的旧状态；引用沿用现有候选详情打开流程。
- 当前没有可生成的快照候选时，追问表单保持禁用并显示数据状态。

### 验证

- API 集成测试覆盖认证、范围过滤、跨用户/未知/pending 代码、空问题、附加客户端事实、无配置和 provider 不调用。
- domain 测试覆盖 prompt 事实边界、响应 allowlist、引用校验、交易语言和超时/上游错误。
- Quant client/component 测试覆盖只发送 `ts_codes` 与问题、表单状态、引用导航和范围竞态。
- 运行 API/Quant 测试、type-check、lint、build、OpenSpec strict、GitNexus staged 检测和 Gateway idle/filter 验收。
