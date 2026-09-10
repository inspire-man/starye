## Context

现有候选 AI session 已保存于 `quant_candidate_ai_session`，API 已提供按用户过滤的列表和详情读取，Quant 面板支持历史只读恢复。此次只补充生命周期删除，不改变表结构、会话内容格式或 AI provider 边界。

## Goals / Non-Goals

**Goals:**

- 通过 user ID 与 session ID 的联合条件执行删除。
- 用删除后的详情 readback 作为成功边界，并返回稳定的 session ID。
- 在历史面板中提供可访问的二次确认、删除中、失败和成功反馈。

**Non-Goals:**

- 保留上限、快照绑定、追问追加和只读恢复语义保持原样。
- 当前候选、确定性评分、研究运行和 AI 配置保持原样。

## Decisions

### 删除 API 复用现有 session 资源

新增 `DELETE /api/quant/candidates/ai-sessions/:sessionId`。路由沿用现有认证边界和参数 schema；repository 先按 user/session 读取归属，再执行带相同条件的删除，最后重新读取确认记录不存在。缺少或属于其他用户的 session 返回既有 `QUANT_NOT_FOUND`，避免暴露归属。

备选方案是软删除字段或独立回收站。当前历史上限只有 10 条且用户需求是立即清理，软删除会扩大 schema、列表过滤和 migration 范围，收益不足，因此复用现有硬删除路径。

### 历史行拆分为查看与删除操作

现有历史行是整行 button，删除控件不能嵌套在 button 内。将每行调整为普通容器，内部使用独立的查看 button 和 Trash 图标 button；首次点击进入该行确认态，确认后调用删除 API，取消则恢复查看态。删除中锁定该行操作，其他历史和当前候选状态保持可用。

组件在自行加载历史时先本地移除，再用列表接口刷新；父组件传入历史时发出 `sessionDeleted` 事件，由父组件决定后续列表来源。两种模式都清理同 ID 的选中详情，并递增详情请求序号。

### 稳定错误和竞态边界

客户端验证非空 session ID，并检查响应的 `deleted` 和 `sessionId`。组件使用删除请求序号、删除 ID和当前选中 ID判断异步结果；删除后到达的旧详情响应被丢弃。错误只显示在历史区域，保留生成简报、追问和确定性候选状态。

## Risks / Trade-offs

- [删除 readback 失败] -> 返回 typed session invalid 错误，前端保留历史项并显示失败状态。
- [删除期间重复操作] -> 单 session 删除锁和确认态按钮禁用，避免重复请求。
- [父组件历史刷新延迟] -> 组件发出 `sessionDeleted`，同时先清理当前详情；自行加载模式立即执行 authoritative list refresh。

## Migration Plan

无需数据库 migration。发布 API 与 Quant client/UI 后，通过 API 集成测试验证用户隔离和删除 readback，再经 Gateway 验证历史列表、确认删除、成功/失败状态及移动端布局。

## Open Questions

无。
