## ADDED Requirements

### Requirement: 报表端点必须按需补充财报原始字段

AkShare bridge MUST 在现有财报指标记录存在目标空字段或主指标端点没有有效记录时，按需探测利润表和资产负债表报告端点。利润表 MAY 补充营业收入、收入同比、净利润、净利润同比和扣非净利润；资产负债表 MAY 补充负债规模。新端点 MUST 只写入同报告期的空字段，已有值 MUST 保持不变。

#### Scenario: 利润表补充缺失利润字段

- **WHEN** 财报指标端点返回 `2026-06-30` 但营业收入和净利润为空，利润表返回同报告期有限原始值
- **THEN** bridge financials 返回该报告期的营业收入和净利润
- **AND** 财报指标端点已有的 ROE、毛利率和行业字段保持不变
- **AND** source endpoints 包含实际调用的利润表端点

#### Scenario: 资产负债表补充负债规模

- **WHEN** 财报指标端点返回有效报告但负债规模为空，资产负债表返回同报告期 `TOTAL_LIABILITIES`
- **THEN** bridge financials 返回该负债规模
- **AND** 不从总资产、总权益或同比字段推导其他比率

### Requirement: 报表来源失败必须局部可见

利润表和资产负债表端点 MUST 独立记录尝试、空结果、坏行、缺失和异常的稳定错误。单个报表端点失败 MUST NOT 丢弃其他有效财报记录，也 MUST NOT 把空值转换成零值或上一期值。

#### Scenario: 一个报表端点失败

- **WHEN** 财报指标和利润表成功，但资产负债表超时或不可用
- **THEN** financials 保留财报指标及利润表已返回的字段
- **AND** errors 包含资产负债表端点标识和稳定错误码
- **AND** 负债规模继续为显式 `null`

#### Scenario: 目标字段完整时跳过端点

- **WHEN** 财报指标报告已包含所有当前补充目标字段
- **THEN** bridge 不请求利润表或资产负债表端点
- **AND** response 的 source endpoints 不虚构未调用端点

### Requirement: 报告期和证券代码必须保持一致

报表 normalizer MUST 校验证券代码和合法报告期；合并 MUST 以报告期为键。代码不匹配或无合法报告期的记录 MUST 被丢弃并记录稳定错误，跨报告期记录 MUST NOT 提升当前报告的字段覆盖。

#### Scenario: 报表报告期不匹配

- **WHEN** 主报告期为 `2026-06-30` 而报表只有 `2025-12-31`
- **THEN** 主报告的空字段保持 `null`
- **AND** 不把跨期数据写入主报告
- **AND** 有效的独立报表记录可以保留在 bridge history 中
