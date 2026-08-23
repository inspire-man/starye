## Context

现有 Quant provider 已集中处理 Tushare 日线、Eastmoney 日线和 Eastmoney 估值快照；路由统一使用管理员认证和 `mapQuantProviderError`。Quant 前端已经把日线和估值比较拆成独立状态，但估值请求目前由单个 `loadValuation` 负责。本轮只扩展只读链路，不新增数据库表或同步写入。

## Goals / Non-Goals

**Goals:**

- 用一个 provider-neutral 的财务质量快照契约隔离 Eastmoney 字段口径。
- 对上游结构、代码、日期和数字进行严格校验；空值保持 nullable。
- 让前端在同一选中股票下并行加载趋势、估值和基本面，且错误互不遮蔽。

**Non-Goals:**

- 不做财务历史趋势、行业对标、财务评分或结论型推荐。
- 不引入缓存、D1 持久化或新的外部数据平台。

## Decisions

### 1. 使用已验证的 Eastmoney 财务分析接口

provider 请求 `emweb.securities.eastmoney.com/PC_HSF10/NewFinanceAnalysis/ZYZBAjaxNew?type=0&code=<market><code>`，读取 `data` 数组中按报告日期排序的最近记录。选择 `type=0` 是因为它返回最新季度/中报等已披露报告；年度报告仍由上游按其报告排序提供。

每条记录必须验证 `SECURITY_CODE`、`REPORT_DATE` 和必要的字符串元数据。指标通过字段表映射：

- `TOTALOPERATEREVE` → `revenue`
- `TOTALOPERATEREVETZ` → `revenueYoY`
- `PARENTNETPROFIT` → `netProfit`
- `PARENTNETPROFITTZ` → `netProfitYoY`
- `KCFJCXSYJLR` → `adjustedNetProfit`
- `KCFJCXSYJLRTZ` → `adjustedNetProfitYoY`
- `ROEJQ` → `roe`
- `XSMLL` → `grossMargin`
- `XSJLL` → `netMargin`
- `ZCFZL` → `debtAssetRatio`
- `JYXJLYYSR` → `operatingCashflowToRevenue`
- `ROIC` → `roic`

### 2. 复用错误边界，不复用估值 schema

财务 provider 复用 Eastmoney 的超时、上游失败和坏响应错误类别，但保留独立的 `QuantFinancialQualitySnapshot` 类型和 schema，避免估值字段与报告字段发生隐式兼容。路由使用现有认证与错误映射，错误消息不向浏览器泄露上游 URL 或原始响应。

### 3. 前端独立状态和请求序列号

前端新增 `financialQuality` 状态与 `financial` 错误/加载字段；切换股票时清空旧财务结果并启动新请求。财务请求使用独立的 request id，只有最后一次请求可以提交结果、错误和 loading 状态。日线与估值的现有序列号机制保持不变。

### 4. 报告口径在界面上显式化

基本面区域展示报告期、报告名称和公告日期；货币/单位使用页面上的“金额单位：元，比例单位：%”提示。营业收入、净利润等金额只展示 compact 值，百分比指标保留两位小数。缺失值显示 `--`。

## Risks / Trade-offs

- [上游字段口径或排序变化] → 强制校验代码和日期，空值保持 null；响应结构不符合契约时整体失败并显示重试。
- [报告指标跨季度不可直接比较] → UI 明确这是最近已披露报告的快照，不绘制历史趋势，也不输出结论。
- [前端快速切换造成旧请求回写] → 使用请求序列号，并为 client parser 和组件加载逻辑补测试。
- [公开接口短暂限流或不可达] → provider 设置固定超时，路由返回统一 Quant provider 错误，其他数据区域继续可用。

## Migration Plan

1. 部署 API 与 Quant 静态资源；本轮无数据库迁移。
2. 通过 Gateway 访问 `/quant/`，验证三只观察池股票可以切换并显示各自报告元数据。
3. 若上游接口失效，回滚 API/前端代码即可，不需要数据清理。
