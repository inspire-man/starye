## ADDED Requirements

### Requirement: Server-owned candidate briefing scope

候选简报接口 MUST 接受可选的候选代码范围，但 MUST 只根据当前认证用户的最新候选快照读取事实。客户端提交的范围之外的分数、优先级、研究动作、原因或其他字段 MUST 被拒绝或忽略。

#### Scenario: Generate for the current filtered scope

- **WHEN** 用户提交一组来自当前候选页筛选结果的 `ts_codes`
- **THEN** 服务端只为当前用户最新候选快照中匹配的代码构造简报事实
- **AND** AI prompt 不包含范围之外的候选代码或客户端候选事实

#### Scenario: Pending candidate is outside the explicit snapshot scope

- **WHEN** 用户提交仍未进入最近一次快照的 pending 候选代码
- **THEN** 服务端返回 `QUANT_AI_CANDIDATE_BRIEFING_INPUT`
- **AND** 不调用 AI provider

#### Scenario: Omitted scope

- **WHEN** 请求省略 `ts_codes`
- **THEN** 服务端保持全量当前候选简报行为
- **AND** 仍从服务端当前用户数据构造事实

#### Scenario: Unknown, empty or oversized scope

- **WHEN** `ts_codes` 为空、包含不在当前候选快照中的代码或超过 50 个代码
- **THEN** 服务端返回明确的输入错误
- **AND** 不调用 AI provider

### Requirement: Scope-aware Quant interaction

Quant 候选页 MUST 使用当前筛选后的候选代码生成简报，并 MUST 展示当前筛选数量、候选总数和成功简报对应的范围。当前筛选没有候选时，生成操作 MUST 处于禁用状态。

#### Scenario: Filtered candidate briefing

- **WHEN** 当前筛选结果包含候选
- **THEN** 用户触发简报时请求体只包含当前筛选结果中已进入最近快照的候选代码
- **AND** 成功态显示本次简报范围数量以及当前候选总数

#### Scenario: Empty filtered result

- **WHEN** 筛选条件得到零个候选
- **THEN** 简报生成操作不可执行
- **AND** 页面不发起简报请求

### Requirement: Stale scope results are discarded

客户端 MUST 使用请求序号和筛选范围 key 丢弃过期响应。筛选条件、候选快照或观察池数据变化后，旧简报、复制状态和范围计数 MUST 被清理。

#### Scenario: Filter changes while AI is running

- **WHEN** AI 请求尚未返回时用户改变筛选条件
- **THEN** 旧响应不得覆盖新的筛选范围
- **AND** 页面等待用户为新范围重新生成简报

#### Scenario: Candidate snapshot refresh

- **WHEN** 候选快照或观察池被重新加载
- **THEN** 简报状态被清除并重新使用最新候选范围
- **AND** 确定性候选表字段不被 AI 响应改写
