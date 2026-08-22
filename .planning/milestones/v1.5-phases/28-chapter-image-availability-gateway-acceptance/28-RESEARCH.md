---
phase: 28-chapter-image-availability-gateway-acceptance
status: complete
---

# Phase 28 Research

## Existing boundaries

- `page` rows keep external image URLs and `syncChapterData` already rejects empty and regressed page sets.
- The current admin integrity route performs a temporary HEAD/Range probe but does not persist observations and treats every sub-400 response as healthy.
- The Reader consumes the public chapter response and reports browser load failures independently from API availability.
- `crawler_availability_observation/current` already provides a bounded revision/CAS projection for chapter and image target kinds.
- Existing crawler tasks use signed runner callbacks and a server-owned operation snapshot; a chapter/page repair should carry its binding in that snapshot rather than introduce a scheduler.

## Decisions

1. Page identity is the normalized source URL plus source page ordinal; stored page number remains the local display order. Duplicate URL/ordinal pairs are retained in observations and surfaced as findings.
2. A page probe is `available` only for a successful response with an image content type and a bounded non-HTML prefix. Manual redirects, challenge HTML and invalid content types are distinct reasons.
3. Observation samples contain page number, bounded URL identity, status, content type, redirect flag and reason only. Query strings are stripped from public/admin read models.
4. Page repair commands bind comic, chapter, page identity set, source revision, finding code and policy version. Empty or regressed results do not replace the current projection.
5. Fresh acceptance is a new task/run/attempt/provider tuple with D1 readback before cache invalidation and Reader navigation.

## Verification strategy

- Pure tests cover URL normalization, duplicate/order/count findings, content sniffing and redirect/challenge classification.
- API tests cover persisted observation/current projection, stale/late callbacks, idempotent repair commands and redacted readback.
- Crawler tests cover bounded image probes and optional manga chapter binding while ordinary manga/video candidates remain unchanged.
- Gateway acceptance records task, run, attempt, provider, observation identity, projection version, Reader API response and browser page-load evidence.
