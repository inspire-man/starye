---
phase: 27-comic-chapter-completeness
status: complete
---

# Phase 27 Research

## Existing boundaries

- `syncMangaData` currently deletes and rebuilds chapters, which loses the durable comparison boundary when a later sync is partial.
- `syncChapterData` already protects against empty and regressed page sets; the same protection must remain when chapter repair is introduced.
- Comic source rows are available from the crawler manga payload as title, slug, number and URL. The source snapshot must preserve duplicate rows before any normalization or upsert.
- Crawler tasks already persist an immutable server-owned operation snapshot and share one D1 run/attempt/lease/provider control plane. Chapter operations should extend the manga intent rather than introduce another scheduler.
- The existing availability observation/current tables can represent a bounded chapter projection, but chapter findings need a durable typed read model and source snapshot rows for audit.

## Decisions

1. Stable chapter identity is derived from the normalized source slug, with URL normalization only as a fallback. Source rows remain append-only even when identities duplicate.
2. A source snapshot is captured before chapter upsert and receives a monotonic comic-local source revision and terminal state (`complete`, `partial`, `unavailable`, `inconclusive`).
3. Stored chapters are upserted and missing source rows are retained in the snapshot; the sync path no longer deletes the whole comic chapter set.
4. Completeness projection compares identity sets, duplicate rows, source ordinal, numeric sequence and stored order. Findings are bounded and redacted.
5. Targeted check/recheck/repair commands are revision-bound, finding-bound and idempotent. They use the existing `manga` task template and carry chapter binding in the server-owned operation intent/dispatch candidate.
6. Empty or regressed chapter results never replace a known-good page set. Authoritative readback is required before a projection is promoted.

## Risks

- Historical tasks have ordinary manga snapshots and must keep parsing exactly as before.
- Provider workflows accept the manga template but do not know chapter intent today; the local/production runner candidate needs an optional bounded chapter binding while retaining the existing template snapshot shape.
- Existing fixtures mock only the small Drizzle surface. New persistence helpers must remain injectable and testable without requiring a full D1 instance.

## Verification strategy

- Pure identity/comparison contract tests cover missing, duplicate, order, sequence, source terminal and bounded finding behavior.
- Sync route tests prove snapshot-before-upsert, no delete-and-rebuild, empty-result protection and monotonic revision.
- Task command tests prove revision/finding binding and idempotency.
- Runner tests prove optional chapter binding is rejected when malformed and passed unchanged to the manga adapter.
- Canonical Gateway checks use a fresh task/run/attempt/provider tuple and D1 readback.
