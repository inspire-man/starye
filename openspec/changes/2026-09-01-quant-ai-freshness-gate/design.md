## 设计

### 就绪度时效检查

`buildQuantDecisionReadiness` 新增 `freshness` 检查项。`fresh` 为 pass，`aging` 为 review，`stale` 和 `unknown` 为 blocked；合并基础数据与报告快照时采用 `fresh < aging < unknown < stale` 的严格度顺序。它与数据完整性检查并列，不修改报告本身的 status 或 score。

### AI 最终推荐门控

推荐组件以 `dataFreshness === 'fresh'` 作为 AI 最终推荐应用条件。AI 复核对象和因子影响审计始终保留；当 AI 已接受但 freshness 不是 fresh 时，`activeRecommendation` 回退到报告中的确定性推荐，并显示未纳入最终推荐的时效原因。这样既保存 AI 复核证据，也不让旧数据改变当前结论。

### 数据传递与兼容

App 将已有 `dataHealthSummary.freshness` 与最新研究报告 `generatedAt` 的 freshness 取更严格者，再把结果和说明传给推荐组件。组件缺少该输入时按 `unknown` 处理，避免在没有可信时效证据时误显示 AI 最终推荐。数据新鲜度只影响“判断是否可参考”和 AI 是否应用，不影响确定性报告字段。

### 布局

新增检查项沿用现有就绪度列表；AI 未纳入提示使用现有文本和状态样式，长原因允许换行。桌面与 390px 保持单列可扫描布局。
