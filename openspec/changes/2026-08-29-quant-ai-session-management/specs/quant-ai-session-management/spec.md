## Purpose

为候选 AI 会话历史提供用户可控的删除生命周期，并让删除结果与只读历史展示保持一致、可核对。

## ADDED Requirements

### Requirement: User-scoped session deletion

系统 MUST 通过当前认证用户与 session ID 的联合条件删除候选 AI 会话，并在成功响应前完成删除后的权威存储 readback。

#### Scenario: Delete an owned session

- **WHEN** 当前认证用户删除自己拥有的有效 session ID
- **THEN** API 返回成功、`deleted = true` 和被删除的 session ID
- **AND** 随后的列表与详情读取都不再返回该 session

#### Scenario: Reject a missing or foreign session

- **WHEN** 当前用户删除不存在或属于其他用户的 session ID
- **THEN** API 返回 not-found 错误
- **AND** 其他用户的 session 数据保持不变

#### Scenario: Keep deterministic research data unchanged

- **WHEN** 用户删除候选 AI 会话
- **THEN** 候选快照、筛选、评分、研究运行和研究报告保持原值
- **AND** 服务端不调用 AI provider

### Requirement: Manageable history surface

Quant MUST 在候选 AI 历史列表中提供可访问的删除确认交互，并区分删除中、成功、失败和空列表状态。

#### Scenario: Confirm and complete deletion

- **WHEN** 用户在历史项上触发删除并完成二次确认
- **THEN** 该项显示删除中状态并暂时锁定重复操作
- **AND** 删除成功后该项从列表移除、选中详情清空并显示成功反馈

#### Scenario: Cancel or retry deletion

- **WHEN** 用户取消确认或删除请求失败
- **THEN** 取消操作保留历史项，失败操作保留历史项并显示错误
- **AND** 用户可以再次触发删除或重试，而当前候选 AI 内容保持可用

#### Scenario: Ignore stale deletion-related responses

- **WHEN** 删除请求、历史详情请求或历史列表刷新以交错顺序返回
- **THEN** 面板只应用当前 session ID 和当前请求序号对应的结果
- **AND** 已删除 session 的旧详情不会重新出现在当前面板
