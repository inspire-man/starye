## 方案

### API 与领域层

- 新增 `apps/api/src/domain/quant/ai-candidate-briefing.ts`，沿用现有 OpenAI-compatible chat completion、超时和错误分类模式。
- 路由 `POST /api/quant/candidates/ai-briefing` 不接受候选事实作为请求体；服务端调用候选读取函数并为每只候选构造研究优先级事实。若当前没有候选，直接返回明确的 Quant 输入错误。
- Prompt 只包含最多 5 个候选的代码、名称、确定性优先级、研究动作、分数、触发原因、数据完整性和信号持续性摘要；输出字段固定为 overview、focusItems、nextChecks、citedCandidateCodes。
- 输出校验要求 focus item 的 candidate code 来自当前服务端输入，并检查字段、长度、交易语言和因果确定性表述。

### 客户端与 UI

- `quant-app` 增加 `QuantAiCandidateBriefing` 类型、parser 和 `generateCandidateAiBriefing` 请求。
- 新增 `QuantAiCandidateBriefing.vue`，呈现候选范围、整体概览、重点候选、下一步核对和引用代码；点击重点候选触发 `focusCandidate`。
- App 使用独立 request id；在候选研究页接入组件，调用现有 `selectStock` 打开详情，不重排或改写候选数据。
- 使用 Quant 现有 token、focus-visible 和 390px 响应式样式。

### 验证

- API 领域/路由测试覆盖服务端候选读取、空候选、用户隔离、有效输出、未知代码/字段、交易语言、因果表述、超时、上游失败和无密钥。
- Quant client/component 测试覆盖字段归一化、请求契约、idle/loading/success/error/retry、候选详情导航和窄屏样式关键类。
- 运行 API/Quant 测试、type-check、lint、build、OpenSpec strict、GitNexus staged detect_changes、Gateway 页面和浏览器日志复核。
