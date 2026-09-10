# Quant AkShare 同报告期现金分红字段 Specification

## Purpose

补齐 AkShare 现金流表已有现金分红原始字段，使股东回报现金流覆盖与支付率显示真实数据。

## ADDED Requirements

### Requirement: Bridge MUST 保留现金流表现金分红原始值

AkShare bridge MUST 将 `ASSIGN_DIVIDEND_PORFIT` 或等价现金流表列归一化为 `cash_dividends_paid`。有限值 MUST 原样保留，缺失或非有限值 MUST 为 `null`。

#### Scenario: AkShare 返回同报告期分配金额

- **WHEN** 现金流表返回 `REPORT_DATE=2026-06-30` 和 `ASSIGN_DIVIDEND_PORFIT=15826134692`
- **THEN** bridge 对应 cashflow row 返回 `cash_dividends_paid=15826134692`
- **AND** 报告期、股票代码和 `stock_cash_flow_sheet_by_report_em` 来源保持不变

#### Scenario: 原始值缺失

- **WHEN** 现金流表的分配金额是 `NaN`、空文本或缺失
- **THEN** `cash_dividends_paid` 为 `null`
- **AND** 不用其他现金流字段推导金额

### Requirement: API MUST 贯穿现金分红字段并保持公式

API bridge parser MUST 将 `cash_dividends_paid` 映射为 `cashDividendsPaid`；现金流 evidence 的自由现金流覆盖和年度支付率 MUST 继续使用现有 domain formula。

#### Scenario: AkShare cashflow 进入股东回报

- **WHEN** AkShare cashflow provider 返回有效 `cash_dividends_paid`
- **THEN** API cashflow report 保留 `cashDividendsPaid`
- **AND** 现金流覆盖与年度支付率按既有公式计算
- **AND** 其他 provider、推荐和 D1 行为不变

### Requirement: 旧合同 MUST 保持兼容

API MUST 接受旧 bridge cashflow rows 中没有 `cash_dividends_paid` 的 payload，并将该字段解析为 `null`；其他 cashflow fields 和错误状态保持原样。

#### Scenario: 旧 AkShare cashflow payload

- **WHEN** bridge cashflow row 不包含 `cash_dividends_paid`
- **THEN** API `cashDividendsPaid` 为 `null`
- **AND** 旧报告读取与 provider chain 行为继续有效
