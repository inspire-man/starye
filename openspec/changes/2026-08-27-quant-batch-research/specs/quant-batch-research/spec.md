## Purpose

为候选对比后的研究工作提供可控的批量入口，让用户一次处理少量候选并逐只核对真实的研究快照结果，而不改变已有研究报告的权威边界。

## ADDED Requirements

### Requirement: Batch research initiation

Quant 工作台 MUST 在候选对比抽屉中为当前选中的 2 至 3 只候选提供批量生成研究报告的入口。批量操作 MUST 为每只候选创建独立的研究运行，并在批量进行时阻止重复启动。

#### Scenario: Start a batch for selected candidates

- **WHEN** 用户已选择 2 或 3 只候选并打开候选对比抽屉
- **THEN** 页面显示批量研究入口，触发后为每只选中候选调用现有研究运行能力
- **AND** 页面保留当前对比数据和候选选择，不把批量结果混入信号分或候选排序

#### Scenario: Insufficient selection

- **WHEN** 用户选择少于 2 只候选
- **THEN** 批量研究入口不可用或不执行任何研究请求
- **AND** 当前选择保持不变

### Requirement: Bounded per-candidate progress

批量研究 MUST 限制在当前最多 3 只候选内，并以不超过 2 个并行请求处理任务。页面 MUST 为每只候选显示排队、进行中、成功或失败中的一种状态；成功状态 MUST 使用接口返回的研究运行状态和研究动作。

#### Scenario: Progress and successful result

- **WHEN** 批量研究正在执行或某只候选已返回研究运行
- **THEN** 对应候选从排队变为进行中，再显示证据完整、部分可用或数据不足中的实际返回状态
- **AND** 页面不使用默认分数、默认动作或虚构证据填充结果

#### Scenario: Research request is bounded

- **WHEN** 用户对 3 只候选启动批量研究
- **THEN** 同时执行的研究请求数量不超过 2，且最终最多产生 3 个独立研究运行
- **AND** 任务按候选代码稳定归属到对应结果行

### Requirement: Partial failure handling

批量研究 MUST 独立记录每只候选的成功或失败。单只请求失败 MUST 不取消其他候选；批量完成后 MUST 显示成功数、失败数和失败原因，并允许用户再次发起批量操作。

#### Scenario: One candidate fails

- **WHEN** 一只候选的研究运行请求失败而其他候选请求成功
- **THEN** 成功候选保留真实研究运行状态，失败候选显示可理解的错误状态和原因
- **AND** 批次显示部分完成，不把失败候选计入成功数

#### Scenario: Retry after completion

- **WHEN** 批量研究已完成且用户再次触发批量研究
- **THEN** 页面为当前选中的候选重新建立本批次状态并发起新的独立请求
- **AND** 旧研究运行仍由既有历史查询保留，不被前端静默覆盖或删除
