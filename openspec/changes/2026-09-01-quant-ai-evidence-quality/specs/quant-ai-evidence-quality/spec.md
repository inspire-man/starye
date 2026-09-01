## Purpose

让 Quant 把实际进入因子模型的原始证据、AI 复核影响和历史评估时点连接起来，使推荐既方便使用又能沿着来源、时间和权重边界复核。

## ADDED Requirements

### Requirement: 研究因子必须公开完整的已获取证据

研究报告 MUST 将当前 provider 已返回且属于研究因子的 PS、PEG、营收同比、扣非净利润同比、毛利率、净利率和资产负债率作为独立 evidence 项返回；每项 MUST 包含稳定 key、因子维度、来源、观察时间、公式版本、原始数值、状态和阈值。PS/PEG 属于估值增强证据，缺失或无效数值 MUST 保持为缺失并降低对应因子覆盖；其他核心盈利质量字段的缺失 MUST 让对应因子保持不完整，所有情况都禁止用零值替代。

#### Scenario: 财务与估值证据进入因子

- **WHEN** 研究报告包含有效的 valuation 或 financial provider 返回值
- **THEN** 报告返回对应的估值/盈利质量 evidence key
- **AND** 因子模型的 evidenceKeys 包含这些 key，AI prompt 也能看到其来源、时间和状态

#### Scenario: provider 字段缺失

- **WHEN** 某个 provider 字段为空、非法或 provider 请求失败
- **THEN** 对应 evidence 的 value 为 null 或 evidence 不可用
- **AND** 对应因子显示缺口；可选增强证据缺失时不伪装为完整，核心字段缺失时按现有覆盖规则阻断不完整的 AI 纳入

### Requirement: AI 因子影响必须可量化且不改写确定性基线

研究摘要和决策助手的 `factorImpact` MUST 返回服务端计算的 `evaluatedAt`、`aiScore`、`aiScoreDelta` 以及每个已定义因子的 `aiContribution`。AI 分 MUST 只使用通过证据、引用、置信度和新鲜度闸门的 AI 因子复核，并按报告快照权重计算；未纳入的因子贡献 MUST 为 null 或 0。该覆盖层 MUST NOT 修改确定性因子分、确定性推荐、研究动作或参考价格区间。

#### Scenario: AI 复核改变用户可见影响

- **WHEN** AI 对有权重因子完成合格复核，且复核方向与确定性报告不冲突
- **THEN** `aiScore`、`aiScoreDelta` 和逐因子 `aiContribution` 反映已接受复核的权重与立场
- **AND** 用户仍能同时看到未改写的确定性分数和推荐

#### Scenario: AI 复核不合格

- **WHEN** 因子数据缺失、引用无效、置信度不足或新鲜度闸门阻断复核
- **THEN** 对应因子的 AI 贡献为 0 或 null，AI 分只按其余已接受权重计算
- **AND** 确定性基线保持不变并显示未纳入原因

### Requirement: AI 因子影响必须持久化并保留评估时点

系统 MUST 将服务端生成的 AI 因子影响快照写入研究摘要、决策记录和决策助手的现有 JSON 持久化边界，并保存可解析的评估时间。历史数据缺少该快照时，API MUST 保留原有结果并明确按旧格式派生或标记不可用；读取快照 MUST 不能把当前因子配置替换成历史配置。

#### Scenario: 刷新后回看同一 AI 影响

- **WHEN** 用户读取已保存的研究摘要、决策记录或决策助手历史
- **THEN** 返回当次保存的 AI 影响分、分差、贡献、权重和评估时间
- **AND** 后续数据刷新或因子配置变化不改写该历史快照

#### Scenario: 旧 JSON 兼容

- **WHEN** 历史 JSON 没有 AI 因子影响快照
- **THEN** API 和客户端继续返回原有摘要、确定性结果和 AI 因子复核
- **AND** 新增审计区域显示旧格式或根据已有复核派生的状态，而不是伪造已持久化

### Requirement: AI 结构化响应必须兼容中转字段命名

摘要和今日决策助手 MUST 将 camelCase 与 snake_case 的等价结构化字段归一化后再校验，包括因子复核、决策复核、引用证据和失效条件。字段命名兼容 MUST NOT 放宽固定版本、枚举、数值范围、证据归属、引用存在性或禁止交易内容校验；无法归一化的响应 MUST 返回受控的无效响应错误。

#### Scenario: 中转平台返回 snake_case

- **WHEN** AI 返回 `factor_reviews`、`decision_review`、`decision_version` 或 `cited_evidence_keys`
- **THEN** 服务端按对应 camelCase 字段解释并继续执行完整校验
- **AND** 合法响应进入已有的 AI 因子复核和影响快照流程

#### Scenario: 命名兼容不掩盖非法数据

- **WHEN** AI 返回未知版本、跨因子证据、非法枚举或非有限数值
- **THEN** 服务端仍拒绝该响应并保留确定性结果
- **AND** 不写入不完整或未经校验的 AI 摘要/评估

### Requirement: 界面必须区分数据覆盖和 AI 实际影响

研究摘要、决策记录和今日决策助手 MUST 展示每个因子的证据覆盖、数据状态、配置权重、确定性分数、AI 立场、AI 纳入权重和评估时间；页面 MUST 明确 AI 影响分不是确定性分数改写。新增内容在 390px 视口下 MUST 在容器内换行且不得造成页面级横向溢出。

#### Scenario: 用户核对一只股票

- **WHEN** 用户打开含有完整财务证据和 AI 复核的研究详情
- **THEN** 用户可以从因子行看到证据来源/时间、确定性贡献、AI 贡献和 AI 分差
- **AND** 页面同时显示当前数据时效与 AI 快照评估时点

#### Scenario: 数据不完整时查看结果

- **WHEN** 一个或多个因子证据缺失或 AI 未纳入
- **THEN** 页面显示具体缺失 key、未纳入权重和当前确定性结论
- **AND** 说明不会把缺失数据或未接受 AI 当作正向依据
