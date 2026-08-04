---
phase: 17-local-runner-vertical-slice
plan: 03
subsystem: dashboard-local-runner-handoff
tags: [dashboard, gateway, local-runner, receipts, crud, e2e]
dependency-graph:
  requires: [17-01, 17-02]
  provides: [dashboard-task-panel, validated-receipt-editor-handoff, gateway-local-e2e-proof]
  affects: [phase-18, phase-19]
tech-stack:
  added: []
  patterns: [typed-session-bound-admin-api, visibility-aware-polling, route-owned-receipt-id, sanitized-local-evidence]
key-files:
  created: []
  modified:
    - apps/dashboard/src/lib/api.ts
    - apps/dashboard/src/views/Crawlers.vue
    - apps/dashboard/src/views/__test__/Crawlers.test.ts
    - apps/dashboard/src/views/Movies.vue
    - apps/dashboard/src/views/__test__/Movies.test.ts
    - apps/dashboard/src/views/Comics.vue
    - apps/dashboard/src/views/__test__/Comics.test.ts
    - scripts/local-task-runner.ts
    - scripts/data-chain-surface-observation.ts
    - scripts/local-task-runner.e2e.ts
decisions:
  - "Dashboard 只发送固定 movie/manga 模板，receipt 链接只使用 API 已验证的 primaryContentId。"
  - "真实 crawler 的 receipt_missing 与 ignored fixture 的 validated receipt 分开记录，保持 API receipt 校验合同不变。"
  - "Gateway http://localhost:8080 是本地浏览器验收的唯一 canonical origin；API/Vite 端口只作为 supervisor 依赖。"
metrics:
  duration: resumed-after-plan-03-checkpoint
  completed: 2026-07-31
  tasks: 2
  files: 10
status: complete
requirements-completed: [LOCAL-03, LOCAL-01, LOCAL-02, DATA-01]
---

# Phase 17 Plan 03: Dashboard Task and Receipt Handoff Summary

Dashboard 任务面板、本地 runner 证据和既有 movie/comic 编辑器交接已完成。管理员可从固定模板创建任务、观察安全状态与分页日志、确认取消/重试，并只从 succeeded + API-validated receipt 进入既有内容编辑器。

## Accomplishments

- 扩展 session-bound typed admin API，交付固定 movie/manga task panel、5 秒可见性轮询、取消/重试确认、safe log cursor 与 validated receipt card。
- Movies.vue 与 Comics.vue 复用既有编辑 modal 和更新链路；receipt query 只读取 route-owned primary ID，不创建第二套 editor。两种内容均完成 Gateway 下的可回退修改、读回和恢复。
- 本地 E2E 绑定同一 task/run/template/receipt：真实 movie crawl 以 `failed:receipt_missing` 收口，ignored fixture 证明 validated movie receipt；真实 manga crawl 产生 validated receipt；controlled adapter 证明 `cancelled`。
- 漫画更新请求将可空 `author`、`description`、`region` 归一化为空字符串，避免既有编辑器 PATCH 被 API schema 拒绝。

## Task Commits

1. **Task 1: typed Dashboard API and task panel** — `14d8d96`
2. **Task 2: validated receipt editor handoff and route fix** — `e2ed9fb`, `98cb8ff`
3. **Checkpoint/evidence records** — `77469cd`, `a9f3620`

## Verification

- `pnpm check:services` — Gateway/API/Dashboard and dependent local services healthy; Gateway readiness accepted at `http://localhost:8080`.
- `pnpm --filter dashboard test --run src/views/__test__/Crawlers.test.ts src/views/__test__/Movies.test.ts src/views/__test__/Comics.test.ts` — 3 files, 33 tests passed.
- `pnpm --filter dashboard type-check` — passed.
- `pnpm --filter @starye/crawler type-check` — passed.
- `pnpm --filter @starye/crawler exec eslint ../../scripts/local-task-runner.e2e.ts` — passed.
- `$env:TASK_RUNNER_E2E_CONFIG='D:\my-workspace\starye\.target-runs\phase17-local-e2e\e2e.json'; pnpm local:task-runner:e2e --target local` — exit 0; sanitized evidence written to `.target-runs/phase17-local-e2e/evidence.json`.
- Gateway browser proof — movie and manga receipt deep links opened the existing editors; each reversible title change was saved through Gateway, read back, then restored and re-read. Existing console noise from comic chapter probes and `useI18n` did not break the receipt CRUD chain.

## Evidence Boundary

- `.target-runs/phase17-local-e2e/runner.json`, `session.json`, and `e2e.json` remain ignored local files; callback secrets, cookies, crawler output, source URLs, and headers are excluded from committed evidence.
- The proof is local-only and does not claim GitHub Actions, Worker/Pages, or provider-backed production execution.

## Deviations

### Auto-fixed Issues

**1. Real movie crawl had no API-verifiable aggregate**

- **Observed:** the real movie adapter completed its crawl but the API correctly returned `failed:receipt_missing` because no validated aggregate was available for that run.
- **Fix:** kept the real failure observable and added a separate ignored fixture adapter that supplies one known content ID to the same API validation path.
- **Result:** the evidence proves both real execution behavior and successful validated receipt handoff without weakening the server contract.

**2. Comic edit PATCH rejected nullable metadata**

- **Observed:** existing comic records can return null metadata while the update schema expects strings.
- **Fix:** normalize `author`, `description`, and `region` to empty strings at the existing update boundary.
- **Result:** Gateway save/readback/restore proof passes while the editor remains unchanged.

**Total deviations:** 2 auto-fixed, both bounded to Plan 03 acceptance.

## Self-Check: PASSED

- Plan 03 implementation commits, focused tests, type checks, local E2E evidence, and Gateway CRUD proof are present.
- No production credentials or ignored runner/session files are staged by this plan closeout.
