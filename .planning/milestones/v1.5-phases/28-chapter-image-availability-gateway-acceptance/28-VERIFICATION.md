---
phase: 28-chapter-image-availability-gateway-acceptance
verified: 2026-08-22T06:20:00+08:00
status: passed
score: 7/7 must-haves verified
verification_mode: goal-backward, full tests, canonical Gateway, D1 observation/current readback, Dashboard and Reader browser evidence
---

# Phase 28 Verification

| # | Observable truth | Status | Evidence |
|---|---|---|---|
| 1 | Page identity/count/order and bounded image probe facts are persisted. | VERIFIED | Local D1 page observations contain page identity, page number, HTTP status, content type, reason and redacted URL identity. |
| 2 | HTTP 200 alone does not determine image availability. | VERIFIED | Probe tests cover content type, challenge HTML, redirect, HTTP failure, timeout and malformed URL; current status is derived from bounded probe facts. |
| 3 | Current projection is revision/policy/CAS protected and targeted recheck preserves good pages. | VERIFIED | Page repository merge test and two same-revision checks moved current projection from version 1 to 2 without losing 2/2 available pages. |
| 4 | Dashboard can submit a chapter/page operation using server-owned revision binding. | VERIFIED | Dashboard `Phase 27 MVP Comic` chapter drawer submitted `检查页面`; task response and page current readback surfaced in the same drawer. |
| 5 | Runner result, provider association, observation and terminal receipt are independently visible. | VERIFIED | Latest tuple provider `local-proof`, run `succeeded`, D1 observations `event_sequence=5`, terminal event sequence 8, receipt schema 2. |
| 6 | Public Reader receives bounded page projection on the same revision. | VERIFIED | `GET /api/public/comics/phase27-mvp-comic/chapters/chapter-1` returned page status `available`, 2/2, policy `chapter-page-probe/v1`, revision 1. |
| 7 | Reader actual consumption is proven by browser image state, not API status alone. | VERIFIED | Browser loaded `/comic/phase27-mvp-comic/read/chapter-1`; two page images were complete with natural dimensions `100x100` and `239x178`. |

## Automated Verification

- API full suite: 83 files / 625 tests passed.
- Crawler full suite: 33 files / 181 tests passed.
- Dashboard full suite: 14 files / 161 tests passed.
- Comic App full suite: 4 files / 15 tests passed.
- DB migration regression test passed; local migration apply/readback passed.
- API, crawler, dashboard and DB type-check/lint passed.

## Evidence Boundary

Only bounded tuple ids, revisions, statuses, counts, event sequence and image dimensions are retained here. Cookies, callback secrets, signed material, raw responses and media bytes are excluded.
