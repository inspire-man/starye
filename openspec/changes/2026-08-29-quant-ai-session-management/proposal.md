## Why

候选 AI 会话历史已经可以跨页面保留，但当前只有自动保留上限，用户缺少主动清理入口。会话内容包含快照范围、简报和追问，补齐生命周期管理后，历史记录才具备可控、可核对的使用边界。

## What Changes

- 增加按用户隔离的候选 AI 会话删除接口，并以 D1 readback 确认删除结果。
- 扩展 Quant 客户端与历史面板，提供确认删除、删除中、成功、失败和重试状态。
- 删除成功后从历史列表移除记录、清理当前只读详情，并保持当前候选、筛选、评分和研究数据不变。
- 增加 API、客户端和组件测试，覆盖用户隔离、重复删除、删除后详情和历史列表一致性。

## Capabilities

### New Capabilities

- `quant-ai-session-management`: 管理当前用户的候选 AI 会话历史生命周期。

### Modified Capabilities

- 无。

## Impact

- API：扩展候选 AI session repository、路由参数/响应 schema 和集成测试。
- Quant：扩展 API client、候选简报历史组件及响应式状态样式。
- 数据库：复用已存在的 `quant_candidate_ai_session` 表，不增加 migration。
- 验证：需要运行 API/Quant 测试、type-check、lint、build、OpenSpec、GitNexus 和 Gateway 页面检查。

## 风险

- 删除请求与历史刷新可能交错；使用请求序号和当前 session ID 校验，避免旧响应恢复已删除记录。
- 历史列表由父组件控制或组件自行加载两种模式并存；删除事件同时提供本地更新和父组件通知。
- 删除属于不可逆的用户操作；界面使用二次确认，并将服务端 not-found 显示为明确失败状态。

## 可验证要求

- 系统 MUST 只允许当前认证用户删除自己的候选 AI 会话，并在成功响应前完成删除后的 D1 readback。
- 删除成功后，历史列表和详情接口 MUST 都不再返回该 session；其他用户的同名或不同 session MUST 保持可见性隔离。
- Quant MUST 将删除状态与当前候选确定性数据分离，删除过程与结果不得改变候选、筛选、评分或研究报告。
