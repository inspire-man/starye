---
phase: 20-source-contract-receipt-boundary-and-sun-064
plan: 02
subsystem: api-crawler-sync
tags: [typescript, vitest, drizzle, d1, receipt-validation, source-reconciliation, sun-064]

# Dependency graph
requires:
  - phase: 20-01
    provides: "source readiness contract、movie_source_state projection、versioned receipt columns"
provides:
  - "canonical movie/player readback receipt validation"
  - "bounded terminal receipt persistence"
  - "shared controlled movie source reconciliation with explicit empty-array semantics"
affects: [crawler-tasks, controlled-sync, movie-detail, source-repair]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "candidate IDs/counts are non-authoritative until canonical D1 readback"
    - "validated receipt summary plus receipt version/identity/revision in one CAS terminal update"
    - "explicit players field reconciles rows; omitted players preserves existing-source semantics"

key-files:
  created:
    - apps/api/src/domain/movies/source-reconciliation.ts
  modified:
    - apps/api/src/domain/crawler-tasks/receipt-validation.ts
    - apps/api/src/domain/crawler-tasks/__tests__/receipt-validation.test.ts
    - apps/api/src/domain/crawler-tasks/repository.ts
    - apps/api/src/domain/crawler-tasks/__tests__/repository.test.ts
    - apps/api/src/routes/admin/sync/handlers.ts
    - apps/api/src/routes/admin/sync/__tests__/handlers.test.ts
    - apps/api/src/routes/movies/services/sync.service.ts
    - apps/api/src/routes/movies/__tests__/services/sync.service.test.ts

decisions:
  - "movie receipt 的 primaryContentId、eligibleCount、source disposition 和 sourceRevision 由 server-owned movie.id/player/source-state readback 产生。"
  - "no_source、source_failed、repairing 与 crawler execution status 分开保留；ready 不升级为 playback_verified。"
  - "terminal receipt 只写入 validated projection；raw candidate/exception/token/workflow 不进入 CrawlerRunReadModel。"
  - "controlled sync 通过 shared reconcileMovieSources 处理显式空数组删除 stale rows，并通过 movies Gateway cache group 失效旧读缓存。"

metrics:
  duration: "约 50 分钟"
  completed: 2026-08-05
  tasks: 3
  tests: "39 focused tests passed"
status: complete
---

# Phase 20 Plan 02: Canonical Receipt Readback And Source Reconciliation Summary

**以 canonical movie.id fresh readback 绑定 receipt/source summary，完成 SUN-064 零 player、stale source 清理和 bounded source failure 闭环。**

## Accomplishments

- `validateReceiptCandidate` 先解析 server-owned movie row，再读取同一 `movie.id` 的 player 与 `movie_source_state`；SUN-064 `players=0` 输出 `no_source`、`eligibleCount=0`、`repairable=true`，source failure 只输出有限 reason code。
- terminal repository transition 将 validated receipt、schema version、primary content id 和 source revision 写入同一 D1 CAS update；详情 parser 严格过滤 malformed/raw receipt 字段。
- 新增 `reconcileMovieSources`，统一 admin controlled sync 与 movie service sync 的 player 替换、fresh readback、source revision 更新和 bounded failure projection。
- 显式 `players: []` 删除 stale player rows并生成新 `no_source` revision；省略 `players` 保留现有 rows/source contract；写入和 readback 失败均保持 metadata success 可观察且 source 独立为 `source_failed`。
- admin sync 读取 canonical movie id 并失效 `movies` Gateway cache；未改变生产 Puppeteer、GitHub Actions 或历史 Phase 13 carrier 边界。

## Task Commits

1. **Task 1: receipt canonical movie/player readback** - `efc1345`（RED）→ `0c73782`（GREEN）
2. **Task 2: validated receipt terminal persistence** - `564b23e`（RED）→ `36ad030`（GREEN）
3. **Task 3: controlled source reconciliation** - `245c2ef`（RED）→ `1838982`（GREEN）

## Verification

- `pnpm --filter api exec vitest run src/domain/crawler-tasks/__tests__/receipt-validation.test.ts`：通过。
- `pnpm --filter api exec vitest run src/domain/crawler-tasks/__tests__/repository.test.ts`：通过。
- `pnpm --filter api exec vitest run src/routes/admin/sync/__tests__/handlers.test.ts src/routes/movies/__tests__/services/sync.service.test.ts`：通过。
- 计划级 combined focused run：4 files / 39 tests passed。
- `pnpm --filter api type-check`：通过。
- 每个提交前均运行 staged GitNexus detect-changes；Task 2 的 `applyTransition` 命中 CRITICAL blast radius，保持 CAS、lease、provider 和状态机分支不变；Task 3 为 MEDIUM，命中预期 movie sync flows。
- 所有 task commits 无 tracked deletion，`git diff --check` 通过。
- 未执行生产或远程 proof；本计划仅完成本地 API readback/sync contract。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 修复 admin movie sync 的残留 movieId 引用**
- **Found during:** Task 3 GREEN focused tests
- **Issue:** 受控同步改用 `requestedMovieId` 后，upsert payload 仍引用已删除的 `movieId`，导致运行时 `ReferenceError`。
- **Fix:** 使用 requested id 完成 upsert，再通过 slug fresh-read canonical movie id。
- **Files modified:** `apps/api/src/routes/admin/sync/handlers.ts`
- **Commit:** `1838982`

**2. [Rule 3 - Blocking] 补齐 repository 内存 D1 fixture 的 player/source-contract schema**
- **Found during:** Task 2 GREEN focused tests
- **Issue:** 既有 repository fixture 只建立 movie/comic 与 crawler tables，canonical player readback 缺少 `player` 表而按设计降级到 source_failed。
- **Fix:** 在 repository fixture 中建立最小 player 表，并应用 0029 migration，保留 source failure regression coverage。
- **Files modified:** `apps/api/src/domain/crawler-tasks/__tests__/repository.test.ts`
- **Commit:** `36ad030`

**3. [Rule 3 - Blocking] 修复 Task 3 正常 pre-commit lint 阻塞**
- **Found during:** Task 3 GREEN commit
- **Issue:** service 外层 catch 已不再读取异常变量，lint-staged 报 `unused-imports/no-unused-vars`。
- **Fix:** 改为无绑定 catch；随后 normal git hook 通过。
- **Files modified:** `apps/api/src/routes/movies/services/sync.service.ts`
- **Commit:** `1838982`

### Auth Gates

None.

## Known Stubs

- `apps/api/src/routes/admin/sync/handlers.ts:221`：既有 manga sync 的 placeholder fallback 日志；本计划只改变 movie source boundary，未扩展漫画同步语义，留给后续专门的 manga contract work。

## Threat Surface Scan

本计划未新增 network endpoint、auth path 或 schema trust boundary；实现只接入已有 movie/player/movie_source_state D1 边界，并对 runner/sync 输入执行 canonical readback 与 bounded projection。

## Self-Check: PASSED

- Summary 文件路径存在。
- 六个 task commit 均存在：`efc1345`、`0c73782`、`564b23e`、`36ad030`、`245c2ef`、`1838982`。
- 9 个计划声明的实现/测试文件均存在。
- 共享 `STATE.md`、`ROADMAP.md` 及用户已有 `AGENTS.md`、`CLAUDE.md`、`.planning/config.json` 改动保持未暂存。

---
*Phase: 20-source-contract-receipt-boundary-and-sun-064*
*Plan: 20-02*
*Completed: 2026-08-05*
