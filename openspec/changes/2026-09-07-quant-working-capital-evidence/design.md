## 设计

1. 在 API `QuantFinancialQualitySnapshot`、Quant view model 和 response schema 增加可选 nullable 字段，兼容历史 fixture、旧 bridge payload 和已持久化研究报告。
2. Eastmoney 财务 provider 先读取现有财务报告，再以报告日期窗口请求 `zcfzbAjaxNew`；按 `REPORT_DATE` 建立匹配表，只把 `ACCOUNTS_RECE`、`INVENTORY`、`CONTRACT_LIAB` 的有限值合并到对应报告。
3. AkShare normalizer 为资产负债表增加三个字段别名，并把它们加入 balance-field completeness 检查；adapter 继续沿用 report/quarterly/yearly balance endpoint 顺序和 bounded error/source 记录。
4. provider chain 将新字段纳入 field-by-field supplement，保留 primary provider、supplemental provider 和原有数值优先级；Tushare 或旧 bridge 没有字段时返回 null。
5. research report 新增 `operating-driver-*` optional evidence，空值使用 `missing`，有限非负值使用 `pass`；不把这些 key 传给 value-quality 或 decision projection。
6. Quant 基本面组件增加未嵌套的经营驱动字段区，展示金额、报告期和“缺失”状态；知识版本升级为 `investment-knowledge-v6`，仅调整 business-driver coverage 文案。

## 风险与边界

- Eastmoney 财务请求会增加一次辅助请求；辅助请求异常只影响三个可选字段。
- 资产负债表金额保持源站元口径，不与现金流或利润的计算单位混用。
- 合同负债是经营上下文，不等价于订单；应收账款和存货也不直接推导收入、利润或投资结论。
