---
phase: 21-source-health-and-local-repair-players-vertical-slice
verified: 2026-08-06T16:25:35Z
status: passed
score: 3/3 roadmap success criteria verified
behavior_unverified: 0
overrides_applied: 0
human_verification: []
---

# Phase 21: Source Health And Local repair_players Vertical Slice Verification Report

**Phase Goal:** 用户能查看受控播放源的有限健康信息，并从本地 Gateway 通过固定模板发起可审计的 `repair_players` 修复。

**Verified:** 2026-08-06T16:25:35Z

**Status:** `passed`

**Verification boundary:** This report proves the local control-plane vertical slice through the canonical Gateway origin. It does not claim provider dispatch, GitHub Actions execution, browser playback, `playing`, or `currentTime` evidence.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | 用户能查看每个受控播放源的 `direct`、`magnet` 或 `TorrServer` 类型，以及 `inactive`、`unverified`、`failed` 健康状态、观察时间或 bounded reason。 | VERIFIED | `packages/db/src/schema.ts` and migration `0030_source_health_repair.sql` persist source type, health, observed time and reason; `apps/dashboard/src/views/Crawlers.vue` and `apps/movie-app/src/views/MovieDetail.vue` render bounded rows. Dashboard and MovieDetail regressions cover the three source types, inactive visibility, health labels and raw-field exclusion. |
| 2 | 用户从 `no_source` 或 `source_failed` 电影发起修复时，只提交受控电影身份、原因和固定目标意图；URL、命令、workflow 和 secrets remain server-owned. | VERIFIED | `apps/api/src/routes/admin/crawler-tasks/index.ts` creates the server-owned `repair_players` snapshot; `apps/dashboard/src/views/Crawlers.vue` performs the confirmation and sends only the bounded mutation fields. API and Dashboard tests assert the request shape and absence of runner/provider material. |
| 3 | 用户通过 `http://localhost:8080` 能观察固定 `repair_players` 请求进入受控任务，并回到同一电影的 source observation/readback；失败保留可解释的 repairable 状态和下一步动作。 | VERIFIED | `pnpm local:task-runner:e2e --target local --template movie --evidence-dir artifacts/phase-21-local-repair` passed. Fresh `SUN-064` started at players=0, `no_source`, source revision 3; bounded failure, duplicate protection, command acceptance, observation, authoritative readback, dedicated receipt and terminal success were observed through Gateway. Success advanced the same movie from revision 3 to 4 and read back three sources, two eligible, with inactive TorrServer preserved as ineligible. |

**Score:** 3/3 roadmap success criteria verified (0 behavior-unverified).

## Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `apps/api/src/domain/movies/source-contract.ts` and `source-reconciliation.ts` | Bounded source health/readiness contract and persisted observation projection | VERIFIED | Source type, health, bounded reason, eligibility and source revision remain server-owned and are consumed by reconciliation/readback paths. |
| `packages/db/src/schema.ts` | Operation-aware task and source observation schema | VERIFIED | `crawler_task.operation`, `movie_source_observation`, source health fields, indexes and foreign keys are present after local migration readback. |
| `packages/db/drizzle/0030_source_health_repair.sql` | Local D1 migration for repair/source-health facts | VERIFIED | Migration 32 was applied/read back locally; migration-focused tests passed. |
| `apps/api/src/routes/admin/crawler-tasks/index.ts` | Fixed-template repair command and bounded task projection | VERIFIED | Dedicated `repair_players` route and queued-state regression are covered by the API focused run. |
| `packages/crawler/src/task-runner/repair-adapter.ts` and `template-adapters.ts` | Explicit operation selection and observation/readback adapter | VERIFIED | `repair_players` snapshots select the repair adapter explicitly; receipt/readback identity and bounded failure handling are tested. |
| `apps/dashboard/src/views/Crawlers.vue` | Source-health display, confirmation and task status surface | VERIFIED | Dashboard tests cover confirmation, bounded mutation input, source rows and exclusion of raw runner fields. |
| `apps/movie-app/src/views/MovieDetail.vue` | Same-movie informational repair handoff | VERIFIED | MovieDetail tests cover source health rows and handoff with the same movie identity; mutation remains Dashboard-owned. |
| `scripts/local-task-runner.e2e.ts` | Canonical Gateway fixture and redacted local evidence | VERIFIED | Fresh fixture, bounded evidence stages, same-movie/sourceRevision checks and redaction assertions are present; standalone TypeScript and ESLint checks passed. |

## Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| Dashboard repair confirmation | admin repair route | bounded movie identity, reason and fixed target intent | WIRED | The client does not choose adapter, target, URL, command, workflow or secret fields. |
| admin repair route | D1 task/run/attempt lifecycle | server-owned `operation: repair_players` snapshot | WIRED | The route enters the existing task state machine and preserves queued/running/failed/succeeded semantics. |
| local runner | source observation API | signed runner envelope | WIRED | The repair adapter submits bounded observations through the controlled callback boundary rather than writing the data layer directly. |
| source observation | authoritative readback | source revision CAS and same-movie identity | WIRED | Observation persistence, readback and repair receipt are checked before terminal success. |
| authoritative readback | Dashboard/MovieDetail projection | bounded source summary/readiness DTO | WIRED | Public and admin views consume persisted facts without exposing raw runner output or signed material. |

## Data-Flow Trace

| Artifact | Data | Source | Produces real data | Status |
| --- | --- | --- | --- | --- |
| repair command | `movieId`, bounded `reason`, fixed `targetIntent` | Dashboard confirmation and server-owned route | Yes | FLOWING |
| task snapshot | `operation`, movie identity, source revision and target intent | D1 task creation | Yes | FLOWING |
| source observation | source ordinal/type/health/reason/observedAt | signed repair callback and D1 persistence | Yes | FLOWING |
| repair receipt | operation, movie identity, source revision and source summary | authoritative readback | Yes | FLOWING |
| source health UI | bounded source rows and next action | admin/public persisted projection | Yes | FLOWING |

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| API repair/source contracts | Phase 21 API focused Vitest set | 8 files, 87 tests passed | PASS |
| Crawler runner contracts | Phase 21 crawler focused Vitest set | 3 files, 14 tests passed | PASS |
| Dashboard source health and repair action | `pnpm --filter dashboard exec vitest run src/views/__test__/Crawlers.test.ts` | 1 file, 12 tests passed | PASS |
| MovieDetail source-health handoff | `pnpm --filter @starye/movie-app exec vitest run src/views/__tests__/MovieDetail.dom-contract.test.ts` | 1 file, 7 tests passed | PASS |
| D1 migration contract | `pnpm --filter @starye/db exec vitest run src/__tests__/source-health-repair-migration.test.ts` | 1 file, 2 tests passed | PASS |
| Focused aggregate | Phase 21 focused set | 14 files, 122 tests passed | PASS |
| Package and script contracts | API/crawler/Dashboard/DB type-checks, movie-app `vue-tsc -b`, script `tsc`, targeted ESLint, `git diff --check` | All passed | PASS |
| Canonical Gateway vertical proof | `pnpm local:task-runner:e2e --target local --template movie --evidence-dir artifacts/phase-21-local-repair` | Fresh local `SUN-064` repair flow passed | PASS |

## Canonical Gateway Proof

The proof used `http://localhost:8080` for command acceptance, signed runner callbacks, task readback and same-movie public readback. The fresh local fixture began with movie `phase21-sun064-20260806`, code `SUN-064`, zero players, `no_source`, and source revision 3.

- The bounded failure run ended `receipt_missing` and exposed `create_new_task` as the next action.
- Duplicate protection, source observation, authoritative readback, dedicated repair receipt and terminal success shared the expected task/run/attempt identity.
- The successful repair advanced source revision `3 -> 4` for the same movie.
- Readback returned three sources, two eligible sources, and an inactive TorrServer source that remained ineligible.
- Ordinary movie execution reached `succeeded`; a separate cancellation run reached `cancelled`.
- Evidence was bounded/redacted and excluded cookies, secrets, signatures, raw sources, exceptions and runner material.

This is a local control-plane result only. Provider dispatch, production repair/reconciliation and actual browser playback remain later-phase work.

## Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| SRC-02 | 21-01, 21-02, 21-06, 21-07 | 用户可查看 source 类型和有限健康信息 | VERIFIED | Persisted schema, bounded API/UI projections, focused Dashboard/MovieDetail tests and local Gateway readback. |
| REP-01 | 21-01 through 21-07 | 用户可从 Dashboard 发起固定模板 `repair_players` 任务 | VERIFIED | Server-owned route, explicit repair adapter, signed observation/readback, dedicated receipt and canonical Gateway E2E. |

No Phase 21 requirement is orphaned in `.planning/REQUIREMENTS.md`.

## Gaps And Deferred Boundaries

No Phase 21 implementation blocker was found. The following are intentionally outside this verification:

- GitHub Actions provider repair, lease/attempt reconciliation and late callback behavior are Phase 23.
- MovieDetail/Player load, buffer, invalid-source, retry-limit and source-switch actions are Phase 22.
- Viewer `canplay`/`playing`/`waiting`/`stalled`/`error` and `currentTime` progress evidence are Phase 24.
- The local fixture is not production evidence and does not select or validate a production provider tuple.

## Anti-Patterns Found

None in the Phase 21 changed source or planning scope. The final Phase 21-07 GitNexus staged scope reported the expected cross-layer files and flows; targeted upstream impact checks for the changed control-plane symbols were LOW. The broad aggregate CRITICAL score was recorded as a scope signal for the cross-layer runner/reconciliation change, not as an unverified implementation claim.

---

_Verified: 2026-08-06T16:25:35Z_
_Verifier: the agent (goal-backward review of Phase 21-07 evidence)_
