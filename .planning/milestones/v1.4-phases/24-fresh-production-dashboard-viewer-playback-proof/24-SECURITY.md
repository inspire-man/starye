---
phase: 24
slug: fresh-production-dashboard-viewer-playback-proof
status: verified
threats_open: 0
asvs_level: 1
created: 2026-08-10
---

# Phase 24 - Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Browser/verifier -> API DTO | Browser observations enter schema validation. | Bounded media events, progress samples, tuple identity |
| API DTO -> artifact/D1 | Only closed, redacted, finite fields cross persistence boundaries. | Redacted summary, hash, reference, rejection facts |
| Gateway browser -> production repair/provider | Authenticated Dashboard actions cross into server-owned provider lifecycle. | Session, selected registry target, task/run/attempt tuple |
| D1/artifact root -> human report | Persisted evidence is projected as immutable, redacted facts. | Allowlisted evidence summary and bounded history |
| Dashboard browser -> Gateway | User interaction and query parameters remain untrusted. | Server-owned task and movie identity |
| API DTO -> Vue template | Display fields are allowlisted at the rendering boundary. | Bounded status, tuple, source, receipt, and playback facts |
| MovieDetail/Player -> evidence harness | Only visible user-observable playback facts are collected. | Play action, allowlisted media events, currentTime samples |
| Player route -> API | Ordinary playback is read-only and does not write privileged evidence. | Same-movie route context without raw media URLs |

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-24-01 | Tampering | playback evidence schema/projection | high | mitigate | Closed Valibot DTO, tuple/content/source-revision checks, and conservative projection tests. | closed |
| T-24-02 | Information Disclosure | redaction.ts | high | mitigate | Allowlist object construction and forbidden key/value scans before artifact or D1 use. | closed |
| T-24-03 | Repudiation | outcome/history types | medium | mitigate | Explicit accepted, duplicate, conflict, stale, late, and ignored outcomes remain typed facts. | closed |
| T-24-04 | Denial of Service | event/progress bounds | medium | mitigate | Event count, string lengths, retries, timestamps, and observation-window values are finite. | closed |
| T-24-05 | Spoofing | evidence POST session | high | mitigate | Authenticated admin session and task/run/attempt ownership checks protect the Gateway route. | closed |
| T-24-06 | Tampering | evidence repository | high | mitigate | Tuple validation, hash conflict detection, and CAS transaction ordering preserve the first valid fact. | closed |
| T-24-07 | Repudiation | rejection history | medium | mitigate | Duplicate, conflict, stale, late, and ignored outcomes are appended with bounded stable codes. | closed |
| T-24-08 | Information Disclosure | task detail DTO | high | mitigate | Server-owned allowlist excludes raw URLs, signatures, tokens, cookies, and runner payloads. | closed |
| T-24-09 | Denial of Service | POST/replay path | medium | mitigate | One bounded terminal summary per tuple, finite schema limits, and indexed idempotency lookup. | closed |
| T-24-10 | Spoofing | repair confirmation | high | mitigate | Only server-validated movie identity, reason, and intent cross the authenticated Gateway command. | closed |
| T-24-11 | Tampering | current-attempt projection | high | mitigate | Only server latestRunId/current attempt is promoted; older history remains bounded and immutable. | closed |
| T-24-12 | Information Disclosure | Crawlers.vue | high | mitigate | Dashboard renders the API allowlist; regression tests reject raw URL, token, cookie, signature, and runner fields. | closed |
| T-24-13 | Repudiation | status/history UI | medium | mitigate | Bounded timestamps, tuple identity, and stable duplicate/conflict/late/stale/ignored outcomes are visible. | closed |
| T-24-14 | Denial of Service | polling lifecycle | medium | mitigate | Polling runs only while visible, uses a bounded interval, stops on hidden/unmount, and retains last valid data. | closed |
| T-24-15 | Tampering | Player success state | high | mitigate | Visible click, canplay, playing, two samples, one-second delta, and no terminal error are required. | closed |
| T-24-16 | Information Disclosure | source cards/player state | high | mitigate | Only source type, health, and bounded reason are rendered; raw media URL and signed material stay excluded. | closed |
| T-24-17 | Denial of Service | source retry/fallback | medium | mitigate | Visited attempts are tracked, the current source has a retry cap, and candidate exhaustion terminates. | closed |
| T-24-18 | Spoofing | same-movie Viewer handoff | medium | mitigate | Server-owned content code/source revision and existing route are used instead of caller-supplied URLs. | closed |
| T-24-19 | Repudiation | media event timeline | medium | mitigate | Observed and not-observed allowlisted events use bounded timestamps and source attempts. | closed |
| T-24-20 | Spoofing | production session/target | high | mitigate | Signed authenticated Dashboard session and registry-selected target are required before dispatch. | closed |
| T-24-21 | Tampering | production tuple/matrix | high | mitigate | Fresh IDs are generated from the command path and live, D1, artifact, and UI identities are compared. | closed |
| T-24-22 | Repudiation | proof report/history | medium | mitigate | Immutable JSON/Markdown pair and bounded outcome/rejection history preserve pass, fail, and checkpoint facts. | closed |
| T-24-23 | Information Disclosure | artifact/report | high | mitigate | Allowlist redaction scans JSON and Markdown before D1 reference submission. | closed |
| T-24-24 | Denial of Service | browser/provider orchestration | medium | mitigate | Preconditions, provider window, media observation, retries, and proof reruns are bounded. | closed |
| T-24-25 | Elevation of Privilege | verifier endpoint | high | mitigate | The verifier never writes privileged D1 directly; Gateway session and server-side tuple authorization are required. | closed |

*Status: open - closed. Open threats at or above the configured high threshold count toward `threats_open`.*
*Disposition: mitigate (implementation required) - accept (documented risk) - transfer (third-party).*

## Accepted Risks Log

No accepted risks.

## Audit Notes

- The formal STRIDE registers are authored in `24-01-PLAN.md` through `24-05-PLAN.md`.
- The 15-item Phase 24 UAT is complete with 15 passes and 0 issues.
- The production proof checkpoint remains a separate evidence boundary. This security audit verifies the implemented controls and does not claim production playback from local fixtures or historical Phase 13 artifacts.

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-08-10 | 25 | 25 | 0 | Codex / gsd-secure-phase |

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-08-10
