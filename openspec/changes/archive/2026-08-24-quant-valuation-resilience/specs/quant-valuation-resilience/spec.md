# quant-valuation-resilience Specification

## ADDED Requirements

### Requirement: 独立估值读取

Quant 工作台 MUST 独立读取目标股票估值和观察池相对比较。比较请求失败时 MUST 保留成功的目标快照，不得清空日线、财务、候选或研究摘要数据。

#### Scenario: 目标成功、比较失败

- **WHEN** `GET /api/quant/valuation/:tsCode` 成功且 `GET /api/quant/valuation/compare/:tsCode` 失败
- **THEN** 页面展示目标 PE/PB 等可用字段
- **AND** 仅观察池相对位置显示暂不可用并允许单独重试

#### Scenario: 目标失败

- **WHEN** 目标估值接口返回 timeout、上游失败或无效响应
- **THEN** 页面显示对应的“请求超时、数据源暂时不可用或响应格式异常”等解释
- **AND** 页面保留已成功加载的日线、财务和技术结论

### Requirement: 估值回退

估值 provider MUST 在主公开行情接口失败时尝试配置明确的公开回退接口；回退接口返回的数据 MUST 经过代码匹配、响应结构和数值校验。回退来源缺少动态 PE、静态 PE、PEG 或市值时 MUST 返回 `null`，不得推算或沿用上一来源的值。

#### Scenario: 回退接口成功

- **WHEN** 主估值接口不可达且回退接口返回目标股票的合法报告期估值
- **THEN** API 返回标准化快照，并保留可用的 TTM PE、PB、PS 等字段
- **AND** 单股与观察池比较继续使用同一标准化契约

#### Scenario: 两个来源均失败

- **WHEN** 主接口和回退接口都失败
- **THEN** API 返回现有 Quant provider 错误码
- **AND** 不返回猜测值或部分错误快照

### Requirement: 交叉研究结论

工作台 MUST 根据技术结构、估值相对位置、财务质量与数据完整度生成解释性结论。结论 MUST 能识别技术与基本面同向、技术与估值冲突、基本面尚可但等待技术确认以及数据不足四类边界，并明确“不代表未来收益”。

#### Scenario: 多维数据同向

- **WHEN** 技术信号充分、至少两项财务质量指标改善或处于较好位置，且估值没有处于观察池高位
- **THEN** 结论显示适合优先人工核对，并列出支持依据和估值核对项

#### Scenario: 技术强但估值偏高

- **WHEN** 技术信号充分且至少两个估值相对位置处于观察池高位
- **THEN** 结论显示走势与估值存在冲突，下一步优先核对盈利持续性，不给出买入结论

#### Scenario: 数据不完整

- **WHEN** 估值、财务或日线关键字段不足
- **THEN** 结论显示数据完整度不足，明确缺少的维度和更新动作
