---
phase: 11-deployment-target-foundation
reviewed: 2026-07-14T22:26:07+08:00
depth: deep
files_reviewed: 21
files_reviewed_list:
  - packages/config/package.json
  - packages/config/tsconfig.json
  - packages/config/vitest.config.ts
  - packages/config/src/index.ts
  - packages/config/src/deployment-target/index.ts
  - packages/config/src/deployment-target/target-profile.schema.ts
  - packages/config/src/deployment-target/target-profiles.ts
  - packages/config/src/deployment-target/target-resolver.ts
  - packages/config/src/deployment-target/projection-plan.ts
  - packages/config/src/deployment-target/env-file-block.ts
  - packages/config/src/deployment-target/preflight.ts
  - packages/config/src/deployment-target/live-checks.ts
  - scripts/target-profile.ts
  - package.json
  - packages/config/src/deployment-target/__tests__/target-profile.schema.test.ts
  - packages/config/src/deployment-target/__tests__/target-resolver.test.ts
  - packages/config/src/deployment-target/__tests__/projection-plan.test.ts
  - packages/config/src/deployment-target/__tests__/env-file-block.test.ts
  - packages/config/src/deployment-target/__tests__/preflight.test.ts
  - packages/config/src/deployment-target/__tests__/identity-boundary.test.ts
  - packages/config/src/deployment-target/__tests__/live-checks.test.ts
findings:
  critical: 2
  warning: 1
  info: 0
  total: 3
status: issues_found
---

# Phase 11: Code Review Report

**Reviewed:** 2026-07-14T22:26:07+08:00
**Depth:** deep
**Files Reviewed:** 21
**Status:** issues_found

## Summary

已追踪 `TargetProfile -> projection -> preflight -> target-profile CLI -> Wrangler argv` 调用链。显式 target 解析、`spawnSync(..., { shell: false })`、secret 值不进入 profile 和 argv 数组构造都符合预期；但两个关键 fail-closed/preservation 边界没有实现，不能作为后续部署门禁发布。

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Marker 的子串或重复块会静默删除 operator-managed 值

**File:** `packages/config/src/deployment-target/env-file-block.ts:107`

**Issue:** 更新器通过 `indexOf()` 查找首个 marker 子串，只检查是否有一对 marker（107-113），随后把两者之间的全部内容替换（128-132）。它没有要求 marker 独占一行、没有拒绝重复 marker，也没有确认 marker 外的区域确实是受管块。可复现地，将 `# note documents # >>> STARYE TARGET-MANAGED BLOCK >>>` 放在 `BETTER_AUTH_SECRET=...` 之前并在后面放 end marker，`applyTargetManagedEnvBlock()` 不抛错且删除该 secret。重复完整块也不会报错，结果仍残留两个 start marker。这违反 D-08 的“块外逐字保留”，并让 `project-local --write` 存在本地凭据丢失风险。

**Fix:** 以逐行解析替代子串搜索：只接受完全等于 `targetManagedBlockStart` / `targetManagedBlockEnd` 的行，且要求各恰好一次、start 在 end 前；任何重复、嵌套、孤立或带前后文本的 marker 都应在写入前抛出 fail-closed 错误。添加覆盖“marker 出现在普通注释中”“两个完整 marker 块”“嵌套 marker”的回归测试，并断言所有 user-managed 行保持不变。

### CR-02: CLI `preflight` 从不验证投影文件，缺失/错误本地投影仍可成功

**File:** `scripts/target-profile.ts:227`

**Issue:** `runPreflight()` 仅将 CLI flags 和 `process.env` 传入 `runTargetPreflight()`（232-241），没有构建 projection plan、读取任何 `LocalEnvTargetFile`，也没有传入 `projectionIssues`。`validateProjection()` 只会迭代调用者已提供的数组（`packages/config/src/deployment-target/preflight.ts:146`），所以 CLI 永远跳过该门禁。实际可复现：在没有读取或验证任何 `.dev.vars`/`.env` 文件的情况下，`runTargetPreflight({ target: 'starye-org', scope: 'local', command: 'validate', wranglerProfile: 'starye-org' })` 返回 `{ ok: true, issueCodes: [] }`。这违背 11-03 的 D-10（profile、local projection、command input 一起验证）和计划声明的 fail-closed preflight。

**Fix:** 让 CLI preflight 复用 `buildLocalEnvProjectionPlan()`，在受控的 `--env-root`（或明确的 repo root）下读取四个固定文件，并将 `validateProjectedEnv()` 的结果传给 `runTargetPreflight()`。明确 local 与 remote/CI scope 是否都需要该检查；若某 scope 不应读取本地文件，应引入显式的 scope-specific projection input，而不是默默省略。为缺失文件、错误 target marker 和错误 managed value 增加 CLI 集成测试，均应非零退出。

## Warnings

### WR-01: Live-check 失败信息没有可审计的 target/resource 标识

**File:** `packages/config/src/deployment-target/live-checks.ts:60`

**Issue:** D1/R2/KV 的失败输出只包含资源种类（例如 `Read-only d1 resource check failed.`），没有 selected target id 或预期资源 name/id。11-03 计划要求失败检查带 resource category 和 target id；在后续多 target 切换时，日志不能证明失败属于哪个 target，也会降低排障与审计价值。

**Fix:** 在不输出凭据的前提下，把 `resolution.id` 及预期资源标识加入消息，例如 `Target starye-org: read-only d1 check failed for starye-db.`；相应更新 live-check tests，断言 target id/resource 标识存在且 token 值不存在。

## Verification

- `pnpm --filter @starye/config test --run` passed: 7 files, 43 tests.
- `pnpm --filter @starye/config exec tsc --noEmit` passed.
- `pnpm run target-profile -- validate --target starye-org` passed.
- `git diff --check 3530f25^..HEAD -- packages/config scripts/target-profile.ts package.json` passed.
- 额外的 in-memory marker repro 证实：含 marker 子串的普通注释会导致 operator-managed 值被删除，且重复块不会被拒绝。
