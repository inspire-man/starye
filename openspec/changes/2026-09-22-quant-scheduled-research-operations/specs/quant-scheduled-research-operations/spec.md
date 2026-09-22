# Quant 后台研究运营闭环

## ADDED Requirements

### Requirement: 用户只能读取自己的运行历史

系统 MUST 提供认证用户作用域的后台研究运行历史接口，按开始时间倒序返回有限条数；接口不得返回其他用户的 run 或 item。

#### Scenario: 读取最近历史

- **WHEN** 用户请求 `GET /api/quant/research/schedule/history?limit=10`
- **THEN** 返回该用户最近最多 10 次运行及每次的状态、计数和阶段条目
- **AND** 没有历史时返回空数组

### Requirement: 手动触发保持调度边界

系统 MUST 提供认证用户的手动触发接口，复用现有 scheduled research tick；一次请求最多处理 3 个 due item，并继续遵守 lease、cooldown、paused/excluded 和数据缺口规则。

#### Scenario: 手动触发一批

- **WHEN** 用户请求 `POST /api/quant/research/schedule/run`
- **THEN** 系统只处理当前用户的 due item
- **AND** 返回本次 tick 的 runId、处理数量和跳过原因
- **AND** 有效 lease 或 cooldown 存在时不得启动重复运行

### Requirement: Overview 可追溯且不产生交易文案

Overview MUST 展示最近运行和有限历史，并允许用户手动触发；状态文案只描述运行阶段、来源缺口和错误码，不将运行成功解释为买卖结论。

#### Scenario: 手动触发后刷新

- **WHEN** 用户点击立即运行
- **THEN** 页面显示处理中状态，完成后刷新最近运行和历史
- **AND** data/research/ai 阶段错误保持可见

## Invariants

- reviewDate 仅按现有 ready/partial 规则推进。
- insufficient_data、来源失败和 AI 失败保持可区分。
- 所有响应和 D1 查询继续按 Better Auth user.id 隔离。
