---
phase: 16-task-domain-foundation
verified: 2026-07-30T10:00:18Z
status: passed
score: 7/7 must-haves verified
behavior_unverified: 0
overrides_applied: 0
gaps: []
---

# Phase 16: Task Domain Foundation Verification Report

**Phase Goal:** 建立受控任务、运行、日志、状态机与安全回调的持久化契约。
**Verified:** 2026-07-30T10:00:18Z
**Status:** passed
**Re-verification:** Yes - 16-04 gap closure

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | 管理员只能从固定 movie/manga 模板创建任务，任意命令、URL、密钥和 workflow 参数会在 API 层拒绝。 | VERIFIED | `CreateCrawlerTaskSchema` 是 strict `{ template }`，registry 仅含 movie/manga；route test 覆盖 service-token-only 401、wrong resource 403 和 executable-shaped field rejection。 |
| 2 | 已登录管理员的 task 查询、日志、取消和重试均绑定到其有权限的 task/run。 | VERIFIED | `requireTaskRunAccess()` 先保留模板权限判断，再以参数绑定的 `crawler_run`/`crawler_task` 关系确认 `taskId + runId`；logs、cancel、retry 全部在读取或 repository mutation 前复用该 guard。route regression 覆盖 movie task 指向 manga run 的三条路径均为 404，且 repository 未被调用。 |
| 3 | D1 保留 task、attempt、操作者、受控输入快照、状态迁移和结构化日志，且状态迁移可审计。 | VERIFIED | schema/migration 有六张 task-domain 表、FK、唯一约束与 expiry indexes；repository 的 version/sequence CAS 加 transition audit 由 in-memory D1 tests 覆盖。 |
| 4 | 失败或取消只创建新的 immutable attempt，且同模板的活动 run 受 lease 防重。 | VERIFIED | `retryRun()` 插入递增 attempt；`createOrGetActiveRun()` 以 template lease 处理冲突；repository tests 覆盖 history、lease collision、10-minute lost-run 和 retry eligibility。 |
| 5 | HMAC runner event 在 raw-body 验签后才解析，绑定 key/run/attempt/timestamp/nonce/event/sequence，并拒绝冲突重放或终态覆写。 | VERIFIED | internal route 先 `arrayBuffer()` 和 `verifyRunnerEventSignature()`，再 strict parse；route/auth + repository tests 覆盖 timestamp、path/body、attempt、event/nonce/digest conflict 与 stored duplicate outcome。 |
| 6 | runner 日志在持久化或响应前均为结构化、4 KiB/500 条受限、已脱敏的安全数据。 | VERIFIED | `redactRunnerEventText()` 对 authorization、cookie 以及 token/secret/signature/password/API-key 的 `:` 与 `=` 表示均脱敏；normal log 与 terminal summary 使用同一 normalizer，回归测试确认敏感值不会出现在任一 projection。4 KiB/500-row upper bound 和 single marker 仍由 repository test 验证。 |
| 7 | 每日清理只删除超过 90 天的 detailed logs，保留 task/run/terminal summary。 | VERIFIED | `scheduled` 仅调用 `purgeExpiredRunLogs()`，其 SQL 只删除 `crawler_run_log WHERE expires_at <= ?`；cleanup test 与 repository retention test 均通过。 |

**Score:** 7/7 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `packages/db/src/schema.ts` | task/run/lease/event/transition/log tables and relations | VERIFIED | L1 exists; L2 six substantive Drizzle tables, indexes, FK relations and insert/select types; L3 used by repository through D1-backed queries. |
| `packages/db/drizzle/0027_crawler_task_domain_foundation.sql` | add-only D1 migration | VERIFIED | L1 exists; L2 creates all six tables and required keys/indexes; L3 repository integration test applies it to in-memory SQLite. |
| `apps/api/src/domain/crawler-tasks/state-machine.ts` | closed lifecycle decisions | VERIFIED | Pure transition matrix rejects terminal/invalid edges and yields stale decisions; focused state-machine test passes. |
| `apps/api/src/domain/crawler-tasks/repository.ts` | atomic lease/CAS/history/log cleanup owner | VERIFIED | Implements parameter-bound D1 batches/CAS, lease expiry, attempts, events, caps and expiry; real in-memory D1 tests pass. |
| `apps/api/src/schemas/crawler-tasks.ts` | strict command/query schemas | VERIFIED | strict Valibot create/retry/param/cursor schemas are mounted by the admin router. |
| `apps/api/src/routes/admin/crawler-tasks/index.ts` | session-only task commands and queries | VERIFIED | Mounted session-only router performs template permission followed by parameter-bound task/run ownership before every run-scoped read or mutation; relation mismatch returns 404 without repository mutation. |
| `apps/api/src/domain/crawler-tasks/runner-event-auth.ts` | current/previous-key raw HMAC verification | VERIFIED | Native Web Crypto verifier selects current or <24-hour previous key and is called before JSON parsing. |
| `apps/api/src/domain/crawler-tasks/log-redaction.ts` | redact-before-write projection | VERIFIED | Structured normalizer and byte truncation remain wired; authorization, cookie, API-key, secret and peer credential forms are redacted for both `:` and `=` delimiters before log or terminal-summary projection. |
| `apps/api/src/routes/internal/crawler-runs/index.ts` | HMAC-only lifecycle event endpoint | VERIFIED | Mounted under `/api/internal`, has no serviceAuth/CRAWLER_SECRET import, and calls the repository after signature/identity/window checks. |
| `apps/api/wrangler.toml` | daily log cleanup trigger | VERIFIED | `crons = ["0 3 * * *"]`; scheduled handler invokes only repository detail-log purge. |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `template-registry.ts` | `repository.ts` | server snapshot and lease key | WIRED | create path passes registry-owned `templateKey`; repository creates server snapshot. |
| `repository.ts` | DB task-domain schema | D1 batch/CAS writes | WIRED | repository references all six migration tables with parameter binding; in-memory migration integration passes. |
| `state-machine.ts` | `repository.ts` | decision before versioned update/audit | WIRED | `applyTransition()` calls `decideCrawlerRunTransition()` before guarded update/transition audit. |
| admin task route | registry | server-resolved permission resource | WIRED | `requireTemplateAccess()` resolves the template from registry before permission evaluation. |
| admin task route | task/run relation and repository | create/query/cancel/retry | WIRED | `requireTaskRunAccess()` performs the task/run relation query before logs; cancel/retry then invoke the repository only after that relation guard succeeds. Fixed parameterized list/detail/log projections remain bounded route-owned reads. |
| admin main route | admin task route | `/crawler-tasks` mount | WIRED | `admin.route('/crawler-tasks', adminCrawlerTasksRoutes)`. |
| internal runner route | HMAC verifier | raw body before parse | WIRED | raw `arrayBuffer` is verified before `Response(rawBody).json()` / Valibot parse. |
| internal runner route | repository | receipt/CAS/log writes | WIRED | calls `processRunnerEvent()` with digest, key, nonce, attempt, sequence and normalized log. |
| Worker scheduled handler | repository | log-expiry purge | WIRED | `createCrawlerTaskLogCleanupHandler()` delegates through `waitUntil`. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| --- | --- | --- | --- | --- |
| admin task router | task/list/detail/log responses | validated request + D1 `crawler_task`/`crawler_run`/`crawler_run_log` queries | parameter-bound D1 results after task/run ownership guard | FLOWING |
| internal runner route | lifecycle/log/receipt event | raw signed request -> Valibot -> redactor -> repository | D1 event/transition/log writes with sanitized normal log and terminal summary | FLOWING |
| scheduled handler | expired log count | Worker cron -> `purgeExpiredRunLogs(now)` | D1 delete limited to `crawler_run_log` | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Phase 16 domain, API, HMAC and cleanup tests | `pnpm --filter api exec vitest run` with the six Phase 16 test files | 6 files, 29 tests passed | PASS |
| API type contract | `pnpm --filter api type-check` | exit 0 | PASS |
| DB schema type contract | `pnpm --filter @starye/db type-check` | exit 0 | PASS |
| Header-style credential redaction | `runner-event-auth.test.ts` normal-log and terminal-summary cases | `X-API-Key:`, `secret:`, authorization and cookie sensitive values are absent from both projections | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- |
| CTRL-01 | 16-02, 16-04 | Fixed templates and rejection of arbitrary execution input | SATISFIED | Create schema accepts only server-owned templates; run-scoped paths bind `taskId + runId` after resource authorization, rejecting cross-template substitution before reads or mutations. |
| CTRL-02 | 16-01 | Persist task, attempts, logs, operator and controlled snapshot | SATISFIED | six-table schema/migration, relations, and repository integration coverage. |
| CTRL-03 | 16-01, 16-03 | Closed queue/dispatch/run/cancel/terminal lifecycle | SATISFIED | state machine, CAS repository and signed-event tests cover legal, stale and terminal paths. |
| CTRL-04 | 16-01, 16-02 | Immutable traceable retry attempts | SATISFIED | retry creates a new attempt after failed/cancelled predecessor; old history remains. |
| CTRL-05 | 16-01 | D1 claim/lease blocks duplicate active template execution | SATISFIED | template lease primary key, collision result and expiry test evidence. |
| OPS-01 | 16-03, 16-04 | Independent HMAC, window, nonce/idempotency and log redaction | SATISFIED | HMAC/window/replay checks remain green; redaction covers common colon- and equals-delimited credential header/key forms in normal log and terminal-summary projections. |

All six Phase 16 requirement IDs are declared across the four plans and verified. Phase 17-19 still own runner, Actions and Dashboard delivery; no Phase 16 requirement is deferred.

### Resolved Gaps

| File | Resolution | Verification |
| --- | --- | --- |
| `apps/api/src/routes/admin/crawler-tasks/index.ts` | `requireTaskRunAccess()` binds the authorized task to the requested run before logs/cancel/retry. | Cross movie/manga task/run regression returns 404 for all three endpoints and asserts no repository mutation. |
| `apps/api/src/domain/crawler-tasks/log-redaction.ts` | Sensitive credential regexes accept `:` and `=` consistently. | Normalized log and terminal-summary regressions contain no API-key, secret, authorization or cookie values. |

No Phase 16 `TBD`, `FIXME`, or `XXX` debt markers were found. The `return null` in `apps/api/src/index.ts` is an existing Sentry before-send filter, not a Phase 16 stub.

### Verification Summary

Phase 16 now satisfies its persistent control-plane contract: controlled movie/manga templates, auditable D1 task/run history, lease/CAS lifecycle rules, task/run-scoped administrator access, raw-body HMAC runner events, credential-safe bounded logs and daily detail-log cleanup. Re-verification ran the six focused suites (29 tests) plus API and DB type-checks; no human-only or external-service proof is required for this foundation phase.

---

_Verified: 2026-07-30T10:00:18Z_
_Verifier: Phase 16 execution closeout (verifier capability disabled in project config)_
