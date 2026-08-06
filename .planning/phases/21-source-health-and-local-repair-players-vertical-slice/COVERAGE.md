# API Coverage — Phase 21 Internal Repair Control Plane

> Full coverage by default. This phase integrates repository-owned Hono and signed runner control surfaces; no new external provider SDK or service is added.

| capability | decision | reason |
|---|---|---|
| authenticated repair command | INTEGRATE | Core REP-01 capability at the dedicated admin route. |
| current movie disposition and source revision reread | INTEGRATE | Required to bind the command to current server state. |
| signed source observation callback | INTEGRATE | Required for the local adapter to submit bounded observations through the controlled API boundary. |
| authoritative source readback | INTEGRATE | Required before a repair receipt or succeeded state is exposed. |
| operation-specific repair receipt | INTEGRATE | Required to keep repair proof distinct from ordinary movie receipts. |
| event replay/conflict handling | INTEGRATE | Required for idempotent lifecycle behavior and stale protection. |
| bounded automatic retry | INTEGRATE | Required for the single additional attempt rule. |
| manual new-task retry | INTEGRATE | Required to reread current source state before a new task. |
| local Gateway vertical proof | INTEGRATE | Required by the Phase 21 success criteria. |
| external provider dispatch | OPT-OUT | This phase proves the local control plane; provider execution belongs to the later production repair boundary. |
| browser playback actions | OPT-OUT | Source health and repair readback remain separate from actual playback behavior. |
| production repair reconciliation | OPT-OUT | The local fixture is the selected execution environment for this phase. |
| fresh production playback evidence | OPT-OUT | This phase records local command/task/source evidence and excludes production playback proof. |
| broad content-type repair templates | OPT-OUT | The task contract is scoped to one movie and one repair_players operation. |
