## ADDED Requirements

### Requirement: Multi-period cashflow evidence

现有受保护的 `GET /api/quant/shareholder-returns` MUST 在有现金流报告时返回 `cashflowEvidence.history`，最多 8 条，按 `reportDate` 从新到旧排列并按报告期去重。每条 MUST 保留报告元数据、经营现金流、资本开支、净利润、同报告期现金分红、利息支出、有息负债、自由现金流、利息后自由现金流、分红覆盖和适用的年度支付率；可靠值缺失 MUST 保持为 `null`。

#### Scenario: Return aligned history

- **WHEN** Eastmoney 返回多个合法现金流报告以及部分同报告期利润表和资产负债表字段
- **THEN** API 返回报告期倒序的历史序列
- **AND** 每期的自由现金流、利息后自由现金流和分红覆盖只使用该期字段计算
- **AND** 利润表或资产负债表缺失时，该期对应辅助值和衍生值保持 `null`

#### Scenario: Limit and deduplicate history

- **WHEN** provider 返回超过 8 条报告或同一报告期存在重复记录
- **THEN** history 最多包含 8 个唯一报告期
- **AND** 最新字段继续对应排序后的最新报告

#### Scenario: Preserve negative values and missing data

- **WHEN** 某期自由现金流或利息后自由现金流为负，或某期缺少经营现金流/资本开支/利息支出
- **THEN** 负值原样保留
- **AND** 缺失输入和无法计算的衍生值为 `null`，不使用零值或相邻期值

### Requirement: Coverage summary is separate from judgment

`cashflowEvidence.historySummary` MUST 返回版本、历史状态、报告期数量、现金流核心完整期数、正自由现金流期数、正利息后自由现金流期数、现金分红覆盖期数、可计算年度支付率期数、最新报告期和字段缺口。summary MUST 只表示证据覆盖，现有现金流状态、价值质量、因子权重、研究动作、推荐和决策 assistant 输入保持原语义。

#### Scenario: Complete multi-period coverage

- **WHEN** 至少有两期报告且现金流核心字段在这些期间可计算
- **THEN** summary 标记为可用并返回各项期数统计
- **AND** 页面将统计显示为研究覆盖信息，不输出可持续性定论或买卖指令

#### Scenario: Partial or unavailable coverage

- **WHEN** 只有一期报告、历史为空，或现金流 provider 发生安全错误
- **THEN** summary 分别标记部分、数据不足或不可用
- **AND** provider 错误码和字段缺口可见，已有最新字段和其他股东回报证据继续独立返回

### Requirement: Research report and compatibility presentation

新生成的研究报告 MUST 增加 optional evidence key `shareholder-cashflow-history`，包含历史期数、覆盖统计、来源、观察期和 formula version；该 evidence MUST 不参与硬证据分数、factor model、recommendation 或 decision assistant。Quant client MUST 同时读取 camelCase/snake_case，并将缺少 history/summary 的 legacy payload 归一化为空历史和兼容缺省值。

#### Scenario: Review historical shareholder evidence

- **WHEN** 用户打开包含多期现金流历史的研究详情
- **THEN** 详情页展示报告期、自由现金流、利息后自由现金流、分红覆盖和缺失状态
- **AND** 来源时间、辅助字段缺口与“仅用于研究核对”的边界可读

#### Scenario: Read a legacy payload

- **WHEN** 历史 `cashflowEvidence` 没有 `history` 或 `historySummary`
- **THEN** client 仍成功解析现有最新现金流字段
- **AND** 历史区域显示数据不足或隐藏空历史，不清空其他详情区域

#### Scenario: Narrow viewport and stale data

- **WHEN** 用户在 390px 宽度查看详情，或刷新请求晚于当前股票选择返回
- **THEN** 历史行在容器内换行且无页面级横向溢出
- **AND** 旧请求不覆盖当前股票的历史证据
