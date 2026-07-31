# Phase 18: GitHub Actions Production Orchestration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `18-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-07-31
**Phase:** 18-GitHub Actions Production Orchestration
**Areas discussed:** Provider credentials and dispatch boundary, Manual and schedule registration, Provider run correlation and status compensation, Production cancellation/retry/lease recovery

---

## Provider credentials and dispatch boundary

### Q1 — GitHub credential

| Option | Description | Selected |
|--------|-------------|----------|
| GitHub App installation token | Short-lived provider credential with App installation permissions. | ✓ |
| Fine-grained PAT | Repository-scoped long-lived token stored as a secret. | |
| Agent chooses | Select after inspecting repository configuration. | |

**User's choice:** 1
**Notes:** The API uses an installation token rather than a PAT.

### Q2 — Workflow and target discovery

| Option | Description | Selected |
|--------|-------------|----------|
| Server-side closed registry | Fixed movie/manga workflow files, repository, `main` ref, `starye-org` target and Environment. | ✓ |
| TargetProfile-driven registry | Read the closed mapping from validated TargetProfile metadata. | |
| One dispatch wrapper | Trigger one fixed wrapper that routes to the crawler entry. | |

**User's choice:** 1
**Notes:** Keep the two existing fixed workflow files as the production entry points.

### Q3 — Dispatch payload

| Option | Description | Selected |
|--------|-------------|----------|
| Explicit binding fields | Pass `run_id`, `attempt`, `template`, and `target`; workflow validates each against the API record. | ✓ |
| Signed API lookup | Pass only `run_id` and `attempt`; workflow reads the remaining snapshot from the API. | |
| Signed opaque token | Pass a short-lived token containing the binding fields. | |

**User's choice:** 1
**Notes:** The workflow receives explicit fields and performs a full snapshot match before crawler execution.

### Q4 — Installation token lifecycle

| Option | Description | Selected |
|--------|-------------|----------|
| Mint per operation | Mint for each provider operation and retain only in the current request. | ✓ |
| In-memory cache | Cache until expiry inside the Worker process. | |
| External token broker | Delegate minting and rotation to a separate service. | |

**User's choice:** 1
**Notes:** Token values stay out of D1, logs and receipts.

---

## Manual and schedule registration

### Q1 — Schedule registration order

| Option | Description | Selected |
|--------|-------------|----------|
| Workflow first-step registration | GitHub schedule remains active; workflow registers with the API and receives `run_id`. | ✓ |
| API pre-created scheduled run | Control plane creates queued runs before the scheduled workflow claims them. | |
| Control plane-only scheduler | API creates and dispatches runs; GitHub schedule is removed from execution. | |

**User's choice:** 1
**Notes:** Manual runs remain API-created before dispatch; scheduled runs register from the workflow's first job.

### Q2 — Schedule idempotency key

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed time-bucket key | Unique key from template, target, workflow and `scheduled_at`. | ✓ |
| `GITHUB_RUN_ID` primary key | Each provider run registers independently, with time-window dedupe. | |
| Random registration token | Workflow-generated token serves as the dedupe key. | |

**User's choice:** 1
**Notes:** Duplicate registration for one schedule bucket returns the existing control-plane run.

### Q3 — Schedule registration authentication

| Option | Description | Selected |
|--------|-------------|----------|
| Independent runner-event HMAC | Add a signed `schedule_register` event bound to provider and schedule identity. | ✓ |
| Dedicated schedule HMAC | Create a separate secret dedicated to schedule registration. | |
| GitHub OIDC | Validate repository, workflow, ref and Environment claims in the API. | |

**User's choice:** 1
**Notes:** The existing independent runner-event HMAC boundary remains the shared production callback contract.

### Q4 — Registration failure gate

| Option | Description | Selected |
|--------|-------------|----------|
| Bounded retry then fail-closed | Retry transient transport errors; stop before crawler execution after the window or on identity errors. | ✓ |
| Immediate stop | Finish the workflow on the first registration error. | |
| Pending queue item | Leave the request pending for a later manual action. | |

**User's choice:** 1
**Notes:** Registration success is a prerequisite for crawler startup.

---

## Provider run correlation and status compensation

### Q1 — Provider binding evidence

| Option | Description | Selected |
|--------|-------------|----------|
| Workflow first-step signed binding | `provider_started` carries provider run, attempt, workflow, ref, sha, Environment, template and target. | ✓ |
| API search after dispatch | API finds the provider run through workflow/ref/input/time matching. | |
| Terminal-event binding | The first provider ID arrives with the terminal event. | |

**User's choice:** 1
**Notes:** Provider binding is accepted only when it matches the dispatch snapshot.

### Q2 — Status observation model

| Option | Description | Selected |
|--------|-------------|----------|
| Hybrid observation | Signed events carry business lifecycle; API polling supplies provider compensation signals. | ✓ |
| Provider status primary | GitHub polling owns lifecycle; callbacks mainly carry logs and receipt. | |
| Signed events primary | Polling begins only after heartbeat or status anomalies. | |

**User's choice:** 1
**Notes:** Polling covers missing callbacks, stalled provider state and terminal inconsistencies.

### Q3 — Provider mismatch

| Option | Description | Selected |
|--------|-------------|----------|
| Compensation quarantine | Record `provider_mismatch`, reconcile for a bounded window, then fail if unresolved. | ✓ |
| Immediate failure | End the attempt as soon as mismatch appears. | |
| Continue from signed event | Keep the run active when the callback signature is valid. | |

**User's choice:** 1
**Notes:** A later retry uses a new attempt after persistent mismatch.

### Q4 — Production success gate

| Option | Description | Selected |
|--------|-------------|----------|
| Three-way consistency | Provider success, matching signed terminal event and API-validated receipt are all required. | ✓ |
| Signed receipt primary | A valid signed receipt is enough while provider status catches up. | |
| GitHub success primary | Provider success and workflow exit code establish success. | |

**User's choice:** 1
**Notes:** Dispatch acceptance and process exit alone carry partial evidence only.

---

## Production cancellation, retry and lease recovery

### Q1 — Cancellation mapping

| Option | Description | Selected |
|--------|-------------|----------|
| Cooperative cancellation | Set `cancel_requested`, call provider cancel, stop at a safe checkpoint and sign `cancelled`. | ✓ |
| Provider cancel as terminal | GitHub acceptance immediately ends the application run. | |
| Workflow-owned cancellation | Workflow decides when to stop and API records the request. | |

**User's choice:** 1
**Notes:** Provider cancel acceptance is an intermediate signal; the signed terminal event closes the run.

### Q2 — Retry identity

| Option | Description | Selected |
|--------|-------------|----------|
| New D1 attempt and workflow run | Each confirmed retry has a new business attempt and provider run. | ✓ |
| Same D1 attempt with provider rerun | GitHub `run_attempt` distinguishes provider reruns. | |
| Stage-dependent hybrid | Provider rerun before start, new attempt after crawler start. | |

**User's choice:** 1
**Notes:** GitHub rerun remains a provider-infrastructure compensation tool.

### Q3 — Provider lost

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed-window failure | Record `provider_lost`, end the attempt and await an administrator-confirmed new attempt. | ✓ |
| One automatic compensation retry | Trigger one new provider run after the loss window. | |
| Keep waiting | Leave the run active until manual cancel or retry. | |

**User's choice:** 1
**Notes:** Automatic business retries remain disabled.

### Q4 — Partial ingestion and race

| Option | Description | Selected |
|--------|-------------|----------|
| Existing race contract | Validated receipt before cancellation takes effect wins; otherwise cancellation/failure remains terminal and writes stay auditable. | ✓ |
| Cancellation always wins | Any post-request success event stays outside the terminal state. | |
| Automatic rollback | Remove content written by the cancelled crawler. | |

**User's choice:** 1
**Notes:** Later retries use new attempts; existing data and audit summaries remain available.

---

## the agent's Discretion

- GitHub App metadata fields, provider REST client shape, API paths, migrations, event codes, backoff values, polling cadence, reconciliation window and fixture details.

## Deferred Ideas

- Full Dashboard operations, RUNBOOK updates and repeatable local/production CRUD evidence belong to Phase 19.
- Schedule policy editing, notifications, extra templates, concurrent execution and automatic retry remain future requirements.
