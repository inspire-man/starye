# API Coverage - Phase 25 Task Operations And Availability

> Full coverage by default. Phase 25 integrates repository-owned Hono, signed runner, Dashboard, Gateway, D1, local-proof, and existing GitHub Actions provider surfaces. Every deferred capability is an explicit, reasoned opt-out.

| capability | decision | reason |
|---|---|---|
| authenticated crawler-task creation | INTEGRATE | |
| paginated crawler-task list and bounded detail readback | INTEGRATE | |
| allowlisted task metadata update | INTEGRATE | |
| logical task archive with historical retention | INTEGRATE | |
| immutable task supersede with a new operation snapshot | INTEGRATE | |
| queued or running task cancellation | INTEGRATE | |
| bounded failed or cancelled task retry | INTEGRATE | |
| task-scoped audit, run, attempt, provider, receipt, transition, and log history | INTEGRATE | |
| signed runner poll and claim commands | INTEGRATE | |
| signed runner lifecycle event callback | INTEGRATE | |
| signed availability observation callback | INTEGRATE | |
| append-only availability observation persistence | INTEGRATE | |
| revision, policy, tuple, and projection CAS classification | INTEGRATE | |
| authoritative availability current and bounded history readback | INTEGRATE | |
| accepted, duplicate, conflict, stale, late, and rejected outcome projection | INTEGRATE | |
| bounded availability evidence validation and redaction | INTEGRATE | |
| Gateway cache invalidation after authoritative current readback | INTEGRATE | |
| typed Dashboard crawler-task API wrappers | INTEGRATE | |
| Dashboard task detail fact surfaces | INTEGRATE | |
| canonical authenticated Gateway proof at localhost port 8080 | INTEGRATE | |
| local-proof provider dispatch and local runner execution | INTEGRATE | |
| existing GitHub Actions provider dispatch and reconciliation | INTEGRATE | |
| client-provided workflow, URL, command, provider routing, or secrets | OPT-OUT | Server-owned operation registry and provider configuration intentionally exclude executable or sensitive client input. |
| raw or sensitive evidence persistence | OPT-OUT | The durable evidence contract permits only allowlisted, redacted, size-bounded facts and excludes provider responses, signed URLs, cookies, secrets, media, and unbounded values. |
| video direct-source and magnet or TorrServer availability checks | OPT-OUT | Specialized video availability and repair behavior belongs to Phase 26. |
| comic chapter completeness checks and targeted chapter repair | OPT-OUT | Chapter snapshot comparison and repair belongs to Phase 27. |
| chapter image availability checks and targeted image repair | OPT-OUT | Image probing, repair, and Reader acceptance belongs to Phase 28. |
| new scheduler or free-form operation surface | OPT-OUT | Phase 25 reuses the existing crawler task, run, attempt, lease, provider, and receipt control plane. |
| public evidence storage or public artifact endpoint | OPT-OUT | Phase evidence remains bounded and private; no new R2 or public artifact surface is introduced. |

## Verification Boundary

- Automated contract, repository, route, Dashboard, runner, proof-script, type-check, and service checks are recorded in the Phase 25 summaries and verification report.
- The remaining human checkpoint is an authenticated canonical Gateway run that produces a fresh task/run/attempt/provider tuple and confirms current/history, audit, receipt, and cache-refresh readback.
