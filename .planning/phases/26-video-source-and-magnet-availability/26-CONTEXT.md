# Phase 26: Video Source And Magnet Availability - Context

**Gathered:** 2026-08-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver a revision-bound video availability model and user workflow that keeps movie metadata persistence, direct-source transport evidence, magnet/TorrServer progress, and actual playback readiness as separate facts. The phase adds bounded checks and reason-specific recheck or repair actions through the existing crawler task control plane; it does not introduce a second scheduler, treat provider acceptance as content availability, or make R2 a video host.

</domain>

<decisions>
## Implementation Decisions

### Availability Status Hierarchy
- **D-01:** Movie detail and task-result surfaces always show metadata persisted, direct source, magnet source, and playback readiness as four independent layers. Success in one layer never hides failure or uncertainty in another.
- **D-02:** When a layer has multiple sources, its summary shows the best available result together with available and abnormal source counts. Individual source facts remain available below the summary.
- **D-03:** An expired observation preserves its last determinate result, observation time, and evidence identity but is marked `stale` with a recheck prompt. Staleness does not erase historical truth or silently imply current availability.
- **D-04:** The overall user-facing status is driven primarily by playback readiness. When playback is failed or unknown, the summary explains useful lower-layer facts such as source available but playback not yet verified.

### Direct Source Classification
- **D-05:** Direct sources use staged probing: URL validation, bounded HTTP redirects, a small Range request, then a controlled browser only for challenges, contradictory responses, or uncertain media type.
- **D-06:** `available` requires a successful final response plus credible media `Content-Type` or bounded byte evidence. Redirect count and response size must remain inside the active probe policy.
- **D-07:** Anti-hotlinking, CAPTCHA, JavaScript challenges, and required-header barriers are `blocked`, with the blocking reason retained. A result may upgrade to `available` only after the controlled browser loads media successfully.
- **D-08:** Timeouts, DNS failures, and probe infrastructure errors are `uncertain`, not source failure. Preserve the most recent determinate observation and mark it stale or pending recheck.

### Magnet And TorrServer Classification
- **D-09:** Magnet syntax, metadata, peer/download progress, stream readiness, and playback readiness are independent facts. Magnet syntax validity, resolver acceptance, metadata, or peers alone never establish user availability.
- **D-10:** Metadata success without a peer or download progress in the bounded window becomes `no_peer` or `stalled`, while preserving the metadata success fact and allowing a later recheck.
- **D-11:** A generated TorrServer stream endpoint is `stream_ready`; it becomes `playback_ready` only after controlled evidence of real player consumption.
- **D-12:** Aria2/TorrServer reachability, authentication, and resolver errors are provider failures such as `provider_unavailable`, `auth_failed`, or `resolver_failed`. They do not prove the magnet content is unavailable.

### Recheck And Repair Experience
- **D-13:** Each abnormal finding emphasizes one reason-specific action: recheck for `stale` or `uncertain`, repair for `blocked` or `source_failed`, and service-configuration guidance for provider failures.
- **D-14:** Recheck and repair progress stays inline with the finding and displays the receipt plus `queued`, `running`, and `readback` stages. Current projection changes only after authoritative readback for the same movie/source revision.
- **D-15:** A successful result for an old movie/source revision is retained in history, clearly labeled as old-revision evidence, and never promoted to current. The UI prompts a new check for the current revision.
- **D-16:** Findings default to a concise status, reason, freshness, revision, and receipt summary. Expanded detail is bounded and redacted: no full URLs, signed material, credentials, raw responses, cookies, or unbounded media samples.

### Agent Discretion
- Exact freshness windows, retry counts, redirect limits, byte-sample sizes, timeout values, and browser escalation thresholds are planner/researcher decisions, provided they are bounded and policy-versioned.
- Exact component composition and labels may follow existing Dashboard and MovieDetail conventions while preserving the four-layer facts and reason-specific actions above.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product And Phase Contract
- `.planning/PROJECT.md` - Product value, hosting boundaries, and the decision to use existing magnet/TorrServer paths instead of R2 video hosting.
- `.planning/REQUIREMENTS.md` - Canonical VID-01 through VID-05 requirements and the later Gateway evidence boundary.
- `.planning/ROADMAP.md` - Phase 26 goal, success criteria, dependency, and planned four-part delivery sequence.
- `.planning/STATE.md` - Current milestone constraints and carried-forward source/readiness decisions.

### Upstream Availability Contract
- `.planning/phases/25-task-operations-and-availability-contract/25-06-SUMMARY.md` - Authoritative availability ownership, receipt/readback, task-scoped audit, bounded redaction, and cleanup guarantees inherited by this phase.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/db/src/schema.ts` - Existing `movieSourceStates`, `movieSourceObservations`, `crawlerAvailabilityObservations`, `crawlerAvailabilityCurrent`, playback evidence, source revision, and Aria2 configuration tables provide the persistence baseline.
- `apps/api/src/routes/aria2/services/aria2-proxy.service.ts` - Existing authenticated, bounded Aria2 JSON-RPC proxy is the controlled provider boundary.
- `apps/movie-app/src/composables/useAria2.ts` and `apps/movie-app/src/composables/useAria2WebSocket.ts` - Existing Aria2 task submission and status mechanisms can inform provider-state integration without becoming the availability authority.
- `apps/dashboard/src/lib/api.ts` - Existing source, playback, availability, repair, receipt, and readback contracts are the frontend type boundary to extend.
- `apps/movie-app/src/views/MovieDetail.vue` and `apps/movie-app/src/views/Player.vue` - Existing source selection and player surfaces are the user-facing readback and playback evidence integration points.

### Established Patterns
- Availability evidence is append-first; current projections are promoted only after revision/policy checks and authoritative D1 readback.
- Task/run/attempt/provider success, content availability, and actual playback are separate facts.
- Commands remain immutable, revision-bound, idempotent, CAS-protected, and auditable through receipts.
- Evidence is bounded and redacted before persistence or display, and canonical local acceptance goes through `http://localhost:8080/...`.

### Integration Points
- Extend the Phase 25 availability operation registry and signed observation boundary for direct and magnet probe operations.
- Project per-source and aggregate results through the existing crawler task APIs into Dashboard and movie detail responses.
- Use existing cache invalidation only after authoritative projection readback; retain old-revision results in history.
- Feed controlled player consumption evidence into playback readiness without treating generated stream URLs as playback proof.

</code_context>

<specifics>
## Specific Ideas

- A compact layer summary may read like `available 2 / abnormal 1`, with each source and its freshness available on expansion.
- Lower-layer success should produce explicit messages such as `source available, playback not yet verified` instead of a generic unknown state.
- Provider failures should lead users toward configuration diagnosis rather than a content-repair action.

</specifics>

<deferred>
## Deferred Ideas

None - discussion stayed within phase scope.

</deferred>

---

*Phase: 26-video-source-and-magnet-availability*
*Context gathered: 2026-08-12*
