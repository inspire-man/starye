## 方案

### D1 数据模型

新增 `quant_candidate_ai_session`：

- `id`：nanoid 会话 ID。
- `user_id`：认证用户，外键 cascade。
- `snapshot_id`、`snapshot_generated_at`：会话使用的候选快照身份和时间。
- `from_date`、`to_date`：快照数据范围，可为空以保留现有快照的边界。
- `scope_key`：规范化、排序、去重后的候选代码，以 `|` 连接。
- `candidate_codes_json`：会话范围代码数组。
- `briefing_json`：版本化简报 JSON，可为空以支持先追问的现有页面行为。
- `questions_json`：版本化追问结果数组。
- `provider`、`model`：回答使用的 AI provider 和模型，不保存密钥。
- `created_at`、`updated_at`：会话创建和最近追加时间。

表必须提供 `user_id + created_at` 和 `user_id + snapshot_generated_at` 索引。repository 在成功 readback 后裁剪保留范围；每用户最多 10 个会话，每会话最多保留最新 10 条追问。

### API 与安全边界

所有接口沿用 `/api/quant` 的认证 middleware：

- `GET /candidates/ai-sessions?limit=1..10` 返回 `{ items, limit }`，按 `updatedAt DESC, id DESC` 排序。
- `GET /candidates/ai-sessions/:sessionId` 返回一个完整会话；不存在或不属于当前用户时返回 404。
- `POST /candidates/ai-briefing` 保持原请求体，成功响应在既有简报字段上增加 `sessionId`。
- `POST /candidates/ai-briefing/question` 增加可选 `session_id`。服务端始终重新读取当前用户最新快照和研究事实；带 session 时必须匹配当前快照 ID、范围 key 和候选代码，省略时创建新的问题会话。成功响应在既有追问字段上增加 `sessionId`。

会话列表和详情只通过 user ID 查询。服务端不接受客户端的候选事实、优先级、研究标记、provider 或模型作为持久化依据。持久化前对生成结果和历史 JSON 进行版本、provider、长度、引用范围和字段校验；异常内容返回 typed Quant error。

### Quant UI

候选简报面板显示最近会话的生成快照时间、数据范围、候选数量和“历史”标记。点击“查看历史”只将该会话的持久化简报和追问加载到面板，面板明确显示只读状态；不会覆盖当前候选表、筛选、选中股票、确定性字段或当前快照。

当前范围变化、候选快照刷新、观察池变化时清除活动会话显示和未完成请求；历史列表可重新读取。生成/追问成功后刷新历史列表，但不依赖历史列表刷新来显示本次成功响应。

### 验证

- D1 migration test 检查表字段、外键、索引和跨用户隔离。
- repository/route tests 检查 readback、保留上限、问题追加、快照/范围绑定、列表/详情和损坏 JSON。
- Quant client/component tests 检查 `sessionId`、历史响应解析、历史列表状态、只读恢复和确定性数据不被覆盖。
- 运行受影响 package 的测试、type-check、lint、build、strict OpenSpec、GitNexus staged detection 和 `git diff --check`。
- 通过 `http://localhost:8080/quant/` 验证历史 idle/list/restore 状态，不触发真实 AI 请求；持久化测试使用本地 D1/libsql fixture readback。
