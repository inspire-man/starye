## ADDED Requirements

### Requirement: 候选自动研究闭环

候选研究页 MUST 提供自动研究闭环入口，批次最多包含 3 只当前候选。每只股票 MUST 按入观察池、生成确定性研究报告、生成可选 AI 复核的顺序执行，并独立展示 `watchlist`、`research`、`ai` 和 `completed/error` 阶段。

#### Scenario: 从筛选结果启动闭环

- **WHEN** 用户在候选页启动自动研究且当前筛选结果包含候选
- **THEN** 系统最多取 3 只候选逐项执行闭环
- **AND** 已在观察池的股票复用现有记录，不重复创建观察池项
- **AND** 研究报告和 AI 摘要分别持久化到已有研究表

#### Scenario: 单项失败不影响其他股票

- **WHEN** 某一股票的入池、报告或 AI 阶段失败
- **THEN** 该股票显示失败阶段和可重试入口
- **AND** 其他股票继续执行并保留已成功的报告/摘要
- **AND** AI 阶段失败不删除或隐藏已成功的确定性研究报告

#### Scenario: 完成后回到可回看详情

- **WHEN** 某一股票完成确定性报告或完整闭环
- **THEN** 用户可从批次条目打开现有研究详情
- **AND** 页面刷新候选、观察池、研究历史和决策待办

### Requirement: AI 因子级复核

AI 研究摘要 MUST 返回可选的 `factorReviews` 数组。每项 MUST 使用报告因子模型中的因子 key，stance MUST 为 `support`、`caution`、`oppose` 或 `insufficient`，confidence MUST 为 0 到 100 的有限数字，且 MUST 包含可核验的理由和属于该因子的 evidence keys。

#### Scenario: 因子复核使用报告快照

- **WHEN** AI 复核一份研究报告
- **THEN** AI 只能解释该报告保存的因子配置、因子分数和 evidence
- **AND** AI 不得改写因子权重、确定性分数或参考价格区间
- **AND** 每个引用 key 都能在该报告中找到并归属于对应因子

#### Scenario: 无效复核被拒绝

- **WHEN** AI 返回未知因子、跨因子 evidence key、非有限 confidence 或超长/空理由
- **THEN** API MUST 以受控的 AI 无效响应错误结束
- **AND** 不得写入该次无效摘要

### Requirement: AI 影响最终推荐的门槛

系统 MUST 将 AI 因子复核作为可追溯覆盖层，而不是确定性因子模型的替代品。AI 只有在确定性报告 coverage 至少 80、总体 confidence 至少 60、总体引用非空、至少一项因子复核通过数据/引用门槛且复核方向没有与 AI 总体推荐发生加权冲突时，才可影响最终看多/看空/观望推荐；否则 MUST 保留确定性推荐并显示未纳入原因。

#### Scenario: 合格 AI 覆盖确定性推荐

- **WHEN** 报告数据覆盖充分，AI 总体复核和因子复核均达到门槛且方向一致
- **THEN** 研究详情显示 AI 复核已纳入最终推荐
- **AND** 参考买入/卖出区间仍来自确定性报告

#### Scenario: 数据不足或因子冲突

- **WHEN** 报告 coverage 低于 80、AI confidence 低于 60、缺少引用或加权因子复核与总体方向冲突
- **THEN** 最终推荐保持确定性推荐
- **AND** 页面显示数据不足、低置信度或因子冲突的具体状态

### Requirement: AI 复核持久化与历史兼容

系统 MUST 将已校验的 `factorReviews` 随 AI 摘要持久化，并在保存用户决策时把它复制到决策快照。读取没有该字段的历史摘要或决策快照 MUST 按空数组处理，不得影响既有研究历史和决策队列。

#### Scenario: 决策快照保留 AI 因子依据

- **WHEN** 用户在存在最新 AI 摘要的研究 run 上保存决策
- **THEN** 决策记录快照包含当时的 AI 因子复核、引用和 accepted 状态
- **AND** 后续修改当前因子配置不会改变该历史快照

#### Scenario: 旧数据继续可读

- **WHEN** 历史摘要或决策快照没有 `factorReviews`/`aiFactorReviews`
- **THEN** API 和 Quant 客户端返回空数组
- **AND** 既有总体摘要、决策队列和详情保持可用

### Requirement: 自动研究状态的窄屏可用性

自动研究区域 MUST 提供加载、空、AI 未配置、单项失败和完成状态；在 390px 宽度下阶段文本、股票名称、操作入口和错误说明 MUST 在容器内换行，不造成页面级横向溢出。

#### Scenario: 390px 下保持阶段和错误可读

- **WHEN** 用户在 390px 宽度查看包含长名称、AI 配置错误和单项失败的自动研究批次
- **THEN** 阶段、错误说明和操作按钮在容器内换行
- **AND** 页面不出现横向滚动
