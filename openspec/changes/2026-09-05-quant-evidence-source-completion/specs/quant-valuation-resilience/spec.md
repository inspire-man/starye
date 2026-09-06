## MODIFIED Requirements

### Requirement: 估值回退

估值 provider MUST 在主公开行情接口失败时尝试配置明确的公开回退接口；当主接口返回合法快照但存在缺失字段时，provider 也 MUST 尝试公开估值明细接口按字段补充。所有回退和补充数据 MUST 经过代码匹配、响应结构和有限数值校验；补充接口缺少动态 PE、静态 PE、PEG 或市值时 MUST 返回 `null`，不得推算或沿用上一来源的值。主接口已有的有限字段 MUST 优先保留。

#### Scenario: 主接口字段缺失、明细接口提供 PEG

- **WHEN** 主估值接口返回目标股票但 PEG 为空，估值明细接口返回同一股票的有限 PEG
- **THEN** API 返回补充后的 PEG 和主接口已有字段
- **AND** 单股与观察池比较继续使用同一标准化契约

#### Scenario: 主接口字段缺失、明细接口也缺失

- **WHEN** 两个合法响应都没有 PEG
- **THEN** PEG 保持 `null`
- **AND** 页面继续把 PEG 作为明确数据缺口展示

#### Scenario: 回退接口成功

- **WHEN** 主估值接口不可达且回退接口返回目标股票的合法报告期估值
- **THEN** API 返回标准化快照，并保留可用的 TTM PE、PB、PS 等字段
- **AND** 单股与观察池比较继续使用同一标准化契约

#### Scenario: 两个来源均失败

- **WHEN** 主接口和回退接口都失败
- **THEN** API 返回现有 Quant provider 错误码
- **AND** 不返回猜测值或部分错误快照
