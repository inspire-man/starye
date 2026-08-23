## Purpose

为选股工作台提供一组带报告期和公告日期的经营质量摘要，让用户可以把趋势、估值与最近已披露的基本面放在同一只股票上观察比较。

## ADDED Requirements

### Requirement: Financial quality snapshot

系统 MUST 为已认证的 Quant 用户提供选中 A 股的最近已披露财务质量快照，至少包含报告期、报告类型、公告日期、营业收入、归属净利润、扣非净利润、三项同比、ROE、毛利率、净利率、资产负债率、经营现金流/营收和 ROIC。数值字段没有可靠值时 MUST 返回 `null`，不得用零替代。

#### Scenario: Return the latest disclosed report

- **WHEN** 用户请求 `GET /api/quant/financial/601899.SH` 且 Eastmoney 返回合法的报告数据
- **THEN** 接口返回 `success=true`，标准化的 `tsCode` 为 `601899.SH`，并包含最近报告的 `reportDate`、`reportType`、`reportDateName`、`noticeDate` 与财务字段

#### Scenario: Preserve missing metrics

- **WHEN** 上游报告中的任一财务字段为空、`-` 或 `--`
- **THEN** 对应字段返回 `null`，其他合法字段仍按数值返回

### Requirement: Fail-closed upstream handling

服务端 MUST 对股票代码市场映射、超时、非 2xx 响应、坏 JSON、无报告数据、报告代码错位和不符合预期的响应结构 fail-closed，并通过 Quant 错误契约返回可识别的 4xx/5xx 错误；不得生成伪造的财务快照。

#### Scenario: Reject an invalid or mismatched response

- **WHEN** 请求代码不是合法的 SH、SZ 或 BJ 六位代码，或上游返回的 `SECURITY_CODE` 与请求代码不一致
- **THEN** provider 抛出可映射的错误，路由不返回 `success=true` 的数据

#### Scenario: Bound a slow upstream request

- **WHEN** Eastmoney 财务接口在 provider 超时窗口内没有完成响应
- **THEN** provider 以 timeout 错误结束，Quant 路由返回超时错误状态，不阻塞请求直到平台默认超时

### Requirement: Novice-readable workbench presentation

Quant 工作台 MUST 将财务快照作为独立的“基本面速览”区域展示，并显示“最近已披露报告”、报告期和公告日期。页面 MUST 将营业收入同比、净利润同比、ROE、毛利率、资产负债率和经营现金流/营收用易懂标签呈现，同时明确“指标用于观察，不代表未来收益”。

#### Scenario: Load fundamentals for the selected stock

- **WHEN** 用户选择观察池中的另一只股票
- **THEN** 页面独立加载该股票的基本面快照，加载完成后只显示当前股票的报告元数据和指标

#### Scenario: Isolate a financial data failure

- **WHEN** 基本面请求失败而日线或估值请求成功
- **THEN** 页面保留已成功加载的其他区域，并在基本面区域显示可重试的不可用状态

#### Scenario: Avoid stale selection updates

- **WHEN** 用户快速连续切换两只股票且前一只股票的财务请求晚于后一只完成
- **THEN** 前一只请求的结果不得覆盖当前选中股票的基本面区域
