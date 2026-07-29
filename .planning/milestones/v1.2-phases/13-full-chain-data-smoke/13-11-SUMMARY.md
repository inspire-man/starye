---
phase: 13-full-chain-data-smoke
plan: "11"
subsystem: data-chain-smoke
tags: [target-profile, preflight, evidence, diagnostics, vitest]

requires:
  - phase: 13-10
    provides: standalone-versus-runner local preflight mismatch and immutable checkpoint diagnosis
provides:
  - one exported sanitized runtime-environment owner shared by both local preflight callers
  - closed projection-mismatch and local-api-token-shadowing checkpoint codes
  - exact checkpoint observability in JSON, Markdown, and verifier machine output
affects: [13-12, phase-13-verification, data-chain-smoke]

tech-stack:
  added: []
  patterns: [caller-side environment sanitation, closed diagnostic vocabulary, artifact-derived verifier output]

key-files:
  created:
    - .planning/phases/13-full-chain-data-smoke/13-11-SUMMARY.md
  modified:
    - scripts/target-profile.ts
    - scripts/data-chain-smoke.ts
    - scripts/verify-data-chain-smoke.ts
    - packages/config/src/deployment-target/data-chain-evidence.ts
    - packages/config/src/deployment-target/__tests__/preflight.test.ts
    - packages/config/src/deployment-target/__tests__/data-chain-evidence.test.ts
    - packages/config/src/deployment-target/__tests__/data-chain-smoke-local.test.ts
    - packages/config/src/deployment-target/__tests__/verify-data-chain-smoke.test.ts

key-decisions:
  - "Reuse the existing pickRuntimeEnvironment owner for both local callers; keep remote mode unsanitized and authorized."
  - "Preserve direct runTargetPreflight token-shadowing rejection; sanitation belongs only at the caller boundary."
  - "Persist only two exact preflight codes through the existing checkpoint field; messages and values remain unrepresentable."
  - "Accept the reviewed GitNexus HIGH staged reports only for the exact owned diffs and known runner/evidence flows."

patterns-established:
  - "Local caller parity: both CLI and smoke runner sanitize an explicit source environment before runTargetPreflight."
  - "Diagnostic persistence: select the first allowlisted issue code in deterministic order, otherwise retain target_projection_unmet."

requirements-completed: [DATA-01, DATA-07, TEST-05]

coverage:
  - id: D1
    description: Target-profile CLI and the default local smoke runner share one sanitized runtime environment contract while direct raw-token rejection remains fail closed.
    requirement: DATA-01
    verification:
      - kind: integration
        ref: pnpm target-profile preflight --target starye-org --scope local --command validate --wrangler-profile starye-org
        status: pass
      - kind: unit
        ref: preflight.test.ts + identity-boundary.test.ts + data-chain-smoke-local.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: Projection mismatch and local token shadowing are exact closed checkpoint values in validated JSON and deterministic Markdown.
    requirement: DATA-07
    verification:
      - kind: unit
        ref: data-chain-evidence.test.ts#closed preflight diagnostic checkpoint round trips
        status: pass
    human_judgment: false
  - id: D3
    description: The runner preserves exact allowlisted diagnostics and the exact verifier emits only the persisted checkpoint code.
    requirement: TEST-05
    verification:
      - kind: integration
        ref: six-file Phase 13 config regression suite (77/77)
        status: pass
      - kind: other
        ref: pnpm --filter @starye/config type-check
        status: pass
    human_judgment: false

duration: 20min
completed: 2026-07-19
status: complete
---

# Phase 13 Plan 11: Local Preflight Diagnostic Repair Summary

**CLI 与 smoke runner 现在共用同一 caller-side 环境清洗边界，并以封闭 checkpoint code 精确区分 projection drift 与本地 token shadowing。**

## Performance

- **Duration:** 20 min
- **Started:** 2026-07-18T20:27:24Z
- **Completed:** 2026-07-18T20:48:06Z
- **Tasks:** 3/3
- **Files modified:** 8

## Accomplishments

- 导出并参数化既有 `pickRuntimeEnvironment`，CLI local preflight 与 local smoke runner 都只把平台运行键及可选 selected account id 交给 `runTargetPreflight`。
- 保留 direct raw input 的 `local-api-token-shadowing` fail-closed policy，同时让 ambient remote token 不再造成 standalone-green/runner-red 分歧。
- 将 `projection-mismatch` 与 `local-api-token-shadowing` 加入既有封闭 checkpoint union，并贯通 JSON、Markdown 与 exact verifier machine output。
- generic resolver/reader/非 allowlisted failure 仍使用 `target_projection_unmet`；remote runner、one-item tuple、provider、browser、Gateway、receipt 与 provenance contract 均未改变。

## Task Commits

1. **Task 1 RED: local caller parity regressions** - `e013cfc` (`test`)
2. **Task 1 GREEN: shared environment sanitation** - `8e43f20` (`fix`)
3. **Task 2 RED: checkpoint diagnostic round trips** - `d7b0c8c` (`test`)
4. **Task 2 GREEN: closed checkpoint vocabulary** - `58b8963` (`feat`)
5. **Task 3 RED: runner/verifier diagnostic observability** - `d1536f9` (`test`)
6. **Task 3 GREEN: persisted diagnostic mapping** - `4e5f305` (`fix`)

## Files Created/Modified

- `scripts/target-profile.ts` - 导出可注入 source 的 runtime allowlist owner，并保留 Pages build 默认行为。
- `scripts/data-chain-smoke.ts` - local mode 清洗 injected/ambient environment，并只映射两个 allowlisted preflight code。
- `scripts/verify-data-chain-smoke.ts` - 从已验证 artifact 可选输出 persisted checkpoint code。
- `packages/config/src/deployment-target/data-chain-evidence.ts` - 为派生 checkpoint union 增加两个精确字符串。
- `packages/config/src/deployment-target/__tests__/preflight.test.ts` - 覆盖 ambient token CLI parity 与环境恢复。
- `packages/config/src/deployment-target/__tests__/data-chain-evidence.test.ts` - 覆盖 typed JSON/Markdown round trip 与 closed vocabulary。
- `packages/config/src/deployment-target/__tests__/data-chain-smoke-local.test.ts` - 覆盖 default wiring、allowlisted mapping、generic fallback 和无 message 泄露。
- `packages/config/src/deployment-target/__tests__/verify-data-chain-smoke.test.ts` - 覆盖 checkpoint machine output 与 terminal/pending omission。

## Verification

- `pnpm --filter @starye/config exec vitest run ...`（计划列出的 6 个文件）: **6 files, 77/77 passed**。
- `pnpm --filter @starye/config type-check`: **passed**。
- `git diff --check`（计划列出的 8 个 owned paths）: **passed**。
- `pnpm target-profile project-local --target starye-org --check`: **passed**。
- `pnpm target-profile validate --target starye-org`: **passed**。
- `pnpm target-profile preflight --target starye-org --scope local --command validate --wrangler-profile starye-org`: **passed**。
- Direct `runTargetPreflight` raw-token regression: **仍返回 `local-api-token-shadowing`**。

## GitNexus Review

- Task 1 pre-edit impacts: `pickRuntimeEnvironment`, `runPreflight`, `runDataChainSmoke` 均为 LOW。
- Task 2 pre-edit warning: `validateDataChainEvidence` 为 HIGH，2 个直接消费者、20 个 impacted symbols、3 条流程：`runDataChainSmoke`、`observeDataChainSurfaces`、`appendBrowserObservation`。本计划未修改 validator、clone、renderer 或 append body。
- Task 1 staged detect 为 HIGH，实质 diff 仅两个 owned source；root 在 33/33 targeted tests 后确认 10 条映射流程属于预期/相邻 hunk 范围。
- Task 2 staged detect 为 LOW，仅 `dataChainCheckpointValues`，0 affected processes。
- Task 3 staged detect 为 HIGH，9 条均为既有 `runDataChainSmoke` evidence/tuple flows；root 在 77/77、type-check 与 diff-check 后确认精确两文件提交。
- 所有提交均使用 exact pathspec；未提交 STATE 的既有执行态修改或任何 evidence 文件。

## Decisions Made

- Caller sanitation 与 policy validation 保持分层：caller 过滤 ambient remote credential，`runTargetPreflight` 继续拒绝直接 raw token。
- Verifier 不重新解释 preflight；它只转发已通过 evidence schema 的 checkpoint code。
- 当多个 issue 存在时按 `issues` 原顺序选择第一个 allowlisted diagnostic；无 allowlisted code 时 fail closed 到 generic checkpoint。

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- GitNexus staged hunk mapping把相邻 local variables/functions 标为 touched，并把已知 runner call graph 汇总为 HIGH。每次都在提交前暂停、披露、由 root 确认，并用 exact diff、focused/full tests 与 exact pathspec 约束实质范围。
- `DataChainCheckpoint` type alias 未被当前 GitNexus index 单独解析；其唯一 owner `dataChainCheckpointValues` 的 staged detect 为 LOW。

## Authentication Gates

None. 本计划没有 provider、browser 或 live smoke 操作。

## Known Stubs

None.

## Security And Scope

- 未新增 free-form diagnostic field、secret/message/value/env dump、endpoint、cookie、header 或 prepared context 输出。
- 未运行 provider、browser、Wrangler live、D1 mutation、deploy、permission、schema、migration、cleanup、rollback 或 schema-push 命令。
- 未创建 run id，未写入、暂存或提交 Plans 13-09/13-10 或 Attempts A-E evidence。
- 未新增 package、dependency、schema、migration、CLI flag 或 `any` shortcut。

## TDD Gate Compliance

| Task | RED | GREEN | Result |
|---|---|---|---|
| 1 | `e013cfc` | `8e43f20` | Pass |
| 2 | `d7b0c8c` | `58b8963` | Pass |
| 3 | `d1536f9` | `4e5f305` | Pass |

## User Setup Required

None. 本计划只修复代码契约并执行 read-only local validation。

## Next Phase Readiness

- Plan 13-11 已完成；Phase 13 仍保持 open/in-progress，不能标记完成。
- Plan 13-12 现在可以在重新通过 official projection/local preflight 后分配全新的 collision-gated `p13-12-*` run。
- 任何 Plan 13-12 checkpoint 仍必须保留为 non-success，且 prior evidence 继续不可变。

## Self-Check: PASSED

- 8 个 owned source/test paths 均存在，且 `9ae0567..4e5f305` 的 committed diff 只包含这 8 个路径。
- 6 个 RED/GREEN commit 均出现在当前历史；无 tracked file deletion。
- 最终 77/77 tests、config type-check、official projection/validate/local preflight 与 exact diff-check 全部通过。
- 工作树仅保留进入执行前已有的 STATE 执行态修改与 immutable untracked p13-10 evidence；本计划未夹带两者。

---
*Phase: 13-full-chain-data-smoke*
*Plan: 11*
*Completed: 2026-07-19*
