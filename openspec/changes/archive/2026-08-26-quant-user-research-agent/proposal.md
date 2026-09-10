## Why

当前 Quant 已有观察池、研究标记、扫描快照和价值质量计算，但这些数据仍以全局表保存，普通登录用户也被 API/Gateway 的管理员边界挡在工作台之外。外部项目已经验证了“策略筛选 + 技术/财务/情绪证据 + Agent 综合研究”的产品方向；要把这类能力融入 Starye，必须先让研究工作区和 AI 凭据真正归属于当前登录用户。

## What Changes

- 将 Quant 观察池、研究标记、扫描快照和同步状态按 Better Auth 的 `user.id` 隔离；日线行情事实表继续按股票代码共享。
- 保留现有 `user`、`session`、`account` 账户模型，不新建第二套账户表；新增独立的 Quant 用户级 AI 配置表。
- 允许普通登录用户访问 Quant，并让 Gateway 对 Quant 使用“已登录”而不是“管理员”前置鉴权；Dashboard 原有管理员边界保持不变。
- 新增用户级 AI 配置读写接口和 Quant 设置抽屉；API 只返回配置元数据、密钥存在状态和尾部提示，不返回明文密钥。
- 用 Worker Web Crypto AES-GCM 加密保存用户 API key；加密主密钥由 `QUANT_AI_ENCRYPTION_KEY` Secret 提供。
- 记录 AkShare/多 Agent 方案的适配边界，为后续独立 Python 数据 bridge、策略注册、研究运行历史和 SSE Agent 任务提供契约基础。

## Capabilities

### New Capabilities

- `quant-user-workspace`: Quant 业务数据按当前登录用户隔离，并提供用户首次进入时的幂等起始观察池。
- `quant-ai-config`: 用户级 AI provider/model/base URL/API key 配置及加密存储边界。
- `quant-authenticated-entry`: 普通登录用户的 Quant Gateway/API 入口与原始路径保持一致。

### Modified Capabilities

- 无。

## Impact

- `packages/db` schema、D1 migration 和 migration tests。
- `apps/api` Quant repository/sync/routes、认证 middleware、AI config domain/schema。
- `apps/gateway` Quant 前置鉴权与路由测试。
- `apps/quant-app` API client、类型、header 设置入口和 AI 配置抽屉。
- 不在本轮新增 Python 运行时、第三方 AI SDK 或 AkShare 依赖；AkShare bridge、研究报告持久化、回测和 SSE Agent 是后续 change。

## Risks

- 历史 Quant 全局行需要迁移到已有用户；迁移将其归属到最早创建的用户，未能归属的 legacy 行由业务查询隐藏。
- `QUANT_AI_ENCRYPTION_KEY` 缺失时，配置元数据可读取，但带 API key 的保存会明确失败，避免落盘明文。
- 普通用户进入 Quant 后不再共享其他用户的观察池；现有管理员看到的历史数据取决于迁移后的用户归属。
