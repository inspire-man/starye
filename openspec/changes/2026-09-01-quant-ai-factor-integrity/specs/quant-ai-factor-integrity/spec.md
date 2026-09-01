## ADDED Requirements

### Requirement: 因子事实包必须可追溯

研究摘要 AI 请求 MUST 为每个因子提供因子 key、权重、状态、来源、`evidenceKeys` 和 `missingEvidenceKeys`；AI 只能引用该因子声明的 evidence key。

#### Scenario: AI 复核因子证据

- **WHEN** 研究报告包含因子模型
- **THEN** 摘要请求事实包包含每个因子的证据映射和数据状态
- **AND** 服务端拒绝跨因子引用

### Requirement: AI 决策必须覆盖有权重因子

摘要 AI 和今日决策助手 MUST 对所有权重大于 0 的因子生成逐项复核；每项复核 MUST 具备可用 evidence key、合法立场和有效置信度。因子复核覆盖不足 100% 时，AI 复核 MUST 保持 rejected，最终判断 MUST 继续使用确定性结果。

#### Scenario: 省略因子复核

- **WHEN** AI 返回决策复核但省略 `factorReviews` 或遗漏有权重因子
- **THEN** 服务端保存摘要解释
- **AND** 结构化 AI 决策标记为 `factor-review-incomplete`
- **AND** AI 决策不得改变最终推荐

#### Scenario: 因子数据不足

- **WHEN** 有权重因子的证据状态为 missing 或 unavailable
- **THEN** 对应 AI 因子复核不得计入覆盖
- **AND** 确定性推荐保持观望或现有确定性方向

### Requirement: 因子健全性必须在界面可见

研究摘要界面 MUST 逐项展示有权重因子的权重、确定性状态、证据覆盖、缺失证据和 AI 复核纳入状态；未完成因子复核时 MUST 明确说明 AI 决策不会纳入最终推荐。

#### Scenario: 因子复核完整

- **WHEN** AI 对所有有权重因子返回合法复核并引用可用证据
- **THEN** 页面显示完整覆盖数量和各因子的已纳入状态

#### Scenario: 因子复核不完整

- **WHEN** AI 未返回某个有权重因子的复核或该因子证据不可用
- **THEN** 页面显示该因子的缺口
- **AND** 页面保留确定性推荐和人工核对路径
