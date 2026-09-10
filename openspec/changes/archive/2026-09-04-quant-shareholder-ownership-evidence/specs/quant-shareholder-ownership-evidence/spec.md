# quant-shareholder-ownership-evidence Specification

## ADDED Requirements

### Requirement: Normalize disclosed capital-structure history

Quant 股东回报 provider MUST 从 Eastmoney `CapitalStockStructure/PageAjax` 的 `lngbbd` 读取股本变动记录，并对请求代码、事件日期和总股本进行规范化。每条记录 MUST 保留变动原因；空总股本 MUST 保持为 `null`。

#### Scenario: Normalize a capital-change event

- **WHEN** Eastmoney 返回与请求股票代码匹配的股本变动记录
- **THEN** provider 返回规范化事件日期、总股本和变动原因
- **AND** 多条记录按事件日期从新到旧返回并去重

#### Scenario: Preserve incomplete source fields

- **WHEN** 股本变动记录的总股本或变动原因为空
- **THEN** 对应字段保留为 `null`
- **AND** 其他有效记录继续返回，domain 通过状态和 `missingFields` 标识证据不完整

### Requirement: Calculate period-adjacent share changes

股东回报 domain MUST 只使用相邻股本事件的有限总股本计算 `sharesOutstandingChange = currentTotalShares - previousTotalShares`，并在上一期总股本为正时计算变化比例。系统 MUST 保留正数、负数和零值，不得截断方向或把缺失值当作零。

#### Scenario: Identify a buyback-related reduction

- **WHEN** 相邻记录总股本有效、当前记录的变动原因包含“回购”且股本减少
- **THEN** 事件保留负的股本变化，并将减少股数的绝对值计入 `repurchaseSharesRetired`
- **AND** 不生成回购金额或成交均价

#### Scenario: Keep issuance and exercise distinct

- **WHEN** 变动原因是增发、债转股上市或自主行权
- **THEN** 系统只记录对应股本变化和原始原因
- **AND** 不把该变化计入回购股数

### Requirement: Expose isolated capital evidence

每个新生成的股东回报 item MUST 提供可选 `capitalStructureEvidence`，包含公式版本、状态、provider、观察时间、最新和上一条报告信息、相邻变化、回购注销股数及 `missingFields`。股本 provider 失败 MUST 标记 `unavailable` 并保留错误码，同时保持已成功的分红和现金流证据。

#### Scenario: Return a ready capital evidence

- **WHEN** provider 返回至少两条相邻且总股本有效的事件
- **THEN** evidence 状态为 `ready`
- **AND** 返回最新总股本、股本变化、变化比例和事件原因

#### Scenario: Isolate an upstream failure

- **WHEN** 股本结构请求超时、坏 JSON、代码错位或上游拒绝
- **THEN** evidence 状态为 `unavailable`
- **AND** 股息率、现金流证据和分红记录继续按各自读取结果返回

### Requirement: Preserve API, research, and UI boundaries

受保护的 `GET /api/quant/shareholder-returns` MUST 在新读取结果中返回可选 `capitalStructureEvidence`，继续使用现有 envelope、认证和用户隔离。研究报告 MUST 将股本变化作为 optional shareholder-return evidence；详情页 MUST 展示股本事实和回购金额缺口。新字段 MUST NOT 被 value-quality、因子权重、研究动作或决策推荐读取。

#### Scenario: Read legacy and new result shapes

- **WHEN** 前端读取没有 `capitalStructureEvidence` 的历史结果
- **THEN** 旧股东回报、现金流和研究详情仍可正常渲染
- **WHEN** 前端读取 ready、partial 或 unavailable 的新证据
- **THEN** 显示对应状态、可用字段、来源日期和缺口，不显示伪造零值

#### Scenario: Keep research scoring unchanged

- **WHEN** 股本证据存在、部分可用或 provider 失败
- **THEN** 研究报告保留 optional 证据和来源
- **AND** 硬证据评分、价值质量分、因子权重、研究动作和决策推荐保持原有结果
