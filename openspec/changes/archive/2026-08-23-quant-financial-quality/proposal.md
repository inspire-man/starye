## Why

当前工作台已经能观察趋势与估值，但缺少一组容易理解的经营质量指标，金融初学者仍需要跳到其他网站才能判断收入、利润、盈利能力和负债水平。Eastmoney 的公开财务分析接口已经验证可以返回最近报告期数据，适合增加一个按选中股票读取的只读基本面摘要。

## What Changes

- 增加 Eastmoney 财务质量 provider，读取最近已披露报告并标准化收入、利润、同比、ROE、毛利率、净利率、资产负债率、经营现金流质量和 ROIC。
- 增加认证的 `GET /api/quant/financial/:tsCode` 接口；接口只返回当前选中股票的快照，不新增 D1 表，也不改变日线同步流程。
- 财务接口 MUST 在上游数据缺失、错位或超时时 fail-closed，不用零值或旧股票结果伪造当前报告。
- 在 Quant 客户端增加财务快照类型、snake_case 解析和按股票读取方法。
- 在走势与估值附近增加“基本面速览”，用金融小白可理解的标签展示指标、报告期和公告日期，并清楚标注数据时效与观察边界。
- 财务数据与日线、估值分别加载和报错；快速切换股票时，旧请求不得覆盖当前选中股票。

## Capabilities

### New Capabilities

- `quant-financial-quality`: 为选股工作台提供可追溯、可为空、失败闭合的财务质量快照。

### Modified Capabilities

- 无。

## Impact

- API：`apps/api/src/domain/quant/provider.ts`、Quant route、schema 与 provider 单测/路由测试。
- Frontend：`apps/quant-app/src/lib/quant-types.ts`、`api-client.ts`、`App.vue`、样式与客户端测试。
- 外部依赖：新增对 Eastmoney 财务分析公开接口的服务端只读请求；不新增 npm 依赖，不暴露上游配置给浏览器。
- 风险：报告口径随季度/中报变化，部分指标可能缺失；通过报告元数据、nullable 字段、超时与 schema 校验降低误读风险。

## Non-Goals

- 不实现盈利预测、行业估值排名、回测、自动选股或交易建议。
- 不把财务快照持久化为 D1 历史序列；本轮只展示最近一次已披露报告。
- 不把缺失指标补成 0，也不把数据源状态、积分或运管信息放回工作台。
