## 方案

1. 扩展 Eastmoney financial provider：将一次上游响应规范化为按 `reportDate` 倒序的报告数组；现有 `fetchFinancialQuality` 始终取数组第一条，保持旧接口兼容。
2. 新增 `QuantFinancialQualityComparison` 纯函数，复用估值比较的样本边界思想，计算四个指标的 higher/lower percent，并对缺失值返回 `null`。
3. 在 Quant route 增加历史和比较两个 GET handler。历史接口支持 `limit` query；比较接口并发读取当前观察池，目标失败直接报错，非目标失败保留 `valuation/quality: null` 风格的 peer。
4. 在 client 增加严格 parser 和类型；`App.vue` 选择股票时只使用一个财务请求序号，同时更新单期、历史和比较状态，避免旧响应覆盖。
5. UI 使用轻量 CSS 趋势行而非引入图表依赖：报告期标签、指标当前值、变化方向和同池位置。移动端改为单列堆叠。

## 错误与边界

- provider 超时、坏 JSON、空报告、代码错位继续映射为现有 Quant provider error。
- 历史报告每次即时读取，不写入 D1；比较只使用当前观察池，不把行业或全市场数据混入样本。
- 趋势只比较可用的最近值与较早值；两端任一缺失时显示暂无趋势。


