## Context

Quant 的单股分析已经有丰富证据，但总览缺少一个把观察池横向状态讲清楚的入口。当前 watchlist 与 candidate snapshot 都已经在前端内存中，增加纯函数可以避免 API/数据库扩张，并让公式边界可单测。

## Design

1. 去重候选代码，排除 `pendingSync` 和无分数候选，形成可评分样本。
2. 从观察池 `latestChangePercent` 计算上涨/下跌样本，从 `barCount` 或 `latestTradeDate` 计算数据覆盖。
3. 从候选 `score >= 2` 计算有效信号，从回撤、连续上涨、成交放大任一条件计算风险提示。
4. 低于 3 个可定价或可评分样本时返回 `insufficient`；否则按上涨占比和风险占比返回 `positive`、`mixed` 或 `defensive`。
5. 总览使用无新增卡片层级的分栏区域展示状态和四个比例，移动端改为单列，所有比例保留分子/分母。

## Non-goals

- 不把观察池统计命名为大盘温度或行业景气度。
- 不修改候选分数、价值质量 v2、决策证据链或买卖动作。
- 不接入实时行情、指数行情或新的数据平台。

## Verification

- 运行 `watchlist-environment` 单元测试。
- 运行 Quant type-check、lint、build。
- 通过 Gateway 浏览器检查桌面和窄屏总览，确认口径提示和比例区域不溢出。
