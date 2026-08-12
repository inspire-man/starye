---
status: resolved
trigger: "还是报错 你可以自己访问看看"
created: 2026-08-11
updated: 2026-08-12T01:21:00+08:00
---

# Debug Session: Phase 25 GitHub OAuth 502

## Symptoms

- expected: `http://localhost:8080/auth/start/github?next=/blog/` 应通过 API auth social endpoint 跳转到 GitHub OAuth。
- actual: Auth Nuxt 显示 `502 Bad Gateway`。
- errors: `[POST] "http://localhost:8080/api/auth/sign-in/social": 502 Bad Gateway`，栈定位到 `apps/auth/server/routes/start/github.get.ts:36`。
- timeline: 2026-08-11，登录页 hydration 500 经缓存绕过刷新恢复后继续 GitHub 登录时发现。
- reproduction: 通过 canonical Gateway 打开 `http://localhost:8080/auth/start/github?next=/blog/`。

## Current Focus

- hypothesis: 多组孤立 API Wrangler 仍引用已被 `materialized.cleanup()` 删除的 `.target-wrangler.local-dev-*-dashboard.toml`；它们在后续 reload 时失去配置，因而不再绑定 `8787`，Gateway 继续转发到空端口。
- test: 核对当前存活 API/Gateway 链命令中的每个生成 config 是否存在，并读取隔离启动返回的 Wrangler 日志；追溯 `materialized.cleanup()` 的调用路径，确认删除与 supervisor 生命周期相关。
- expecting: API 链引用的 config 均缺失，日志稳定出现 `Could not read file ... ENOENT`；源码显示 cleanup 只在失败/stop 分支，且当前 supervisor 会在 ready 后退出，导致后续管理/清理时序失配。若 config 实际存在，则回到端口绑定/地址族假设。
- next_action: preserve the verified supervisor fix and resume Phase 25 authenticated proof
- reasoning_checkpoint:
- tdd_checkpoint:

## Evidence

- timestamp: 2026-08-12T00:01:47+08:00
  observation: Debug knowledge base 仅有 `invalid_code`/GitHub 出站网络案例，与本次 `502` + `8787` 无 listener 不满足 2 个关键词重叠；未发现可直接复用的已知模式。
- timestamp: 2026-08-12T00:06:00+08:00
  observation: 运行时进程中存在由 PID `20800` 派生、指向 `apps/api/.target-wrangler.local-dev-68904-dashboard.toml` 的 API 包装链（`cmd 45076 -> node 46104 -> cmd 50540 -> node 42776`），命令明确要求 `--port 8787`；此前端口检查仍无 `8787` listener。另有更早 Gateway Wrangler/workerd 链存活。
- timestamp: 2026-08-12T00:06:00+08:00
  observation: GitNexus 将 `scripts/local-dev.ts:main` 和 `materializeLocalInputs` 识别为 local-dev 相关 symbols，但未返回可用的完整 supervisor execution flow；后续以源码和运行时进程树为主。
- timestamp: 2026-08-12T00:08:30+08:00
  observation: 再次查询时 PID `20800` 已不存在，因此其祖先/后代集合为空；`8080` 仍由 workerd PID `63476`（父 PID `26772`）监听，`8787` 仍无 listener。`3000/3001/3002/3003/5173` 的 listener 也分别归属不同父 PID，运行时不是单一健康 supervisor 所拥有。
- timestamp: 2026-08-12T00:12:00+08:00
  observation: `scripts/local-dev.ts` 的 `main()` 在 `runLocalDevSupervisor()` 返回 `ready` 后仅打印 canonical URL 随即结束；没有等待子进程退出。`stop()` 只遍历 `started` 并调用每个直接 child 的 `child.process.kill()`，没有 Windows 进程树终止。supervisor 结束后 signal handlers、`watchChild` 与 materialized cleanup 均失去宿主。
- timestamp: 2026-08-12T00:12:00+08:00
  observation: 当前进程快照至少出现 `local-dev-26896`、`26576`、`31372`、`66732`、`68904` 等多个历史 API/Gateway config；PID `45076`、`31068`、`46736`、`70180` 的记录明确显示父 PID 已不存在。
- timestamp: 2026-08-12T00:16:00+08:00
  observation: API 分组显示 3 条完整历史链仍存活：`68904` 的 Wrangler CLI PID `2372` + workerd `4812`，`31372` 的 CLI `25004` + workerd `49072`，`26896` 的 CLI `16000` + workerd `6808`。三者只监听 Wrangler/workerd 内部随机端口，没有任何 PID 监听命令声明的外部 `8787`。
- timestamp: 2026-08-12T00:20:00+08:00
  observation: 隔离端口 `8788` 的全新 Wrangler 启动在约 12 秒内退出；stderr 明确为 `Could not read file: ...apps\\api\\.target-wrangler.local-dev-26896-dashboard.toml` 和 `ENOENT`，随后 pnpm 返回 exit code `3221226505`，`8788` 无 listener，health 请求被积极拒绝。

- timestamp: 2026-08-11T23:45:30+08:00
  observation: 浏览器页面为 `502 - Bad Gateway | Nuxt`，服务端调用 `/api/auth/sign-in/social` 在 `github.get.ts:36` 失败。
- timestamp: 2026-08-11T23:47:00+08:00
  observation: 8080、3000、3001、3002、3003、5173 均有 listener；8787 无 listener；`GET http://localhost:8080/api/health` 返回 502。
- timestamp: 2026-08-11T23:48:00+08:00
  observation: 存在多组指向不同 `.target-wrangler.local-dev-*` 配置的 Wrangler API/Gateway 包装进程，但没有 API workerd listener。

## Eliminated

- hypothesis: API 源码/worker bundle 本身在任意新端口都无法启动。
  reason: 隔离实验在加载 worker 前即因生成 config `ENOENT` 退出；失败点是输入文件缺失，不是 API handler 初始化或 OAuth 出站调用。

- hypothesis: PID `20800` 仍是当前 local-dev supervisor，并持续管理 `local-dev-68904` 的 API/Gateway 分支。
  reason: PID `20800` 在后续快照中已不存在，但 8080 与各前端 listener 继续存活，说明这些服务已经脱离该 supervisor 或来自其他历史启动。

- hypothesis: OAuth 502 是前一个 Vue hydration `null.ce` 错误的延续。
  reason: 当前页面仅加载一致的 Vite runtime hash，失败发生于 Auth 服务端向 API 的 POST。

## Resolution

- root_cause: `scripts/local-dev.ts` exits its supervisor immediately after readiness, while Windows cleanup only kills direct pnpm/cmd wrappers. Generated Wrangler configs become unavailable while orphaned Wrangler/workerd descendants remain alive. Gateway workerd on 8080 continues forwarding to API_ORIGIN 8787, but no process owns 8787; replaying the deleted config on 8788 fails before worker load with `Could not read file ... ENOENT`.
- fix: `scripts/local-dev.ts` now exposes and awaits `waitForStop()`, keeps materialized configs alive for the supervisor lifetime, and terminates each managed Windows process tree with `taskkill /T /F` during shutdown.
- verification: all seven local listeners remained present after restart; `GET http://localhost:8080/api/health` returned `200`; browser navigation through `http://localhost:8080/auth/start/github?next=/blog/` reached `http://localhost:8080/blog/` with no console errors or warnings.
- files_changed: `scripts/local-dev.ts`
