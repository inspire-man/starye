## Context

Gateway 的路由实现已经有 Quant 鉴权分支，问题来自本地启动器只探测端口是否监听，不验证监听是否由本次启动产生。多套 `pnpm dev` 并行运行时，旧 Worker 可能与新 Worker 同时接收 8080 请求，旧 Worker 会把未知路径回退给 Blog。

## Design

1. 在 `runLocalDevSupervisor` 物化运行输入后、调用 `startService` 前，复用现有的 `isPortListening` 探针检查所有有端口的服务。
2. 若存在已监听端口，抛出包含服务名和端口的错误；既有统一 `catch` 负责清理已物化输入并返回失败结果。
3. 不主动杀掉占用端口的外部进程；操作员通过 `pnpm dev:clean` 处理明确的旧 Starye 栈后再启动。
4. 将 Quant 的 3004 端口纳入清理和服务健康检查，避免运维脚本遗漏 Quant 导致旧进程残留或健康状态误报。
5. 在 Gateway 路由测试中覆盖 `/quant/` 和带查询参数的匿名请求，在 Auth 测试中覆盖 Quant 回跳与外部目标拒绝。
6. 使用单一服务栈经 `http://localhost:8080` 做真实回归；浏览器只作为最终可见行为证据，命令行响应头和重定向链作为协议证据。

## Trade-offs

- 启动检查会让“复用其他已启动服务”的隐式行为变成显式失败，但这是必要的，因为当前监督器无法证明端口监听属于自己。
- 不实现跨进程 ownership 识别，保持 Node/Windows/Cloudflare Worker 运行环境兼容；本次目标是禁止静默并行启动，而不是管理外部进程。

## Verification

- `pnpm --filter gateway test`
- Auth GitHub start route focused test
- Local-dev focused test
- `pnpm --filter quant-app type-check`
- 通过 Gateway 的匿名 `/quant/` 请求和浏览器导航链路
