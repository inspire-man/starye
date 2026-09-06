# 提案：补齐 AkShare 同报告期现金分红字段

## 背景

Quant 股东回报的现金流覆盖和年度支付率已经接入 AkShare 现金流历史，但 bridge normalizer 当前把 `cash_dividends_paid` 固定为 `null`。AkShare `stock_cash_flow_sheet_by_report_em` 的原始列 `ASSIGN_DIVIDEND_PORFIT` 已实测返回同报告期分配股利、利润或偿付利息金额，导致可核对的现金流记录仍显示为部分可用。

## 目标

- 将 AkShare 现金流表已有的 `ASSIGN_DIVIDEND_PORFIT` 原始值映射到现有 `cash_dividends_paid` 字段。
- 保留数值、报告期和来源 endpoint，不使用其他字段推算现金分红。
- 让 API bridge parser、现金流 evidence、分红覆盖和年度支付率继续复用现有字段与公式。
- 缺失、NaN、空值和 endpoint 失败继续保持 `null`/安全错误语义。

## 非目标

- 不新增 D1 字段，不改变 Quant cashflow schema、股息率、覆盖倍数或支付率公式。
- 不把经营现金流、利息支出或回购金额推导为现金分红。
- 不修改 Tushare/Eastmoney provider 的既有字段口径。
- 不新增额外 AkShare endpoint。

## 影响与风险

改动集中在 bridge cashflow normalizer、API bridge cashflow parser 和对应测试/README。`cash_dividends_paid` 已是现有 API/domain/UI 合同字段，属于补齐原始值而非合同扩展；当前 Quant 与 Eastmoney 一致，将 `ASSIGN_DIVIDEND_PORFIT` 作为同报告期现金分红字段消费，公式保持不变。

## 需求

1. Bridge MUST 从 AkShare 现金流表读取 `ASSIGN_DIVIDEND_PORFIT`，并在原始值有效时输出 `cash_dividends_paid`。
2. 缺失或非有限原始值 MUST 保持 `null`，不得以零、净利润或利息支出补齐。
3. API bridge parser MUST 贯穿该字段，现金流 evidence 的覆盖和支付率 MUST 继续使用现有公式。
4. 既有报告、provider、D1 和旧 bridge 响应 MUST 保持兼容。
