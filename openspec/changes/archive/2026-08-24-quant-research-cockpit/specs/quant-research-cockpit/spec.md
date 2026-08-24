## ADDED Requirements

### Requirement: Candidate decision card

Quant 工作台 MUST 在已选股票的分析抽屉顶部展示可解释的候选决策卡。决策卡 MUST 显示命中规则数量、规则标签、20 日表现、数据完整度和至少一项需要核对的事实；缺失字段 MUST 显示为缺失状态，不得用默认值替代。

#### Scenario: Candidate with complete data

- **WHEN** 用户打开最新候选中的股票
- **THEN** 决策卡显示该股票的命中规则、`return20`、数据质量和可核对的技术/估值/财务提示
- **AND** 决策卡不把信号分描述为收益概率或买入建议

#### Scenario: Stock outside the latest candidate snapshot

- **WHEN** 用户从观察池打开一只不在最新候选快照中的股票
- **THEN** 抽屉显示“当前快照未覆盖”状态
- **AND** 仍可继续查看日线、估值和财务数据

### Requirement: Three-stock comparison

Quant 工作台 MUST 支持从候选表选择 2 至 3 只股票进入对比抽屉。对比抽屉 MUST 同时展示技术指标、估值指标和财务质量指标，并标记每个数据项的缺失状态和报告/观察时间。

#### Scenario: Compare selected candidates

- **WHEN** 用户选择 2 或 3 只候选并打开对比
- **THEN** 页面展示代码、名称、信号命中数、20 日表现、均线/活跃度/池内强度、PE/PB、营收同比、净利润同比、ROE 和资产负债率
- **AND** 技术指标先于估值和财务指标展示，便于快速筛选

#### Scenario: Comparison provider failure

- **WHEN** 某只股票的估值或财务请求失败
- **THEN** 该股票对应指标显示“暂不可用”，其他股票和技术指标仍然可读
- **AND** 页面不生成缺失数据的排名或结论

#### Scenario: Selection limit

- **WHEN** 用户已选择 3 只股票后再次选择第四只
- **THEN** 第四只不会进入对比集合，并保留当前 3 只选择

### Requirement: Research marker

Quant MUST 为观察池股票提供独立的研究标记，状态枚举 MUST 为 `unreviewed`、`priority`、`paused`、`excluded`，备注和复查日期可为空。研究标记 MUST 与候选评分、日线、估值和财务快照分开存储。

#### Scenario: Read marker

- **WHEN** 管理员读取 Quant 研究标记列表
- **THEN** API 返回观察池中的代码、状态、备注、复查日期和更新时间
- **AND** 没有标记的股票返回 `unreviewed`，而不是缺少记录

#### Scenario: Upsert marker

- **WHEN** 管理员提交观察池内股票的合法状态、备注或复查日期
- **THEN** API 幂等保存一条该股票的研究标记并返回权威读回
- **AND** 重复提交不会产生重复标记

#### Scenario: Invalid marker target

- **WHEN** 请求更新不在观察池中的代码或非法状态
- **THEN** API 返回稳定的 4xx Quant 错误
- **AND** D1 不新增研究标记

### Requirement: Research marker workflow

Quant UI MUST 在股票分析抽屉中显示并编辑研究状态和备注；保存成功后 MUST 保留当前股票详情并更新列表状态，不得触发日线同步或改变候选快照。

#### Scenario: Save marker from drawer

- **WHEN** 用户在分析抽屉选择状态、填写备注并保存
- **THEN** 页面显示保存成功状态，关闭抽屉后列表或候选入口显示该研究状态
- **AND** 刷新页面后状态和备注仍可读

#### Scenario: Marker failure

- **WHEN** 保存研究标记请求失败
- **THEN** 页面保留用户当前输入并显示可理解的错误信息
- **AND** 不覆盖最后一次已成功读回的研究标记
