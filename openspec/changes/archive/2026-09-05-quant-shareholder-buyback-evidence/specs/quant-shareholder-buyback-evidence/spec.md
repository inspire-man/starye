# quant-shareholder-buyback-evidence Specification

## ADDED Requirements

### Requirement: Normalize disclosed repurchase plans

Quant 回购 provider MUST 从 Eastmoney `RPTA_WEB_GETHGLIST_NEW` 读取请求股票的回购计划，并校验 `DIM_SCODE`/`SECUCODE` 与请求代码一致。每条记录 MUST 保留计划编号、公告日期、开始日期、结束日期、完成日期、实施状态、计划金额上下限、已实施金额和已实施股数；日期统一为 `YYYY-MM-DD`，缺失金额和日期保持为 `null`。

#### Scenario: Normalize an executed repurchase plan

- **WHEN** Eastmoney 返回含 `REPURCODE`、`DIM_SCODE`、`UPD`、`REPURAMOUNT` 和 `REPURNUM` 的有效计划
- **THEN** provider 返回规范化日期、实施状态、已实施金额和已实施股数
- **AND** 多条计划按最新公告日期从新到旧返回，并按计划编号去重

#### Scenario: Keep a pending plan separate from executed amount

- **WHEN** 计划包含 `REPURAMOUNTLOWER`/`REPURAMOUNTLIMIT` 但 `REPURAMOUNT` 为空
- **THEN** provider 保留计划金额区间
- **AND** 已实施金额字段保持为 `null`

### Requirement: Calculate repurchase amount evidence

股东回报 domain MUST 只对有限的已实施金额计算 `repurchaseAmount`，并将返回样本内各计划的有限 `REPURAMOUNT` 求和。计划金额上下限 MUST 仅作为计划上下文汇总；研究报告和 UI MUST 区分计划金额与已实施金额。

#### Scenario: Sum executed amounts across plans

- **WHEN** 样本内存在两项已完成或实施中的有效 `REPURAMOUNT`
- **THEN** `repurchaseAmount` 等于这些已实施金额之和
- **AND** 计划金额上下限与已实施金额分别返回

#### Scenario: Preserve missing executed amount

- **WHEN** 回购计划存在但所有 `REPURAMOUNT` 均为空
- **THEN** `repurchaseAmount` 为 `null`，证据状态为 `partial`
- **AND** `missingFields` 明确指出已实施回购金额仍待来源返回

### Requirement: Expose isolated repurchase evidence

每个新生成的股东回报 item MUST 提供可选 `repurchaseEvidence`，包含公式版本、状态、provider、错误码、观察时间、已实施金额、计划金额区间、回购计划记录和 `missingFields`。回购 provider 失败 MUST 标记为 `unavailable`，并保持同一 item 中已成功的分红、现金流和股本证据。

#### Scenario: Return ready repurchase evidence

- **WHEN** provider 返回至少一项有限已实施金额
- **THEN** evidence 状态为 `ready`
- **AND** `repurchaseAmount` 与对应计划记录可核对

#### Scenario: Isolate an upstream failure

- **WHEN** 回购请求超时、坏 JSON、响应代码错位或上游拒绝
- **THEN** evidence 状态为 `unavailable`，并返回安全错误码
- **AND** 分红、现金流和股本区域继续按各自读取结果返回

### Requirement: Preserve API, research, and decision boundaries

受保护的 `GET /api/quant/shareholder-returns` MUST 在新读取结果中返回可选 `repurchaseEvidence`，继续使用现有 envelope、认证、用户隔离和按股票局部结果。研究报告 MUST 将已实施回购金额作为 optional shareholder-return evidence；详情页 MUST 展示已实施金额、计划区间、实施状态、报告日期和缺口。价值质量、因子配置、研究优先级、研究动作、推荐和决策助手 MUST 继续读取原有字段。

#### Scenario: Read legacy and new result shapes

- **WHEN** 前端读取没有 `repurchaseEvidence` 的历史结果
- **THEN** 旧股东回报和研究详情继续正常渲染
- **WHEN** 前端读取 ready、partial 或 unavailable 的新证据
- **THEN** 页面显示对应状态、来源日期、计划与已实施字段及缺口，并保留 `null` 的缺失语义

#### Scenario: Keep score and recommendation unchanged

- **WHEN** 回购证据可用、部分可用或 provider 失败
- **THEN** 研究报告保留 optional evidence 和来源
- **AND** 价值质量分、因子权重、研究动作、推荐和决策助手结果保持原有口径
