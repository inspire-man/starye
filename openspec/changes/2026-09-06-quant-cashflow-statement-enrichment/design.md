## 实现边界

bridge 先探测日线和身份的备用来源，再采集财报指标并按缺口调用利润表和资产负债表。日线按 Eastmoney、Tencent、Sina 顺序探测，身份按 Eastmoney 个股信息和代码名称表顺序探测。财报指标在现有 Sina 接口后增加 Eastmoney `stock_financial_analysis_indicator_em`；利润表按报告期、季度、年度和 Sina 顺序探测，资产负债表按报告期、年度和 Sina 顺序探测。normalizer 把已验证的利息费用和有息负债分项保留在标准化财报记录中；现金流按报告期、季度、年度和 Sina 顺序探测，并以 `report_date` 为键合并同期间记录。先返回来源的非空字段始终优先，后续来源只填空值。

API `normalizeBridgeCashflowReport` 将 bridge cashflow 字段映射到现有 `QuantCashflowReport`。`createQuantCashflowProviderChain` 把 `interestExpense` 和 `interestBearingDebt` 纳入可补充字段，并按分项逐项合并；仅同报告期补充时标记 `supplementalProvider=akshare` 和 `supplementUsed=true`。

所有代码、报告期和数值都保持现有有限值边界。利润表只允许使用明确的利息字段，资产负债表只允许使用明确的有息负债字段集合；未出现的字段保持 `null`。

## 失败策略

- 利润表失败：现金流仍保留经营现金流/资本开支，利息继续为 `null` 并保留稳定端点错误。
- 资产负债表失败：现金流仍保留其它字段，有息负债继续为 `null`。
- 报表代码错配或报告期无效：丢弃该行并记录稳定错误，不影响其它报告期。
- API 主源已有利息或债务值：AkShare 不覆盖；主源值为空且 AkShare 无匹配报告：保持空值。
- 首选报表端点失败：继续探测可用的季度、年度或 Sina 来源；已返回数据仍保留，失败端点和最终未解决字段分别记录。
- 日线或身份首选端点失败但备用来源补齐时：保留首选端点错误，`status` 按是否仍有未解决数据缺口计算。
