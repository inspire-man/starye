# 设计

## 数据边界

- 以 `QuantDecisionRecord.snapshot` 为 AI 事实来源，以现有 `buildDecisionOutcome` 产出的 `DecisionOutcomeEntry` 为价格观察来源。
- 通过 `baselineId` 将每条后续观察绑定到产生它的决策记录；只处理 `plan-buy`/`holding` 基准，沿用现有时间和正数价格校验。
- AI 决策只接受快照中 `aiDecisionReview.accepted === true` 且推荐为 `bullish` 或 `bearish` 的记录。`watch`、拒绝、失败、未请求和缺失快照都不进入方向样本。

## 纯函数

新增 `buildQuantAiOutcomeCalibration(history, latestObservation)`，先调用现有结果口径的等价映射或消费其 entries，再返回：

- `status`、`headline`、`observedCount`、`pendingCount`、`alignedCount`、`opposedCount`、`flatCount`、`directionalSampleCount`；
- 只有方向样本达到 3 条才提供 `agreementRate`，否则为 `null`；
- 每条结果包含基准记录、AI 推荐/置信度、AI 分差（若有）、观察价格和变化百分比；
- 按因子聚合已接受的 `support`/`oppose` 立场，`caution`/`insufficient` 不强行判定方向。

函数只产生派生视图，不写回任何快照。输入包含损坏或非有限数字时跳过该条，沿用现有结果回看的 fail-closed 语义。

## 界面

新增 `QuantAiOutcomeCalibration.vue`，放在决策结果回看之后、作为决策日志的一部分。组件展示总览、样本门槛、逐条观察和因子回看；空状态说明怎样产生下一条可校准观察。样式复用现有决策日志的边界、颜色和 390px 媒体查询，长文本使用容器内换行。

## 验证

- 纯函数覆盖已接受/拒绝、等待、方向一致/相反、价格不变、样本不足、旧快照和因子聚合。
- 组件覆盖有结果和空状态，并检查校准口径文字。
- 运行 Quant 测试、type-check、lint、build、OpenSpec strict、GitNexus detect changes；最后通过 Gateway 与 390px 浏览器检查。
