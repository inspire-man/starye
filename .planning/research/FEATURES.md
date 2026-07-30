# Feature Landscape

**Project:** Starye v1.3 - 后台爬虫任务与内容运维
**Domain:** Single-user personal content platform crawler control plane
**Researched:** 2026-07-30
**Overall confidence:** MEDIUM

## Table Stakes

These are the capabilities required for the stated v1.3 operator workflow. The existing Dashboard already exposes content-level crawler statistics, but it has no durable execution record: failures and recovery are currently advisory instructions pointing to local files or GitHub Actions.

| Feature | Why Expected | Complexity | Notes | Confidence |
|---------|--------------|------------|-------|------------|
| Fixed movie and comic template catalog | The Dashboard must initiate a known, reviewable workload rather than construct a crawler command. | Medium | Persist a template key and immutable template version; accept only the two v1.3 templates and a tightly typed input payload. | HIGH - project scope and existing fixed workflow entries |
| Durable job and attempt lifecycle | An operator needs one durable answer for `queued`, `running`, `succeeded`, `failed`, and `canceled`, including the current attempt and terminal reason. | High | A retry creates a new attempt linked to the original job; it never rewrites terminal history back to `queued`. Job execution state is separate from `comic.crawlStatus` and `movie.crawlStatus`. | HIGH - active requirements and schema inspection |
| Dashboard launch, list, detail, and action surface | Manual initiation, progress inspection, cancel, retry, and receipt navigation must work from the Dashboard at the Gateway URL. | High | Require an explicit confirmation for launch/cancel/retry and visible disabled/loading states to prevent duplicate clicks. Keep per-resource role checks already used by crawler administration. | HIGH - active requirements and existing Dashboard pattern |
| Local runner adapter | Local development needs the same API, state transitions, log contract, and receipts as production while executing through a local runner. | High | The adapter invokes the existing prepared crawler entry rather than embedding Node/Puppeteer execution in the Worker. It must report start, heartbeats, terminal result, and cancellation acknowledgement. | HIGH - project decision and existing crawler scripts |
| GitHub Actions production adapter | Production jobs must dispatch the existing fixed Actions workflows and retain the GitHub workflow run ID/URL for reconciliation. | High | `workflow_dispatch` accepts declared inputs and can return run details; persist the provider run reference immediately. The API/D1 job is the product source of truth, while Actions is the execution provider. | MEDIUM - official GitHub API documentation, direct fetch |
| Provider-state reconciliation | A dispatch acknowledgement alone does not prove execution or ingestion. | High | Reconcile GitHub run state into the durable job record through a signed runner callback plus bounded polling/recovery for missed callbacks. Treat unknown/mismatched provider state as non-success. | MEDIUM - GitHub Actions run API and concurrency documentation |
| Structured, queryable log timeline | A user must see why an attempt is queued, running, failed, retried, or canceled without reading a provider console first. | Medium | Store timestamp, level, event code, message, attempt ID, and safe context JSON. Never store secrets, raw environment variables, or unbounded debug dumps; link to GitHub run logs instead. | HIGH - active requirements and storage constraints |
| Cancel and retry semantics | Operators expect a pending/running job to stop and a failed/canceled job to be retried deliberately. | High | Cancel is an asynchronous requested-to-confirmed transition. Production calls the GitHub cancellation API; local sends cancellation to the runner. Retry creates a new provider run and preserves the causal chain. | MEDIUM - official GitHub workflow-run API documentation |
| Ingestion receipt and content CRUD handoff | Successful crawler completion is meaningful only when the Dashboard can identify what was inserted/updated and then manage it. | High | Persist counts plus stable movie/comic IDs or codes. Link each receipt into existing Dashboard movie/comic CRUD instead of duplicating an editor inside the task screen. | HIGH - active requirements and existing Dashboard CRUD client |
| Authorization and audit trail | Triggering a production crawler is an administrative mutation even in a single-user system. | Medium | Keep GitHub credentials server-side; record template, environment, actor, action, prior/current status, and provider run reference in audit history. | HIGH - project out-of-scope boundary and existing service auth/audit surface |

## Differentiators

| Feature | Value Proposition | Complexity | Notes | Confidence |
|---------|-------------------|------------|-------|------------|
| One cross-environment job contract | Local and production accept the same request, expose the same states/log schema, and produce the same receipt shape. | High | Only the runner adapter differs; this prevents production-only status logic and makes local acceptance meaningful. | HIGH - v1.3 goal |
| Provider correlation and ingestion receipts | Each Dashboard job can be traced to one Actions run and to the resulting content IDs/counts. | Medium | Show an external run link plus internal content links; reconcile mismatches as failure/checkpoint evidence, never as success. | MEDIUM - official Actions API and v1.2 evidence practice |
| Template provenance fingerprint | The detail page shows template key/version, selected target, runner kind, start/end times, and sanitized inputs. | Medium | Makes later diagnosis reproducible without exposing source configuration or credentials. | HIGH - controlled-template requirement |
| Bounded recovery rather than blind re-run | Retry uses a recorded reason and creates an explicit attempt; cancellation and failure retain logs. | Medium | Add a retry limit/policy per template and require a confirmation before a new attempt. | HIGH - existing crawler error-recovery requirements |
| Content-management handoff | A completed job provides direct entry to the existing movie/comic list/detail CRUD with a run filter or receipt IDs. | Medium | This is more useful to a single operator than a generic analytics dashboard. | HIGH - v1.3 end-to-end acceptance requirement |

## Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead | Confidence |
|--------------|-----------|--------------------|------------|
| Arbitrary shell commands, crawler source URLs, secrets, or runner flags in Dashboard | It bypasses target-profile, credential, source-site, and audit boundaries. | Expose only allowlisted movie/comic templates with typed, non-secret inputs. | HIGH - explicit out-of-scope boundary |
| Running Node/Puppeteer inside the Cloudflare Worker | The current crawler needs a Node-capable runner and production already uses GitHub Actions. | Keep the Worker as control plane and use local/GitHub runner adapters. | HIGH - project decision |
| Browser-to-GitHub direct dispatch | It would expose a token and lets client code bypass server authorization/auditing. | Dashboard calls the authenticated API; the API holds the provider credential as a Worker secret. | HIGH - existing auth boundary |
| Treating GitHub Actions as the only job database | Provider queue replacement, transient API failures, missed callbacks, and log retention make external state insufficient for Dashboard history. | D1 owns product state and attempts; Actions run ID is a correlated provider reference. | MEDIUM - GitHub concurrency and run API documentation |
| Resetting failed/canceled jobs in place | It destroys operational history and makes logs/receipts ambiguous. | Model retries as linked attempts with their own timestamps, provider run IDs, and logs. | HIGH - durable lifecycle requirement |
| Conflating job status with content `crawlStatus` | A job can fail after updating some content, and a completed job may leave individual items partial. | Keep execution lifecycle and per-content crawl completeness as separate models; surface both in the receipt. | HIGH - current database schema |
| Full corpus crawl, live log streaming, template designer, or editable schedules in the MVP | These multiply source-site load, operational cost, and UI complexity before the controlled path is proven. | Start fixed templates with paged/polled logs; add richer scheduling or streaming only after real use demonstrates the need. | HIGH - single-user scope and budget constraint |
| Copying crawled chapter pages into R2 as a job artifact | It violates the established external-image/cost policy and turns observability into unbounded storage. | Store compact structured logs and receipt metadata; retain external/source image semantics. | HIGH - storage policy |

## Feature Dependencies

```text
Authentication + resource authorization + audit action
    -> fixed movie/comic template registry
        -> D1 job + attempt + structured-log contract
            -> create/queue/idempotency API
                -> local runner adapter
                -> GitHub Actions dispatch adapter
                    -> provider run correlation + callback/poll reconciliation
                        -> terminal receipt (content IDs/counts)
                            -> Dashboard job list/detail/actions
                                -> existing movie/comic CRUD handoff

Cancellation and retry API
    -> attempt transition rules
    -> corresponding runner/provider operation
    -> durable terminal log and receipt update
```

### Dependency Notes

- The durable state model is first because neither local nor production execution can recover safely from a restart without a job/attempt record.
- Template validation precedes dispatch: current Actions workflows already expose `workflow_dispatch`, but v1.3 must not pass through arbitrary source or command input.
- The production adapter depends on a server-held GitHub credential, explicit `workflow_dispatch` inputs, and an immediate provider run correlation. GitHub's documented concurrency semantics mean that provider state may be canceled/replaced independently of the Dashboard request.
- A successful process exit is insufficient. The runner must emit a bounded ingestion receipt before the Dashboard offers content-management links.
- Existing movie/comic CRUD comes after the receipt contract. It is already a separate Dashboard capability and must not be reimplemented in the crawler-job screen.

## MVP Recommendation

Prioritize:

1. **Control-plane contract and D1 migration**: fixed `movie`/`comic` templates; job, attempt, structured log, receipt, authorization, audit, idempotency, and explicit transition tests.
2. **Local execution path**: create, run, observe, cancel, retry, and finish one template through the local runner using the same API/state contract.
3. **Production Actions path**: dispatch the matching existing workflow, persist/correlate its run ID, accept signed runner updates, reconcile missed updates, and issue cancel/retry provider calls.
4. **Dashboard and acceptance chain**: launch/list/detail/action UI plus receipt links into existing movie/comic CRUD; prove the same controlled template locally and through the production execution path.

Launch scope:

- One administrator, two immutable v1.3 template families (`movie`, `comic`), one active attempt per job, paged/polled structured logs, and durable terminal history.
- Existing target-profile validation remains mandatory before either adapter starts work.
- A terminal `succeeded` state requires a runner receipt with validated ingestion result, not just a GitHub dispatch response or process start.

Defer:

- Actor/publisher templates, arbitrary per-run URLs, batch/full-corpus launch controls, source/template editing, UI schedule management, live WebSocket log streaming, automatic unlimited retries, and a new content editor.

## Roadmap Implications

| Suggested Phase | Scope | Why It Comes Here |
|-----------------|-------|-------------------|
| 1. Task Domain Foundation | State machine, D1 schema/migration, fixed template registry, API DTOs, authorization/audit, transition and idempotency tests. | Every runner, Dashboard view, and retry/cancel action relies on this invariant contract. |
| 2. Local Runner Control Loop | Local runner adapter, callback/heartbeat protocol, structured log/receipt persistence, local cancel/retry and failure recovery. | Establishes a repeatable, low-cost end-to-end execution path before involving Actions. |
| 3. GitHub Actions Orchestration | Server-side workflow dispatch/correlation, signed completion update, reconciliation, provider cancel/retry, workflow changes. | Reuses existing production crawler execution while keeping D1 authoritative. |
| 4. Dashboard Content Operations and E2E Proof | Job launch/list/detail/actions, receipt-to-content CRUD links, Gateway-first local UAT and production-path acceptance evidence. | The user experience is complete only when a managed task results in manageable content. |

## Sources and Confidence

| Source | Finding Used | Confidence |
|--------|--------------|------------|
| [`.planning/PROJECT.md`](../PROJECT.md) | v1.3 goal, active requirements, out-of-scope controlled-template boundary, GitHub Actions production decision. | HIGH - canonical project artifact |
| [`apps/api/src/routes/admin/crawlers/index.ts`](../../apps/api/src/routes/admin/crawlers/index.ts) and [`apps/dashboard/src/views/Crawlers.vue`](../../apps/dashboard/src/views/Crawlers.vue) | Current monitoring is content-statistics plus advisory recovery/failed-task UI, not durable execution management. | HIGH - direct repository inspection |
| [`packages/db/src/schema.ts`](../../packages/db/src/schema.ts) | Current `crawlStatus` models movie/comic item completeness only; there is no crawler-job entity. | HIGH - direct repository inspection |
| [daily movie and manga workflows](../../.github/workflows/) | Existing production crawlers are fixed `workflow_dispatch` GitHub Actions entries using target-profile preparation. | HIGH - direct repository inspection |
| [GitHub REST: workflow dispatch](https://docs.github.com/en/rest/actions/workflows?apiVersion=2022-11-28#create-a-workflow-dispatch-event) | Dispatch supports configured inputs and can return a provider workflow-run ID/URLs. | MEDIUM - official documentation fetched directly; Context7 CLI was unavailable and classifier returned MEDIUM |
| [GitHub REST: workflow runs](https://docs.github.com/en/rest/actions/workflow-runs?apiVersion=2022-11-28) | Documents workflow-run read, cancel, re-run, and re-run-failed-jobs operations. | MEDIUM - official documentation fetched directly; Context7 CLI was unavailable and classifier returned MEDIUM |
| [GitHub Actions concurrency](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency) | Pending/running concurrency behavior reinforces that provider state is not the Dashboard's durable history. | MEDIUM - official documentation fetched directly; Context7 CLI was unavailable and classifier returned MEDIUM |
| Generic web ecosystem search | No external generic result was used: Brave-backed search was unavailable because `BRAVE_API_KEY` is unset. | LOW - explicitly excluded from authoritative findings |

---
*Feature research for: Starye v1.3 后台爬虫任务与内容运维*
*Researched: 2026-07-30*
