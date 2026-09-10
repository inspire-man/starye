## Context

See `proposal.md`. 当前认证已经由 Better Auth 维护 `user`、`session`、`account` 三张标准表；`account` 是 OAuth 登录身份，不应承载 Quant 业务配置。Quant 的四张用户工作区表与共享 `quant_daily_bar` 在 `0036`-`0040` migration 中建立，API 已集中在 `apps/api/src/routes/quant/index.ts`。

外部方案的可复用结构是：CrewAI 的四类专业分析角色、daily_stock 的 YAML 策略注册/任务状态/历史报告/多 Agent 阶段和工具证据日志。AkShare 官方文档确认其接口返回 DataFrame，且 `stock_zh_a_hist`、`stock_individual_info_em`、`stock_financial_analysis_indicator` 可覆盖日线、身份和财务基础数据。AkShare 运行时属于 Python 生态，不放入 Cloudflare Worker。

## Goals / Non-Goals

**Goals:**

- 让 Quant 工作区和 AI 配置由当前登录用户决定，并通过 D1 约束和 API 查询条件同时落实。
- 保留共享市场事实，避免按用户复制日线数据。
- 建立安全的 AI 密钥存储边界和可演进的设置入口。
- 让普通用户能够经 Gateway/API 进入 Quant，且不触碰 Dashboard 管理员权限。

**Non-Goals:**

- 本轮不运行 LLM、不生成买卖指令、不加入目标价或收益承诺。
- 本轮不把 AkShare、CrewAI 或 Python 依赖加入 Worker；bridge、研究运行历史、策略 YAML 和 SSE Agent 在后续 change 实现。
- 不重建 Better Auth `account` 表，不把 OAuth access token 与 Quant API key 混用。

## Decisions

### 1. 复用 Better Auth user，不新建账户表

所有 Quant 私有行增加 `user_id`，由服务端从已验证 session 注入。请求 body、query 和 path 不参与归属判断。`account` 继续只表示 GitHub 等登录 provider 的关联。

备选方案是新建业务账户表并维护 user 映射；这会重复身份生命周期、增加同步风险，且与现有 `aria2_configs.user_id` 和 crawler requester 模式不一致，因此不采用。

### 2. 迁移保留历史数据但按最早用户归属

`0041_quant_user_scope.sql` 为四张工作区表增加可迁移的 `user_id`，把已有行归属到 `user` 中最早创建的用户，重建用户+股票唯一索引；没有可归属用户的 legacy 行保持隐藏。新用户首次读取时通过幂等 starter seed 获得自己的起始观察池。

共享 `quant_daily_bar` 不增加 `user_id`。同步 lease 的状态 id 使用 `daily:<userId>`，避免用户之间互相阻塞。

### 3. Worker 内 AES-GCM，bridge 外置

AI key 使用 `crypto.subtle.digest` 从 `QUANT_AI_ENCRYPTION_KEY` 派生 256-bit AES-GCM key，随机 96-bit IV，存储 `v1:<iv>:<ciphertext>`。API 只返回 `hasApiKey` 与尾部提示；未来研究运行服务需要 key 时仅在 Worker 内解密并向受保护的 LLM/bridge 发起请求。

备选方案是沿用 Aria2 的 XOR 混淆；其安全性不足，不作为新配置的实现。另一个方案是把 key 放在客户端 localStorage；这会让每次研究都依赖前端传密钥，也不满足用户级持久配置边界。

### 4. Gateway 分离 Quant 与 Dashboard 鉴权

新增 Quant session guard，仅验证 `/api/auth/get-session` 是否存在用户；Dashboard 继续使用 `checkDashboardAuth` 的管理员白名单。这样普通用户可以使用自己的 Quant 工作区，而运管后台仍保持原权限模型。

### 5. 首个研究能力采用事实优先

本轮只做身份、配置和存储边界。后续研究运行应复用现有因子/估值/财务 provider，新增结构化 `evidence[]`、来源时间、计算版本和阶段状态，再由 AI 做摘要；外部 Agent 的自然语言结论不能替代原始字段和公式。

## Risks / Trade-offs

- [历史行归属不确定] → migration 按最早用户归属，并以 D1 readback 验证；未归属行不进入任何用户查询。
- [加密 Secret 缺失] → 允许读取非敏感元数据，带 key 保存返回配置错误；不降级为明文。
- [Gateway 每次 Quant 文档/资源请求都需检查 session] → 使用轻量 session guard；Quant API 仍由 API 自身再次校验，形成独立边界。
- [AkShare 上游限流和字段变动] → 后续 bridge 统一超时、错误分类、字段标准化和 `source` 记录，先不把上游字段直接暴露给前端。

## Migration Plan

1. 部署 `0041_quant_user_scope.sql`，先在本地 D1 应用并检查列、索引、归属和 legacy 行。
2. 发布 API/Gateway/Quant 前端；先验证普通用户、管理员、匿名三种会话。
3. 配置 Worker Secret `QUANT_AI_ENCRYPTION_KEY` 后再允许用户保存 API key；旧 Aria2 配置不迁移。
4. 回滚代码时保留新增列和表数据；若需回滚 migration，按 `RUNBOOK.md` 做备份后执行人工 SQL，不在应用中自动删除用户数据。
