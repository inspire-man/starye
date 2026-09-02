# API 部署入口

API 的部署、target profile、secret metadata、迁移、回滚和生产验证统一以仓库根目录的 [RUNBOOK.md](../../RUNBOOK.md) 为准。

本文件只保留 API 应用目录内的入口，不记录任何 secret value、账户 ID、资源 ID 或固定生产域名。

部署前至少确认：

1. 使用显式 target profile 完成 local/remote preflight。
2. 迁移遵循 RUNBOOK.md 的 D1 backup、apply 和 smoke 顺序。
3. API 健康检查和浏览器路径从 Gateway canonical entry 验证。
