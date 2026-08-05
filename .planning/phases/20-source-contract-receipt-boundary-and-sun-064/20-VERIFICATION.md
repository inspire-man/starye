---
phase: 20-source-contract-receipt-boundary-and-sun-064
verified: 2026-08-05T12:05:07Z
status: human_needed
score: 10/10 must-haves verified
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "执行 UAT 第 5 项：通过 canonical Gateway 打开 crawler task detail，使用真实登录会话检查 readiness 与受控 receipt/source summary。"
    expected: "Dashboard task detail 显示 Metadata persisted、Source readiness、Playback proof 与 bounded receipt/source summary；页面只展示受控字段和动作，不暴露 raw receipt、runner command/workflow、token、secret 或 signed material。"
    why_human: "当前浏览器只有本地登录页，MovieDetail 与标准 Player 已完成 Gateway/浏览器核验；Dashboard task detail 仍需要真实登录会话。"
---

# Phase 20: Source Contract, Receipt Boundary And SUN-064 Verification Report

**Phase Goal:** 用户能区分 metadata 已入库、source 当前状态和实际可播放 readiness；新抓取结果不会再把 `players=0` 或 source 写入异常显示成可播放成功。

**Verified:** 2026-08-05T12:05:07Z

**Status:** `human_needed`

**Re-verification:** Yes, canonical Gateway and in-app Browser evidence appended.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | metadata persisted、source readiness 和 playback proof 是独立层，ready 不自动产生 playback_verified。 | VERIFIED | `source-contract.ts:42-69,159-193` 定义独立 projection；API readiness、Dashboard 和 MovieDetail 分层渲染；API readiness tests 覆盖 `unverified` playback。 |
| 2 | 用户在 crawler task detail 和 MovieDetail 能区分 ready、no_source、source_failed、repairing、playback_verified。 | VERIFIED | `Crawlers.vue:503-550` 与 `MovieDetail.vue:761-839` 分别渲染四层摘要和受控状态文案；Dashboard 10 tests、Movie app 13 tests 通过；Gateway MovieDetail 现场观察到 ready/no_source 与独立 unverified playback。 |
| 3 | 新受控抓取有候选源时进入 server-owned ready 路径；零源、解析失败或 source 写入失败与 metadata success 分层呈现。 | VERIFIED | `source-contract.ts:96-156` 只以 active 且非空 URL 计算 eligibility；`source-reconciliation.ts:156-200` 和 sync tests 覆盖写入/读回失败的 bounded `source_failed`。 |
| 4 | `players=0`、全 inactive 或空 sourceUrl 读回为 no_source 且 repairable=true。 | VERIFIED | `deriveSourceReadiness` 的 zero-eligible 分支在 `source-contract.ts:138-146`；receipt regression 覆盖 SUN-064、全 inactive/空 URL。 |
| 5 | source_failed 只使用有限 reason code，raw exception 保持在 DTO 边界之外。 | VERIFIED | `source-contract.ts:3-13,102-111` 限制 reason codes；receipt/sync/public readiness tests 检查 bounded projection 的 DTO 字段集合。 |
| 6 | receipt validation 使用 canonical movie.id 重新读取 movie/player/source state，runner counts/IDs 仅为候选事实。 | VERIFIED | `receipt-validation.ts:125-163` 先以 canonical movie row 建 receipt，`readMovieSource` 在 `:77-118` 按 movie.id 读回 player/state；repository 在 `:1284-1305` 只持久化 validated receipt。 |
| 7 | persisted movie 的零 player receipt 与 source summary 保持同一 content identity，并继续呈现 no_source/unverified。 | VERIFIED | `createServerReadinessProjection` 在 `source-contract.ts:237-257` 校验 receipt primaryContentId；repository tests 覆盖 `players=0` receipt、source revision 和 `unverified` playback。 |
| 8 | 显式 `players: []` 删除 stale rows 并记录新 source revision；省略 players 保留既有 source。 | VERIFIED | `source-reconciliation.ts:152-188` 区分 undefined 与显式数组、删除并重建 rows、递增 revision；admin/sync 和 movie sync tests 覆盖两种语义。 |
| 9 | SUN-064 在 MovieDetail/标准 Player 中显示无源/可修复状态，标准 Player 在 tracking 和 xgplayer constructor 前拦截。 | VERIFIED | `MovieDetail.vue:798-860` 显示 `暂无可用播放源`、`可修复` 和受控动作；`Player.vue:357-412` 在 `trackCurrentMovieViewOnce`/`new Player` 前 guard；Gateway `/movie/P20-SUN064-20260805/play` 现场显示无源 guard，DOM 中 video/xgplayer 数量均为 0。 |
| 10 | UI 只展示 bounded receipt/source summary，不把 raw receipt、runner secrets 或 URL 作为 readiness summary。 | VERIFIED | admin projection 在 `apps/api/src/routes/admin/crawler-tasks/index.ts:223-240` 解包并返回 safe receipt/readiness；UI readiness blocks 在 `Crawlers.vue:541-550`、`MovieDetail.vue:822-838` 只显示 identity/count/revision/reason。MovieDetail 既有 source action 仍在 `:1038-1059` 使用 canonical `player.sourceUrl` 作为受控播放 href；这不是 readiness/receipt summary 的 raw receipt 展示。 |

**Score:** 10/10 truths verified (0 present-but-behavior-unverified).

## Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `apps/api/src/domain/movies/source-contract.ts` | Shared disposition, bounded reason, eligibility and readiness contract | VERIFIED | 258 lines; exports `deriveSourceReadiness`, `createReadinessProjection`, `createServerReadinessProjection` and related types; imported by receipt, sync, routes and tests. |
| `packages/db/src/schema.ts` | `movie_source_state` projection and receipt boundary schema | VERIFIED | `movieSourceStates` at `:187-204`, player relation and receipt columns are present and type-check. |
| `packages/db/drizzle/0029_source_contract_receipt_boundary.sql` | Source revision/disposition/count/reason and receipt version migration | VERIFIED | 18-line non-destructive ALTER/CREATE TABLE/INDEX migration with movie FK. |
| `apps/api/src/domain/crawler-tasks/receipt-validation.ts` | Canonical movie/player readback and validated receipt | VERIFIED | `validateReceiptCandidate` and source readback are substantive and used by repository terminal transition. |
| `apps/api/src/domain/movies/source-reconciliation.ts` | Shared controlled player reconciliation | VERIFIED | `reconcileMovieSources` replaces only explicit player results and persists fresh source projection; imported by admin and movie sync. |
| `apps/api/src/domain/crawler-tasks/__tests__/receipt-validation.test.ts` | SUN-064 and source failure regression coverage | VERIFIED | 248 lines; included in the API focused run. |
| `apps/api/src/routes/movies/__tests__/services/sync.service.test.ts` | Empty-array, omitted-player and source failure coverage | VERIFIED | 413 lines; explicit stale cleanup, omission preservation and bounded failure cases pass. |
| `apps/api/src/schemas/movie.ts` | Public readiness DTO schema | VERIFIED | Contains `ReadinessProjection` schema and is used by public movie response. |
| `apps/dashboard/src/views/Crawlers.vue` | Task detail readiness focal point | VERIFIED | Uses typed `run.readiness` and renders metadata/source/playback/receipt order. |
| `apps/movie-app/src/views/MovieDetail.vue` | MovieDetail readiness and repairable no-source UI | VERIFIED | Consumes API readiness projection and renders controlled status/actions. |
| `apps/movie-app/src/views/Player.vue` | Standard Player pre-constructor/no-source guard | VERIFIED | Guard precedes view tracking and `new Player`; trusted `streamUrl` remains a separate mode explicitly outside this standard-mode guard. |

## Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `source-contract.ts` | `schema.ts` | Projection fields/enums match `movie_source_state` | WIRED | `schema.ts:187-198` matches the source contract disposition/reason fields; shared projection is consumed by DB-facing code. |
| `crawler-tasks/types.ts` | `source-contract.ts` | `ValidatedCrawlerRunReceipt.source` | WIRED | `types.ts:160-168` imports `SourceReadinessProjection`; receipt validation and repository preserve the versioned source summary. |
| admin movie sync | `source-reconciliation.ts` | Controlled movie writes/readback | WIRED | `handlers.ts:5,52` calls `reconcileMovieSources`; focused handler test verifies canonical id and cache invalidation. |
| `receipt-validation.ts` | `source-contract.ts` | Readback players become authoritative disposition | WIRED | `receipt-validation.ts:1,3,77-118` imports and invokes `deriveSourceReadiness` after canonical reads. |
| repository terminal transition | validated receipt columns | Single terminal persistence boundary | WIRED | `repository.ts:1284-1305` validates before transition; receipt fields are written by the existing CAS transition path. |
| public movie route | `source-contract.ts` | Server-owned readiness projection | WIRED | `public/movies/index.ts:492-496` calls `createServerReadinessProjection`; response returns `readiness` at `:636`. |
| admin task route | repository/read model | Safe receipt projection | WIRED | `crawler-tasks/index.ts:197-240` parses safe receipt and projects readiness, excluding raw receipt fields. |
| Dashboard `Crawlers.vue` | admin task detail DTO | Typed `run.readiness` render | WIRED | `Crawlers.vue:64-80,496-550` consumes the admin read model and renders all four layers. |
| standard `Player.vue` | public movie detail DTO | Guard before tracking/constructor | WIRED | `Player.vue:358-375` reads API readiness and eligible players; `:408-411` performs tracking/init only after the guard. |

## Data-Flow Trace (Level 4)

| Artifact | Data variable | Source | Produces real data | Status |
| --- | --- | --- | --- | --- |
| API receipt | `source` | canonical `movie.id` queries to `player` and `movie_source_state` | Yes, readback/query-backed | FLOWING |
| Public MovieDetail | `readiness` / `players` | public movie route and service read from D1 movie/source/player tables | Yes | FLOWING |
| Dashboard task detail | `run.readiness` | admin crawler-task safe read model from validated receipt and persisted source projection | Yes | FLOWING |
| Standard Player | `movie.readiness` / eligible players | `movieApi.getMovieDetail(code)` | Yes; guard also re-filters actual player rows | FLOWING |

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| API source/readback/reconciliation contracts | `pnpm --filter api exec vitest run src/domain/movies/__tests__/source-contract.test.ts src/domain/crawler-tasks/__tests__/receipt-validation.test.ts src/domain/crawler-tasks/__tests__/repository.test.ts src/routes/admin/sync/__tests__/handlers.test.ts src/routes/admin/sync/__tests__/route.test.ts src/routes/movies/__tests__/services/sync.service.test.ts src/routes/public/movies/__tests__/readiness.test.ts src/__tests__/services/movie.service.test.ts src/routes/admin/crawler-tasks/__tests__/crawler-tasks.route.test.ts` | 9 files, 77 tests passed | PASS |
| Dashboard readiness focal point | `pnpm --filter dashboard exec vitest run src/views/__test__/Crawlers.test.ts` | 1 file, 10 tests passed | PASS |
| MovieDetail/Player no-source guard | `pnpm --filter movie-app exec vitest run src/views/__tests__/MovieDetail.dom-contract.test.ts src/views/__tests__/Player.security.test.ts` | 2 files, 13 tests passed | PASS |
| Package contracts | `pnpm --filter api type-check`; `pnpm --filter @starye/db type-check`; `pnpm --filter dashboard type-check`; `pnpm --filter movie-app exec vue-tsc -b` | All four commands exited 0 | PASS |
| Canonical Gateway SUN-064 reconciliation | controlled POSTs to `http://localhost:8080/api/admin/sync` with the fixture identity | HTTP 200; ready rev7 -> explicit empty no_source rev8 -> ready rev9 -> omitted players ready rev9 -> explicit empty no_source rev10 | PASS |
| Gateway MovieDetail and standard Player | in-app Browser at `http://localhost:8080/movie/P20-SUN064-20260805` and `/play` | readiness blocks rendered; no-source Player guard rendered; `videoCount=0`, `xgplayerCount=0`; ready projection showed one eligible source and playback stayed unverified | PASS |

## Probe Execution

No Phase 20 probe was declared, and no `scripts/**/probe-*.sh` file was found. No probe execution was applicable.

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| SRC-01 | 20-01, 20-03 | Task detail/MovieDetail distinguish metadata persisted, playback readiness and required states | NEEDS HUMAN | MovieDetail/Player were checked through the canonical Gateway; Dashboard task detail visual/user-flow check remains pending until a real signed-in session is available. |
| SRC-03 | 20-01, 20-02, 20-03 | Controlled fetch reaches ready or explicit no-source/repairable terminal state; SUN-064 players=0 readback and repair判定 | VERIFIED | Canonical Gateway sequence confirmed ready, explicit empty no_source/repairable, omitted players preservation and same MovieDetail content identity; bounded source failure paths pass focused API tests. |

No Phase 20 requirement is orphaned in `REQUIREMENTS.md`; both declared IDs map to Phase 20.

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| `apps/api/src/routes/admin/sync/handlers.ts` | 221 | Existing manga branch logs “create placeholder” after a missing chapter | INFO | `git blame` dates this line to 2026-04-01; it is outside the Phase 20 movie source boundary and does not flow into the readiness/receipt UI. No Phase 20 blocker. |

No unreferenced `TBD`, `FIXME` or `XXX` marker was found in the Phase 20 artifacts. `git diff --check` passed.

## Human Verification Required

### 1. Dashboard task detail visual/user-flow check

**Test:** With a real signed-in session, open the controlled crawler task detail through `http://localhost:8080/...`.

**Expected:** Metadata persisted, Source readiness, Playback proof and bounded receipt/source summary remain separate; controlled actions are visible; raw receipt, runner command/workflow, token, secret and signed material remain outside the UI.

**Why human:** The current browser has only the local login page; a Dashboard session was not inferred or created, while MovieDetail/standard Player browser checks are complete.

## Gaps Summary

No implementation blocker was found. All 10 merged roadmap/plan truths have substantive, wired, data-flow-backed code and passing focused local tests. The canonical local Gateway reconciliation and MovieDetail/Player browser checks are now recorded. The phase remains `human_needed` solely for the signed Dashboard task-detail check; production deployment and actual playback proof remain outside this Phase 20 result.

---

_Verified: 2026-08-05T12:05:07Z_
_Verifier: the agent (gsd-verifier)_
