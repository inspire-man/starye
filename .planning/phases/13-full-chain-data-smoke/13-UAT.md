---
status: complete
phase: 13-full-chain-data-smoke
source: 13-01-SUMMARY.md, 13-02-SUMMARY.md, 13-03-SUMMARY.md, 13-04-SUMMARY.md, 13-05-SUMMARY.md, 13-06-SUMMARY.md, 13-07-SUMMARY.md, 13-08-SUMMARY.md, 13-09-SUMMARY.md, 13-10-SUMMARY.md, 13-11-SUMMARY.md, 13-12-SUMMARY.md, 13-13-SUMMARY.md, 13-14-SUMMARY.md, 13-15-SUMMARY.md, 13-16-SUMMARY.md, 13-17-SUMMARY.md, 13-18-SUMMARY.md, 13-21-SUMMARY.md, 13-22-SUMMARY.md, 13-23-SUMMARY.md, 13-24-SUMMARY.md, 13-25-SUMMARY.md, 13-26-SUMMARY.md, 13-27-SUMMARY.md, 13-28-SUMMARY.md, 13-29-SUMMARY.md
started: 2026-07-22T10:48:23+08:00
updated: 2026-07-23T11:30:38+08:00
---

## Current Test

[testing complete]
## Tests

### 1. 本地 Dashboard 到 Viewer 数据链
expected: 启动根目录 pnpm dev 并使用现有本地认证后，http://localhost:8080/dashboard/movies 显示 p13-smoke-starye-org-491316fa 已完成；随后 http://localhost:8080/movie/p13-smoke-starye-org-491316fa 显示同一条目，且全程使用 Gateway 的 8080 入口。
result: pass

### 2. 选定生产目标的数据链
expected: 选定生产目标的 D1、canonical API、Dashboard 和 Viewer 对同一个远端 tuple 给出一致的已管理条目状态。
result: pass

### 3. Attempt D 的远端 checkpoint 边界
expected: p13-08 远端证据明确显示在 provider mutation 前因 target_preflight_unmet 停止，且没有被表述为生产外部链成功。
result: pass

### 4. p13-09 本地 projection checkpoint 边界
expected: p13-09 的 immutable local evidence 明确显示 local_projection/target_projection_unmet，且没有被作为本地或远端链成功使用。
result: pass

### 5. p13-10 本地 projection checkpoint 边界
expected: p13-10 的 immutable local evidence 明确显示 local_projection/target_projection_unmet，且没有被作为本地或生产链成功使用。
result: pass
recorded: 2026-07-22T17:44:11+08:00

### 6. p13-12 Gateway auth checkpoint 边界
expected: p13-12 的 immutable local evidence 明确显示 gateway_auth_unavailable、itemId 为 null，且没有触发 IAB 或远端动作。
result: pass
recorded: 2026-07-22T18:00:48+08:00

### 7. 只读授权捕获的关闭行为
expected: 当不存在唯一 current-workspace supervisor 时，只读授权捕获在任何 mutation 之前关闭，不产生 PID 审批或生命周期动作。
result: pass
recorded: 2026-07-23T11:28:35+08:00

### 8. 当前 run 的远端 checkpoint 边界
expected: p13-17 的 remote evidence 保持 target_preflight_unmet、itemId 为 null、runnerInvocations 为 0；没有生产 Dashboard 或 Viewer 观察，也没有 Phase 13 完成声明。
result: pass
recorded: 2026-07-23T11:30:38+08:00

### 9. 自动证据: 本地 target projection
expected: Selected local target-managed projection is validated before smoke work.
result: pass
source: automated
coverage_id: 13-01:D1

### 10. 自动证据: 单项身份与 evidence contract
expected: Deterministic one-item identity and non-secret three-state evidence contract are importable and regression tested.
result: pass
source: automated
coverage_id: 13-01:D2

### 11. 自动证据: Gateway browser evidence grammar
expected: Evidence serialization and Gateway-only ordered browser observation grammar reject unsafe input and preserve non-success checkpoints.
result: pass
source: automated
coverage_id: 13-01:D3

### 12. 自动证据: remote runner local evidence gate
expected: Remote runner rejects missing, pending, incomplete, and stale local evidence before provider preflight or prepared children.
result: pass
source: automated
coverage_id: 13-04:D1

### 13. 自动证据: one-item evidence identity
expected: One-item target/run evidence identity and D1 cardinality validation.
result: pass
source: automated
coverage_id: 13-05:D1

### 14. 自动证据: deterministic fixture
expected: One deterministic non-R18 fixture and one service-auth upsert.
result: pass
source: automated
coverage_id: 13-05:D2

### 15. 自动证据: provenance checkpoint map
expected: Wave 4 through Wave 7 validation map for provenance and truthful checkpoints.
result: pass
source: automated
coverage_id: 13-05:D3

### 16. 自动证据: prepared fixture and D1 boundary
expected: Prepared fixture and read-only D1 boundaries accept only one matching primary-code observation.
result: pass
source: automated
coverage_id: 13-06:D1

### 17. 自动证据: runner tuple validation
expected: Local and remote runners checkpoint count, code, and id mismatches before API evidence.
result: pass
source: automated
coverage_id: 13-06:D2

### 18. 自动证据: provenance receipt validation
expected: Terminal local and remote evidence accepts only complete allowlisted provenance receipts for the exact one-item tuple.
result: pass
source: automated
coverage_id: 13-07:D1

### 19. 自动证据: ordered browser observer
expected: Local and remote runners capture execution provenance while the controlled browser observer verifies Dashboard then viewer after SPA tuple settlement.
result: pass
source: automated
coverage_id: 13-07:D2

### 20. 自动证据: persisted verifier
expected: The verifier validates persisted provenance-aware artifacts without overwriting them by rerunning the smoke workflow.
result: pass
source: automated
coverage_id: 13-07:D3

### 21. 自动证据: Attempt D local tuple
expected: Attempt D proves one exact local tuple through local D1, canonical Gateway API, authorized Dashboard, and Gateway viewer with ordered provenance receipts.
result: pass
source: automated
coverage_id: 13-08:D1

### 22. 自动证据: selected target live preflight
expected: The exact official selected-target live preflight exited 0 with all mapped read-only checks green.
result: pass
source: automated
coverage_id: 13-09:D1

### 23. 自动证据: local projection readiness
expected: The official selected-target local projection and readiness boundary passed before run allocation.
result: pass
source: automated
coverage_id: 13-10:D1

### 24. 自动证据: sanitized runner environment
expected: Target-profile CLI and the default local smoke runner share one sanitized runtime environment contract while direct raw-token rejection remains fail closed.
result: pass
source: automated
coverage_id: 13-11:D1

### 25. 自动证据: exact projection checkpoints
expected: Projection mismatch and local token shadowing are exact closed checkpoint values in validated JSON and deterministic Markdown.
result: pass
source: automated
coverage_id: 13-11:D2

### 26. 自动证据: exact verifier diagnostics
expected: The runner preserves exact allowlisted diagnostics and the exact verifier emits only the persisted checkpoint code.
result: pass
source: automated
coverage_id: 13-11:D3

### 27. 自动证据: pre-allocation local gates
expected: Official projection, target validation, local preflight, and the six-file Plan 13-11 regression suite passed before run allocation.
result: pass
source: automated
coverage_id: 13-12:D1

### 28. 自动证据: canonical Gateway readiness
expected: Bounded canonical Gateway readiness rejects a no-header listener and validates robots/auth/auth-slash routes.
result: pass
source: automated
coverage_id: 13-13:D1

### 29. 自动证据: service machine record gate
expected: Local runner fail-closes on a missing, duplicate, malformed, unhealthy, or incompatible service machine record.
result: pass
source: automated
coverage_id: 13-13:D2

### 30. 自动证据: narrow TypeScript project
expected: Readiness and runner root scripts type-check through the Phase 13 narrow TypeScript project.
result: pass
source: automated
coverage_id: 13-13:D3

### 31. 自动证据: handoff input and reservation gate
expected: Handoff parser/core rejects invalid input before dependencies, freezes an exact path bundle, protects pair/reservation states, and keeps remote preflight checkpoints closed.
result: pass
source: automated
coverage_id: 13-14:D1

### 32. 自动证据: root script status preservation
expected: Real root pnpm script names preserve raw run/verify statuses and binary handoff status through a test-only process hook.
result: pass
source: automated
coverage_id: 13-14:D2

### 33. 自动证据: handoff narrow typecheck
expected: Handoff, runner, and verifier root imports type-check through the dedicated narrow project without external execution.
result: pass
source: automated
coverage_id: 13-14:D3

### 34. 自动证据: fixed-port ownership gate
expected: Fixed-port ownership gate stopped before any runtime mutation when the listener set was incomplete.
result: pass
source: automated
coverage_id: 13-16:D1

## Summary

total: 34
passed: 34
issues: 0
skipped: 0
pending: 0
completed: 2026-07-23T11:30:38+08:00

## Gaps

[none yet]
