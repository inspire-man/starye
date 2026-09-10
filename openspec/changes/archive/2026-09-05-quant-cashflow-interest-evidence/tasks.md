## 1. Provider

- [x] 1.1 扩展现金流 provider 的报告模型和三张报表请求；完成标准：现金流、利润表、资产负债表按报告期对齐，覆盖字段优先级、债务组件、空值、辅助请求错误和请求参数测试。
- [x] 1.2 保持现金流核心请求与辅助请求错误隔离；完成标准：现金流量表失败映射整体 provider 错误，利润表/资产负债表失败仍返回核心现金流并带安全错误码。

## 2. Domain and API contract

- [x] 2.1 扩展股东回报 cashflow evidence；完成标准：利息后自由现金流、利息来源、有息负债合计/组件、缺口和状态按同报告期公式输出，既有分红覆盖与支付率回归通过。
- [x] 2.2 扩展研究报告、投资知识目录和响应 schema；完成标准：三个 optional research evidence 可回看，四个知识库 required field 转为 available，API schema 接受完整和部分结果且不改变评分/推荐。

## 3. Quant workbench

- [x] 3.1 扩展 Quant parser、view model 和股东回报详情；完成标准：camelCase/snake_case、历史 payload、null、完整/部分/不可用、来源和 390px 布局测试通过。

## 4. Verification

- [x] 4.1 完成定向测试、类型检查、build、OpenSpec strict、GitNexus detect_changes 和 Gateway 验收；完成标准：记录 Eastmoney 真实报告期/字段、浏览器错误为 0、核心现金流与辅助缺口可独立验证。
