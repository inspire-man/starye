## ADDED Requirements

### Requirement: User-scoped candidate AI sessions

系统 MUST 将候选 AI 会话与认证用户、候选快照 ID、快照生成时间和规范化候选范围绑定。

#### Scenario: Persist a briefing with authoritative identity

- GIVEN 当前用户存在已生成的候选快照和有效候选范围
- WHEN 候选简报生成成功
- THEN 服务端保存简报、快照身份、范围代码、provider、模型和时间
- AND 服务端完成同用户同会话的 D1 readback
- AND 响应包含 `sessionId`

#### Scenario: Reject a foreign session

- GIVEN 会话属于另一个用户或会话 ID 不存在
- WHEN 当前用户读取详情或追加追问
- THEN 服务端返回受保护的 not-found/input 错误
- AND 不调用 provider、不暴露会话内容

### Requirement: Bounded session retention

系统 MUST 为每个用户保留最近 10 个会话，并为每个会话保留最近 10 条追问。

#### Scenario: Trim old sessions

- GIVEN 当前用户已有超过 10 个会话
- WHEN 新会话完成持久化和 readback
- THEN 历史列表最多保留最近 10 个会话
- AND 会话按 `updatedAt DESC, id DESC` 返回

#### Scenario: Trim old questions

- GIVEN 一个会话已有超过 10 条追问
- WHEN 新追问追加成功
- THEN 返回和历史详情只包含最新 10 条追问

### Requirement: Read-only history restore

Quant MUST 展示最近会话的快照时间、范围和历史标记，并提供只读回看。

#### Scenario: Restore without mutating deterministic state

- GIVEN 用户点击历史会话的查看操作
- WHEN 会话详情加载成功
- THEN 面板展示该会话的简报和追问记录
- AND 面板标记为只读历史
- AND 当前候选表、筛选、评分、研究动作和当前快照保持不变

#### Scenario: Handle empty or unavailable history

- GIVEN 用户没有历史会话、历史正在加载或历史读取失败
- WHEN 面板渲染
- THEN 面板分别显示空、加载或错误状态
- AND 生成与当前候选确定性状态仍可独立使用

### Requirement: Current-snapshot question binding

追问 MUST 使用服务端当前快照事实。带 `session_id` 的追问 MUST 与当前快照 ID、范围 key 和候选代码完全匹配；省略 `session_id` 时 MUST 创建问题会话以保持现有追问行为。

#### Scenario: Append a question to the active session

- GIVEN 当前简报会话与当前快照范围一致
- WHEN 范围内追问成功
- THEN 追问追加到该会话并返回同一 `sessionId`

#### Scenario: Start a question-only session

- GIVEN 当前范围有效但页面还没有简报会话
- WHEN 追问成功
- THEN 服务端创建一个 `briefing = null` 的会话并返回新的 `sessionId`

#### Scenario: Reject a stale session scope

- GIVEN session 的快照或范围与当前请求不一致
- WHEN 客户端带该 session 追问
- THEN 服务端在 provider 调用前返回输入错误
