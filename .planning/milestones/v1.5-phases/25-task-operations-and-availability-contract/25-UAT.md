---
status: complete
phase: 25-task-operations-and-availability-contract
source:
  - 25-VERIFICATION.md
  - 25-04-SUMMARY.md
started: 2026-08-11T03:00:10+08:00
updated: 2026-08-12T11:15:18+08:00
---

## Current Test

[testing complete]

## Tests

### 1. Canonical Gateway fresh task operations and availability proof
expected: Authenticated Gateway proof passes with a fresh bounded tuple and redacted matrix; no direct development port or sensitive/raw payload appears.
result: pass
source: manual_procedural
coverage_id: D4
reported: "已认证应用内浏览器经 http://localhost:8080/dashboard/crawlers 完成 canonical proof。fresh tuple 56989615-4444-4292-bcb7-d5c145146d58 / 076c7c07-9101-44f0-b57d-1321204ae3d8 / attempt 1 / local-proof 通过；metadata、archive、supersede、cancel、retry 五项 action readback 全部通过，auditCount=8，availability current 与 stale/conflict/duplicate/late history、receipt、cache refresh、Dashboard trace、redaction 和 cleanup 全部通过。"
evidence:
  - ".target-runs/phase25-evidence/phase25-dashboard-56989615-4444-4292-bcb7-d5c145146d58_076c7c07-9101-44f0-b57d-1321204ae3d8_attempt-1.matrix.json"

### 25-05 gap-closure rerun

result: automated_gap_closed_live_checkpoint
reported: "LocalTaskRunner 的 exact duplicate 场景已复用首条 accepted observation 的 event sequence，focused runner/client suite 通过 11/11；crawler/scripts 类型检查、availability repository/integration/route 14/14、Phase 25 proof 8/8 和 pnpm check:services 均通过。重启 supervisor 后，canonical proof 使用三个已有 profile 均在 task creation 前返回 dashboard_gateway_session_missing，因此没有新增 proof task/run。"
severity: blocker
remaining:
  - "需要一个已认证的 Dashboard browser profile 或 CDP session，才能完成 fresh task/run/attempt/local-proof tuple 的 live Gateway readback。"
  - "认证恢复后仍需检查 duplicate/conflict/stale/late history、audit、cache-refresh 和最终 task cleanup。"

### Authenticated browser resume rerun

result: live_checkpoint
reported: "应用内浏览器和用户 Chrome 均经 http://localhost:8080/dashboard/crawlers 显示已认证用户 JX Huang。Dashboard 创建 fresh task 425b5a93-60a8-43a9-a962-79d353f66214 / run 0f78176e-c908-4333-8701-952b8969d543 后停在 queued；已通过 Dashboard 取消，并确认 cancelled。随后 retry 创建 attempt 2 / run 36e98669-28b3-4773-be35-88645c404f0a，普通 provider 边界显示 github-actions，未冒充 local-proof；该 attempt 最终也已通过 Dashboard 取消并确认 cancelled。机器上的 local-dev supervisor 与 local-task-runner 进程均存在。canonical proof 连接旧的 127.0.0.1:45725 CDP 后生成 checkpoint matrix，但 dashboardSession 仍未通过；有效登录态所在浏览器未向该 CLI proof 暴露可消费的 CDP URL。遗留 proof 进程已终止。"
severity: blocker
remaining:
  - "向 canonical proof 提供与当前已认证 Dashboard 相同上下文的 CDP URL，或提供等价的受支持 browser-session adapter。"
  - "使用该上下文生成新的 local-proof task/run/attempt/provider tuple 和 passed redacted matrix。"
  - "确认 fresh tuple 的 duplicate/conflict/stale/late history、receipt、audit、cache-refresh advancement 与最终 cleanup。"

### Authenticated browser adapter proof rerun

result: live_checkpoint
reported: "受支持 browser-session adapter 已绑定应用内浏览器的 JX Huang 登录态，并通过 http://localhost:8080 执行 canonical proof。fresh tuple a457880b-4cc8-46ea-8932-43796d013806 / 150e1929-2219-41cd-ba12-0267da6ae424 / attempt 1 / local-proof 已生成；availability current、duplicate/conflict/stale/late history、receipt、redaction、task list/detail 和 cleanup 均通过。44 个同源操作均返回 200，metadata/cancel/retry/archive/supersede 请求已执行。最终 matrix 在 cache refresh 后返回 cache_refresh_availability_projection_missing：辅助 supersede task 将目标唯一的 authoritative current 转移到新 task，proof 随后仍用原始 task id 读取 current，因此 action/audit/dashboard trace 尚未写入 passed matrix。"
severity: blocker
evidence:
  - ".target-runs/phase25-evidence/phase25-dashboard-a457880b-4cc8-46ea-8932-43796d013806_150e1929-2219-41cd-ba12-0267da6ae424_attempt-1.matrix.json"
  - ".target-runs/phase25-browser-adapter-20260811-185914421.out.log"
remaining:
  - "让 proof 在辅助 supersede 后跟随 authoritative current 的新 task owner，或在会改变 owner 的动作前完成原始 fresh tuple 的 cache-refresh 断言。"
  - "重新生成 outcome: passed 的 redacted matrix，并在矩阵中保留 action readback、auditCount、cacheRefresh 和 dashboardTrace。"

### Final authenticated Gateway proof rerun

result: pass
reported: "proof 在 Dashboard reload 后等待 bounded evidence 区块和 authoritative owner trace 有界收敛。真实 Gateway matrix 返回 outcome: passed；五个 action 均 passed，auditCount=8，cacheRefresh、dashboardTrace、receiptReadback、availabilityCurrent、availabilityHistory、redaction、cleanup 均 passed。"
evidence:
  - ".target-runs/phase25-evidence/phase25-dashboard-56989615-4444-4292-bcb7-d5c145146d58_076c7c07-9101-44f0-b57d-1321204ae3d8_attempt-1.matrix.json"
  - "scripts/phase25-dashboard-gateway-proof.test.ts (14/14 passed)"

## Summary

total: 1
passed: 1
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

- gap_id: G-25-1
  truth: "Authenticated canonical Gateway execution produces a fresh task/run/attempt/provider tuple with authoritative availability current/history, receipt, audit readback, and cache-refresh advancement."
  status: resolved
  reason: "The proof follows the authoritative availability owner after supersede and waits for the reloaded Dashboard evidence sections and owner trace to converge. The authenticated canonical Gateway rerun produced an outcome: passed redacted matrix with all required readbacks."
  severity: blocker
  test: 1
  artifacts:
    - "apps/api/src/routes/admin/crawler-tasks/index.ts:43-107"
    - "apps/api/src/routes/admin/crawler-tasks/index.ts:1334-1374"
    - "packages/crawler/src/task-runner/local-runner.ts:1-104"
    - "apps/api/src/routes/internal/crawler-runs/index.ts:554-639"
    - "scripts/phase25-dashboard-gateway-proof.ts:430-510"
    - "scripts/phase25-dashboard-gateway-proof.ts:505-535"
    - "scripts/phase25-dashboard-gateway-proof.ts:681-705"
    - "apps/api/src/routes/admin/crawler-tasks/index.ts:555-573"
    - "packages/db/src/schema.ts:442-467"
    - ".target-runs/phase25-evidence/phase25-dashboard-a457880b-4cc8-46ea-8932-43796d013806_150e1929-2219-41cd-ba12-0267da6ae424_attempt-1.matrix.json"
    - ".target-runs/phase25-browser-adapter-20260811-185914421.out.log"
    - ".target-runs/phase25-evidence/phase25-dashboard-56989615-4444-4292-bcb7-d5c145146d58_076c7c07-9101-44f0-b57d-1321204ae3d8_attempt-1.matrix.json"
  resolution: "Authoritative-owner continuity uses policy/source identity plus advancing observation/projection facts, while Dashboard trace verification performs a bounded post-reload convergence wait. Focused proof suite passed 14/14 and the live matrix passed."
