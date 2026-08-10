---
phase: 20-source-contract-receipt-boundary-and-sun-064
plan: 01
subsystem: api-database-testing
tags: [typescript, vitest, drizzle, d1, source-readiness, crawler-receipt]

# Dependency graph
requires:
  - phase: v1.3
    provides: "已有 crawler task/run/attempt/lease/receipt 控制面和 canonical movie identity"
provides:
  - "server-owned source eligibility、bounded disposition/reason 和 readiness projection"
  - "movie_source_state current projection 与 crawler receipt version boundary"
  - "metadata、source readiness、receipt、playback proof 独立建模及回归测试"
affects: [20-02, 20-03, source-sync, movie-detail, player, production-proof]

# Tech tracking
tech-stack:
  added: []
  patterns: ["纯函数 readiness projection", "D1 current projection keyed by movie.id", "versioned receipt columns with legacy JSON audit"]

key-files:
  created:
    - apps/api/src/domain/movies/source-contract.ts
    - apps/api/src/domain/movies/__tests__/source-contract.test.ts
    - packages/db/drizzle/0029_source_contract_receipt_boundary.sql
  modified:
    - apps/api/src/domain/crawler-tasks/types.ts
    - packages/db/src/schema.ts
    - packages/db/drizzle/meta/_journal.json

key-decisions:
  - "eligibility 只接受 server-owned isActive=true 且 trim 后 sourceUrl 非空的 candidate；rating、排序、HTTP/page load 和数组长度不参与 ready 判定"
  - "ValidatedCrawlerRunReceipt 的 source summary 与 schema version 采用可选字段，兼容既有 receipt-validation 和历史 JSON 读回"
  - "movie_source_state 以 movie.id 为唯一主键/外键；crawler_run 保留 receipt_summary_json，不改写 task/run/attempt/lease 所有权"
  - "ready 不推导 playback_verified；必须有 playing=true 且 currentTime>0 的独立浏览器 evidence"

patterns-established:
  - "bounded reason code only: source contract 输出有限枚举，不传播 raw exception"
  - "metadata.persisted、source disposition、receipt persisted 和 playback status 分层读取"

requirements-completed: [SRC-01, SRC-03]

coverage:
  - id: D1
    description: "source eligibility、no_source/source_failed/repairing 和 playback proof contract"
    requirement: SRC-01
    verification:
      - kind: unit
        ref: "apps/api/src/domain/movies/__tests__/source-contract.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "movie_source_state current projection、receipt version/source identity columns 和 D1 migration"
    requirement: SRC-03
    verification:
      - kind: other
        ref: "pnpm --filter @starye/db type-check"
        status: pass
      - kind: other
        ref: "0029 SQL/path/destructive-statement inspection"
        status: pass
    human_judgment: false
  - id: D3
    description: "API contract 与 DB schema 字段/enum/identity 对齐"
    requirement: SRC-03
    verification:
      - kind: unit
        ref: "pnpm --filter api exec vitest run src/domain/movies/__tests__/source-contract.test.ts"
        status: pass
      - kind: other
        ref: "pnpm --filter api type-check"
        status: pass
    human_judgment: false

# Metrics
duration: 16min
completed: 2026-08-05
status: complete
---

# Phase 20 Plan 01: Source Contract、Receipt Boundary And SUN-064 Summary

**以 canonical movie.id 为边界建立 source readiness projection，保留 receipt 历史审计，并让 browser playback proof 独立于 ready 状态。**

## Performance

- **Duration:** 16 min（从 RED commit 到完成）
- **Started:** 2026-08-05T14:34:59+08:00
- **Completed:** 2026-08-05T14:50:28+08:00
- **Tasks:** 3
- **Files modified:** 6（不含本 Summary）

## Accomplishments

- 新增 source contract：`ready`、`no_source`、`source_failed`、`repairing`，有限 reason code，`players=0`/inactive/blank sourceUrl 的 repairable no-source 语义。
- 新增 `movie_source_state` current projection，增加 receipt schema version、canonical primary content id 和 source revision 列，保留 `receipt_summary_json` 与旧 aggregate counter 语义。
- 增加 8 个纯函数/schema-facing 回归断言，覆盖 metadata persisted、source readiness、receipt persisted 和独立 playback evidence 的状态隔离。

## Task Commits

Each task was committed atomically:

1. **Task 1: 定义 source eligibility、disposition 和三层 readiness contract** - `977b066`（RED test）→ `8765c8d`（GREEN implementation）
2. **Task 2: 建立 movie_source_state 与 crawler receipt version 的 D1 schema 边界** - `6f4f4d1`
3. **Task 3: 校验 contract 与 schema 的字段/enum 一致性** - `3af92e2`

## Files Created/Modified

- `apps/api/src/domain/movies/source-contract.ts` - eligibility、bounded reason、source/readiness/playback/receipt projection 纯函数与类型。
- `apps/api/src/domain/crawler-tasks/types.ts` - versioned validated receipt 的兼容性 source summary 边界。
- `apps/api/src/domain/movies/__tests__/source-contract.test.ts` - source contract 与 schema-facing 回归测试。
- `packages/db/src/schema.ts` - `movieSourceStates`、movie one-to-one relation 和 crawler receipt columns。
- `packages/db/drizzle/0029_source_contract_receipt_boundary.sql` - current projection、receipt version/identity/source revision migration。
- `packages/db/drizzle/meta/_journal.json` - 记录 `0029_source_contract_receipt_boundary` migration entry。

## Decisions Made

- readiness 只由 server-owned post-readback candidate facts 推导；runner count、rating、sort order、HTTP status 和 page load 不具备 authoritative 资格。
- receipt、metadata persistence、source readiness、playback proof 互不自动升级；`ready` 仍是 `unverified` playback。
- movie source current projection 与既有 movie identity 一对一绑定，旧 crawler 控制面 ownership 和历史 receipt JSON 保持原状。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] 处理 Drizzle generate 的历史 journal/schema conflict**
- **Found during:** Task 2（D1 schema 边界）
- **Issue:** 计划命令 `pnpm --filter=@starye/db run generate` 在非 TTY 中遇到既有 journal 与 0026-0028 文件漂移，Drizzle Kit 触发 schema conflict 交互提示；显式 CLI 参数也复现该提示。
- **Fix:** 保留 schema 变更，按 Drizzle 生成语义创建等价的 `0029_source_contract_receipt_boundary.sql`，并更新计划声明的 journal entry；SQL 只包含 ADD COLUMN、CREATE TABLE、CREATE INDEX。
- **Files modified:** `packages/db/src/schema.ts`, `packages/db/drizzle/0029_source_contract_receipt_boundary.sql`, `packages/db/drizzle/meta/_journal.json`
- **Verification:** DB type-check 通过；SQL/path 检查确认 projection、receipt columns、movie FK 存在且 destructive pattern 为 false。
- **Committed in:** `6f4f4d1`

---

**Total deviations:** 1 auto-fixed（Rule 3 blocking）
**Impact on plan:** schema、SQL 和 typed contract 均完成；原生 Drizzle generate 命令仍标记为未验证。

## Issues Encountered

- `pnpm --filter=@starye/db run generate`：未验证。Drizzle Kit 在无 TTY 环境因 schema conflict 需要交互确认，命令未产出 migration。
- `pnpm exec wrangler d1 migrations apply starye-db --local`：未验证。当前 `apps/api/wrangler.toml` 未设置 `migrations_dir`，Wrangler 查找 `apps/api/migrations` 并退出；本计划未改该配置，也未执行远程 apply。
- 已验证命令：focused Vitest 8/8 通过；`pnpm --filter api type-check` 通过；`pnpm --filter @starye/db type-check` 通过；migration path/SQL/FK/non-destructive inspection 通过。

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 02 可直接消费 `deriveSourceReadiness`、`ReadinessProjection`、`movie_source_state` 和 versioned receipt columns。
- 生产 source repair、remote D1 apply、Dashboard/MovieDetail/Player 消费和 browser playback proof 均未在本计划中声称完成。
- `STATE.md`、`ROADMAP.md` 和用户已有 `AGENTS.md`、`CLAUDE.md`、`.planning/config.json` 改动保持原样，由上层 orchestrator 做最终 tracking。

---
*Phase: 20-source-contract-receipt-boundary-and-sun-064*
*Plan: 20-01*
*Completed: 2026-08-05*

## Self-Check: PASSED

- Summary and all six planned implementation/migration files exist.
- Task commits `977b066`, `8765c8d`, `6f4f4d1`, `3af92e2` are present in git history.
- `git diff --check` passed; no task commit deleted a tracked file.
