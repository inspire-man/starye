## 设计目标

本 change 只补齐当前 Eastmoney 已能稳定提供的现金流量表证据，并把计算结果挂在现有股东回报 item 下。既有股息 provider、近 12 个月股息率公式和研究报告版本继续工作；新增字段使用可选嵌套对象，降低共享 `QuantShareholderReturnItem` 类型扇出的兼容风险。

## Provider 边界

- 在 `provider.ts` 增加 `QuantCashflowReport`、`QuantCashflowProvider` 和 `createEastmoneyCashflowProvider`。
- provider 先请求 `xjllbDateAjaxNew` 获取报告期，再请求 `xjllbAjaxNew` 获取最近最多 8 期报告，使用 `companyType=4`、`reportDateType=0`、`reportType=1`。
- 只读取 `NETCASH_OPERATE`、`CONSTRUCT_LONG_ASSET`、`NETPROFIT`、`ASSIGN_DIVIDEND_PORFIT` 及报告元数据。请求代码错位、坏 JSON、非 2xx、超时和空响应按已有 Eastmoney provider 错误映射处理。
- 不复用 `BUY_SUBSIDIARY_EQUITY` 作为回购金额；不从每股指标、负债率或 FCFF 字段反推绝对现金流。

## Domain 计算

`shareholder-return.ts` 在读取每只股票时并行读取分红 provider 和现金流 provider。现金流报告按报告日期降序去重；最新报告生成当前现金流证据，最近 `reportDate` 以 `-12-31` 结尾且字段有效的报告生成年度支付率。所有计算先通过有限数值检查，结果保留 `null`。

`cashflowEvidence.status` 的含义是：现金流和资本开支都为有限数值时 `ready`；存在报告但必需字段缺失时 `partial`；没有报告时 `insufficient_data`；provider 异常时 `unavailable`。回购、股本变化、利息支出属于 `missingFields` 的固定范围，不参与状态降级。

## Contract 与 UI

- `apps/api/src/schemas/quant-responses.ts` 为 shareholder returns 定义具体的嵌套 schema，避免 `data` 退回 unknown。
- `apps/quant-app/src/api/resources/market.ts` 增加现金流证据 parser，缺少历史字段时保留 `undefined`，坏结构仍走现有 `QuantApiError`。
- `QuantShareholderReturnsSection.vue` 在现有股息卡片后增加紧凑现金流网格和缺口列表，金额显示人民币元，覆盖倍数显示 `x`，支付率显示百分比；移动端保持单列布局。
- `research.handler.ts` 使用同一 cashflow provider 生成研究报告中的 shareholder item，因此新报告可回看这组证据；不修改 `value-quality` 或决策公式。

## 验证策略

provider 测试覆盖日期列表、字段归一化、空值、分页报告和请求参数；domain 测试覆盖公式、年度报告选择、负覆盖倍数、unsupported gaps 和局部失败。API route/contract 测试覆盖匿名、认证、schema envelope；client/组件测试覆盖旧 item、ready、partial、unavailable 和窄屏布局。最后经 Gateway `http://localhost:8080/quant/` 做真实页面与网络错误检查。
