## 方案

### API 与领域层

- 新增 `apps/api/src/domain/quant/ai-change-explanation.ts`，复用现有 OpenAI-compatible chat completion 配置和超时分类模式。
- 输入为当前报告、上一份报告及其确定性变化项；领域层只序列化必要的报告元数据、变化项和当前证据，限制 prompt、输出长度和数组数量。
- 输出版本使用 `research-change-explanation-v1`，字段固定为 `overview`、`changes`、`nextChecks`、`citedEvidenceKeys`。每个 change 包含当前 evidence key、标题、解释和变化类型，引用只能来自当前报告。
- 在 `QuantError` 中增加变化解释专用错误码；路由重新按 userId 读取当前/上一份运行，校验同股、不同 run、报告与持久化记录一致后才调用 AI。

### 客户端与 UI

- `quant-app` 增加变化解释类型、API client parser 和调用方法。
- 新增 `QuantAiResearchChangeExplanation.vue`，由详情页变化面板传入确定性比较结果，呈现生成、成功、失败、配置入口和证据引用。
- App 使用独立 request id；切换股票或生成新报告时清除旧解释。引用调用现有证据聚焦函数，不改变当前报告和历史比较结果。
- CSS 复用 Quant 现有状态 token，并为 390px 增加稳定换行与焦点样式。

### 验证

- API 领域单测覆盖 prompt 限长、有效输出、未知字段/引用、交易语言、因果断言、超时、上游失败和配置缺失。
- 路由测试覆盖用户隔离、同股校验、同 run 拒绝和成功响应。
- Quant client/component 单测覆盖解析、idle/loading/success/error/retry、引用事件和窄屏关键类。
- 运行 API/Quant 测试、type-check、lint、build、OpenSpec strict、GitNexus staged detect_changes 和 `git diff --check`；最终经 Gateway 验证可见状态且无 console error/warn。
