## Why

本地开发环境曾同时存在多套 Starye 服务栈，旧 Gateway 与新 Gateway 争用 8080，浏览器随机命中旧路由后把 `/quant/` 转给 Blog，最终落到 `/blog/quant/` 404。当前 Gateway 源码已经定义了 Quant 鉴权分支，但启动器把“任意进程监听端口”误判为本次启动成功，导致同类问题可重复发生。

本变更固定 Quant/Auth 的入口契约，并让本地启动过程在端口已被占用时尽早失败，保证未登录回到认证页、登录回跳回 Quant，且不会静默落入 Blog。

## What Changes

- 为 Gateway 增加 `/quant/` 精确回归覆盖，验证匿名请求保留原始路径和查询参数并跳转到 `/auth/login`。
- 为 Auth OAuth 启动路由增加 Quant 回跳规范化测试，验证同源 `/quant/` 被保留、外部地址被拒绝。
- 本地开发监督器在启动服务前检查固定端口；发现已有监听时直接失败并提示先清理旧服务，不把旧监听误当作新服务就绪。
- 通过单一服务栈重新回归浏览器与 Gateway，确认 `/blog/quant/` 不再是 `/quant/` 的入口结果。

## Capabilities

### New Capabilities

- `quant-auth-routing`: Quant 入口、认证跳转和 OAuth 回跳的路径契约。
- `local-dev-single-stack`: 本地固定端口服务栈的启动前占用检测。

### Modified Capabilities

无。

## Impact

- `apps/gateway/src/index.ts` 的 Quant 路由回归测试。
- `apps/auth/server/routes/start/github.get.ts` 的回跳规范化测试。
- `scripts/local-dev.ts`、`scripts/clean-ports.ps1`、`scripts/check-services.ps1` 与 `packages/config/src/deployment-target/__tests__/local-dev.test.ts`。
- 不改变 API、数据库、生产域名配置或现有登录协议；生产验证仍以 Gateway 入口为准。

## Risks

- 已有服务占用端口时，`pnpm dev` 会明确失败，需要执行 `pnpm dev:clean` 后重启。
- 端口占用检查只针对本仓库固定开发端口，不会终止其他进程。
