# 设计

## 数据边界

`App.vue` 已同时持有 `latestResearchReport`、`latestDailyBar` 和当前观察池项。推荐卡新增可选的 `currentPrice`/`currentPriceObservedAt` props，价格只来自最近有效日线，缺少日线时才使用观察池已有最新收盘。报告中的参考区间、来源和 AI 复核继续作为唯一事实源。

## 纯函数

新增 `buildQuantDecisionGuide`，输入报告、当前最终推荐、最近收盘及观察日期，输出：

- `priceStatus`：`within`、`above`、`below`、`not-buying` 或 `unavailable`；
- `trustStatus`：`complete`、`review` 或 `insufficient`；
- `priceLabel`、`priceDetail`、`trustLabel`、`trustDetail` 和最多 4 条 `checks`/`steps`。

`trustStatus` 由现有报告字段推导：正权重因子全部 ready、覆盖度完整且无 fail 证据才具备硬证据完整；provider 回退、AI 未复核或 AI 未 accepted 只进入需核对，不降低原始证据字段本身的状态。因子缺失或 fail 证据进入数据不足/需补核。

## 页面呈现

推荐卡首屏顺序固定为：最终推荐 → 价格条件 → 信任检查 → AI 复核 → 因子/公式/失效条件展开。价格区域展示“最近交易日收盘”和日期，旁边使用简短的“非实时行情”边界；展开内容继续保留全部原始来源。

## 验证

纯函数测试覆盖价格位置和信任状态组合，组件测试覆盖当前价在区间内、区间外、数据缺失和 AI 未复核。Quant 全量测试、type-check、build、Lint、OpenSpec strict、Gateway 页面与 390px 浏览器检查作为交付门槛。
