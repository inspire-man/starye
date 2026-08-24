## 方案

### 估值请求边界

前端 `loadValuation` 使用 `Promise.allSettled` 分别读取目标快照和观察池比较。目标快照、比较结果和各自错误状态分别保存；重试目标估值时不重置已经成功的比较结果，重试比较时不重置目标快照。

API 保留现有 `/valuation/:tsCode` 与 `/valuation/compare/:tsCode` 路径和错误码。provider 将主 `push2` 请求与公开数据回退请求封装在同一 `fetchValuation` 中，成功来源统一为 `QuantValuationSnapshot`，不把来源诊断暴露到工作台。

### 解释型结论

扩展现有 `buildResearchSummary` 的规则：先计算技术、估值、财务和数据完整度四个维度，再组合 headline、support、watchouts 和 nextChecks。规则只输出观察和人工核对方向，不计算胜率、目标价或收益预测。

### 验证

- provider 单测覆盖主接口成功、主接口失败后回退成功、两者均失败和空字段。
- API client 测试覆盖估值错误信息保留。
- 工作台研究摘要测试覆盖同向、估值冲突、基本面等待技术确认和数据不足。
- Quant/API 类型检查、定向测试、构建和 Gateway 浏览器验证。
