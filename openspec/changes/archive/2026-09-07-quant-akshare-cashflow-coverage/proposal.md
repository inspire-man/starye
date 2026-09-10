# 提案：扩展 AkShare 现金流备用来源与同期净利润补全

## 背景

Quant 现金流报告已经接入 Eastmoney、Tushare 和 AkShare bridge，但真实财报中仍存在同报告期现金流字段为空的情况。例如 Eastmoney 现金流表的季度 `NETPROFIT` 可能为空，而同报告期利润表已经返回净利润；当现金流量表主端点异常时，bridge 也缺少同花顺现金流指标端点作为备用来源。这会让股东回报现金流历史显示部分可用，并放大来源不可用的影响。

## 目标

- 在 AkShare bridge 中接入 `stock_financial_cash_new_ths` 作为现金流量表的最后备用来源。
- 将同花顺返回的原始报告期指标映射为已有现金流字段，不通过公式推导缺失字段。
- 使用同报告期已取得的利润表净利润补全现金流行的 `net_profit`，保留字段来源和缺口语义。
- 让 API、研究报告和 Quant 详情继续沿用现有现金流公式、来源链、状态和错误分类。

## 非目标

- 不改变自由现金流、覆盖倍数、支付率、推荐、价值质量或 D1 结构。
- 不把季度 `single` 值转换为累计报告期值，也不把利息费用、回购金额或现金分红从其他字段推导。
- 不把单个端点失败从诊断 `errors` 中删除；只在其他来源成功覆盖后保持整体状态可用。

## 影响

涉及 `apps/quant-akshare-bridge` 的现金流归一化和端点编排，以及 API bridge 现有现金流消费链的回归测试、OpenSpec 和状态文档。已有 `QuantCashflowReport`、`cashflowEvidence` 和前端组件接口保持不变。

## 风险与验收

同花顺端点返回长表指标，存在版本字段变化和接口失败风险；未知指标必须被忽略，已知指标缺失必须保留为 `null`。通过 Python bridge 测试、API/Quant 定向测试、真实 AkShare 抽样、OpenSpec strict、GitNexus 变更分析和 Gateway 鉴权边界验证。
