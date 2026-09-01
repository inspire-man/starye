# quant-ai-freshness-gate Specification

## ADDED Requirements

### Requirement: Gate decision readiness by data freshness

判断就绪度 MUST 增加数据时效检查，并与字段完整性独立计算。基础数据健康和研究报告快照的时效 MUST 取更严格者。最新数据 MUST 通过；需复核数据 MUST 使整体状态为“仅供参考”；已过期或时间未知 MUST 使整体状态为“暂不可用”。

#### Scenario: Fresh data is ready

- **WHEN** 数据新鲜度为最新且其他完整性、AI、价格检查通过
- **THEN** 判断就绪度为“可参考”
- **AND** 时效检查显示通过

#### Scenario: Aging data needs review

- **WHEN** 数据新鲜度为需复核
- **THEN** 判断就绪度至少为“仅供参考”
- **AND** 时效检查说明需要刷新或复核数据

#### Scenario: Stale or unknown data is blocked

- **WHEN** 数据新鲜度为已过期或时间未知
- **THEN** 判断就绪度为“暂不可用”
- **AND** 时效检查说明当前结果不能作为最新判断依据

#### Scenario: Base data is fresh but report snapshot is old

- **WHEN** 基础数据为最新但研究报告快照超过 48 小时未更新
- **THEN** 系统按研究报告快照的较低新鲜度执行门控
- **AND** AI 不得改写简化推荐

### Requirement: Apply AI recommendation only on fresh data

研究详情 MUST 只有在数据新鲜度为最新时，才将已接受的 AI 决策复核用于简化推荐。需复核、已过期或时间未知时，系统 MUST 保留确定性推荐作为当前推荐。

#### Scenario: Accepted AI review with fresh data

- **WHEN** AI 决策复核已接受且数据新鲜度为最新
- **THEN** 简化推荐使用 AI 复核结果
- **AND** 页面标记 AI 已影响最终推荐

#### Scenario: Accepted AI review with aging data

- **WHEN** AI 决策复核已接受但数据新鲜度为需复核
- **THEN** 简化推荐保留确定性结果
- **AND** AI 复核结果仍显示但标记为未纳入最终推荐

#### Scenario: Accepted AI review with stale or unknown data

- **WHEN** AI 决策复核已接受但数据新鲜度为已过期或时间未知
- **THEN** 简化推荐保留确定性结果
- **AND** 判断就绪度阻断当前判断

### Requirement: Keep AI evidence traceable when gated

AI 复核正文、因子影响审计、引用证据和门控原因 MUST 同时可见；门控 MUST NOT 删除或伪装 AI 复核快照，也 MUST NOT 修改确定性报告的因子分、权重或参考价格。

#### Scenario: Explain why an accepted review was not applied

- **WHEN** 已接受 AI 复核因数据时效未达到最新而未应用
- **THEN** 页面明确显示数据时效状态和未纳入原因
- **AND** 用户仍能查看 AI 因子复核和确定性来源

### Requirement: Keep freshness gate responsive and honest

时效检查和 AI 未纳入提示 MUST 复用现有可访问状态样式；在 390px 视口中长原因 MUST 换行且不产生横向滚动。门控过程 MUST NOT 触发额外 API 请求或写入。

#### Scenario: Review the gate on a narrow viewport

- **WHEN** 用户在 390px 查看研究详情
- **THEN** 时效检查、确定性推荐和 AI 门控原因均可读
- **AND** 页面没有横向滚动或内容遮挡
