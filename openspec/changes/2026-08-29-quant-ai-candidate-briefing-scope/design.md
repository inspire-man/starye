## 方案

### API 契约

- 新增严格 JSON 请求 schema：`ts_codes` 可选，最多 50 个 `QuantTsCode`；省略时保持全量候选行为，传空数组时返回 `QUANT_AI_CANDIDATE_BRIEFING_INPUT`。
- 路由先通过现有认证边界，再读取当前用户候选快照；传入代码必须全部存在于该快照，服务端只把匹配候选交给事实读取和 AI 领域层。
- AI prompt 和响应格式保持 `candidate-briefing-v1` 不变，确定性字段继续由服务端回填。

### Quant 页面

- `filteredCandidateItems` 的代码列表作为 `generateCandidateAiBriefing` 请求体；请求开始记录排序后的范围 key。
- 候选表继续展示 pending 观察池条目，但未进入最近快照的代码不属于 AI 可生成范围；面板同时显示当前筛选数量和可生成范围数量。
- 成功响应只有在请求序号和当前筛选范围 key 都一致时才写入简报；筛选变化时清理简报、复制状态和范围计数。
- 面板显示当前筛选数量、观察池总候选数和本次生成范围；没有当前筛选候选时禁用生成。

### 验证

- API 集成测试验证代码范围、未知代码、空范围、用户隔离、客户端事实不进入 prompt。
- 客户端测试验证 `ts_codes` 请求体、面板范围文案和筛选变化后的旧结果丢弃。
- 运行 API/Quant type-check、lint、测试、build、OpenSpec strict、GitNexus staged 检测、`git diff --check`，并经 Gateway 验证筛选数量和 idle 状态。
