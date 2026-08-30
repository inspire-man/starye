# 设计

## 计算边界

- `buildDecisionOutcome(history, latestObservation)` 接受当前用户已经读取到的决策历史和页面最新日线，不访问 API。
- 记录按 `snapshot.currentPriceObservedAt`、`snapshot.generatedAt`、`updatedAt` 的可用时间排序；日期统一转换为可比较的数字。
- 维护一个最近有效的 `plan-buy`/`holding` 起点。新的同类起点替换旧起点；下一条有效价格记录消费当前起点并生成观察条目。
- 遍历完成后，若仍有未消费起点且最新日线日期更晚，则生成“当前观察”；否则保留待观察计数。
- 所有结果使用百分比变化 `((observation - baseline) / baseline) * 100`，命名为 `changePercent`，文案使用“价格变化/记录价差”。

## UI

新增 `QuantDecisionOutcome.vue`，由 `QuantDecisionJournal.vue` 传入 `history`、`latestPrice` 和 `latestPriceObservedAt`。组件展示：

- 摘要：已观察次数、已卖出配对、待观察起点。
- 最近四条观察：起点 action、观察类型、起点/观察价格、日期和变化百分比。
- 空状态、加载不适用状态和固定边界说明。

结果区域使用现有 Quant CSS token，移动端将条目改为单列，不依赖卡片嵌套，不改变原来的决策表单和保存流程。

## 验证

- 纯函数测试覆盖逆序输入、缺失/非有限价格、同日日期、已卖出配对、当前日线观察和多起点替换。
- 组件测试覆盖摘要、条目、空状态、边界说明和 390px 容器约束。
- Quant 全量测试、type-check、build、lint 和 OpenSpec strict 通过。
