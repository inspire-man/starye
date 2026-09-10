## 设计

1. 在 API `QuantFinancialQualitySnapshot`、Quant view model 和 response schema 增加可选 `businessSegments` 与 `businessSegmentErrorCode`，旧的持久化报告和旧 bridge payload 省略字段时继续可读。
2. Eastmoney provider 请求 `BusinessAnalysis/PageAjax`，读取 `zygcfx`，只接受匹配证券代码和合法报告期的行；按 `REPORT_DATE` 把行挂到对应财务报告，保留分类类型和有限原始数值。
3. AkShare normalizer 增加主营构成字段别名和有限数值处理；adapter 使用 `stock_zygc_em`，保留端点、过滤其他证券、按报告期/分类/名称去重并记录 bounded safe errors。
4. provider contract 增加可选 `supportsBusinessSegments` 能力标记。Eastmoney 与 AkShare 标记为支持，Tushare 不标记；provider chain 只向支持该能力的 fallback 请求分部补充，避免无效请求。
5. 分部收入和毛利只作为 optional `operating-driver-segment-*` evidence 写入研究报告。evidence 不进入 value-quality numeric fields、candidate signal、recommendation 或 decision projection。
6. Quant 基本面详情在经营驱动区域展示最多一组最新报告的分部行，金额、收入比例、毛利率和来源异常分别处理；空数组或字段缺失显示明确缺失状态。
7. 知识版本升级为 `investment-knowledge-v7`，仅调整 business-driver 的 available/missing 字段说明；订单金额、销量、实现价格仍是缺口。

## 风险与边界

- `zygcfx` 是主营构成原始披露，不等价于销量、成交价格、订单 backlog 或未来利润。
- 同一报告可能只有收入比例而没有毛利率；每个字段独立保留 `null`，不使用比例或收入推导毛利。
- 分部数据属于高扇出财务快照的可选字段，必须通过 API、bridge、Quant parser 和历史 payload 回归测试。
