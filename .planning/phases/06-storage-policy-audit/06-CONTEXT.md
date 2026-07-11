# Phase 6: Storage Policy Audit - Context

**Gathered:** 2026-07-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 6 establishes the exact R2, D1, and external URL storage boundary before any deletion or rewrite work. It must produce a storage policy, inventory current R2 write paths and non-upload chapter image boundaries, and define a dry-run R2 audit plan. It does not delete R2 objects, migrate upload code, rename database fields, or implement Phase 8 enforcement.

</domain>

<decisions>
## Implementation Decisions

### R2 Allowed and Forbidden Boundaries
- **D-01:** Use an explicit R2 allowlist. Anything not listed is forbidden by default or requires separate approval before planning.
- **D-02:** Normal allowed R2 purposes are necessary assets such as `covers/`, `avatars/`, `logos/`, `fallback/`, and `manual-assets/`.
- **D-03:** `mappings/` is a restricted allowed prefix. It may remain in R2, but `mappings/backups/` must have backup count, lifecycle, or growth audit controls.
- **D-04:** `tmp/`, `crawler-debug/`, and `import-staging/` are short-term allowed prefixes only when the policy records purpose, default retention window, and audit rules.
- **D-05:** Historical generic `images/` is a risk pending classification. Phase 6 must audit objects and DB references under it, but not delete or rename them.
- **D-06:** Forbidden uses include comic chapter body images, bulk comic page mirrors, Worker/Pages Function image proxy caches, long-term debug dumps, and any unlisted R2 purpose.

### Current Upload Entry Inventory Scope
- **D-07:** Inventory each R2 write entry with direct callers and produced prefixes. Record owner module or script, direct caller, generated key prefix, DB write/reference behavior, documentation references, and risk classification.
- **D-08:** Historical docs that declare R2 behavior must be listed separately as documentation-declared entries. This includes `docs/r2-mapping-*` guidance and task summaries, but full documentation restructuring remains Phase 9 scope.
- **D-09:** One-off, verification, and backfill scripts are in scope for inventory. Classify them by runnable risk: production schedule, manual operation, test verification, or historical script.
- **D-10:** Include comic chapter body image paths as non-upload boundaries. These paths preserve or return source/external URLs and must not call R2. This becomes a regression baseline for later phases.

### R2 Dry-Run Audit Report Shape
- **D-11:** The dry-run audit artifact is human-readable first and machine-processable second. Produce a Markdown report plus JSON or CSV details for Phase 8/10 automation.
- **D-12:** Each prefix/object group must include `prefix`, object count, rough size, sample keys, last-modified range, DB reference hits, referenced tables/fields, risk levels, and recommended action.
- **D-13:** Use dual-axis risk: `delete_risk` covers DB references, unknown purpose, and accidental deletion impact; `cost_risk` covers volume, growth, forbidden prefixes, and restricted prefixes. The report should also include a combined recommendation.
- **D-14:** Phase 6 must not delete any R2 object. Any deletion requires a later phase or separate explicit confirmation based on the dry-run report.

### Storage Naming and Documentation Semantics
- **D-15:** Prefer source-based naming in future docs and code: `sourceImageUrl` or `externalImageUrl` means source-site/external URL; `r2Key` and `r2Url` mean R2-backed asset.
- **D-16:** Existing `chapter.pages.image_url` and public API `images: string[]` are historical fields whose semantics are locked to source/external URLs. Phase 6 does not require immediate DB/API renaming.
- **D-17:** R2 assets should be represented as `r2Key` plus `r2Url`. `r2Key` is object identity for audits and DB reference checks; `r2Url` is only the display/access URL.
- **D-18:** Documentation must split storage, proxying, and caching terminology. R2 storage, Worker/Pages Function proxying, and CDN/browser caching are separate concepts; chapter image proxying and proxy caching are forbidden by default.

### the agent's Discretion
None. The user selected explicit decisions for every discussed gray area.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Planning and Requirements
- `.planning/PROJECT.md` — v1.1 milestone goal, storage constraints, and key decisions around R2, source URLs, and Worker proxy avoidance.
- `.planning/REQUIREMENTS.md` — Phase 6 requirements `STOR-01` through `STOR-04`, plus later requirements that depend on this boundary.
- `.planning/ROADMAP.md` — Phase 6 goal and success criteria; especially the no-deletion audit boundary.
- `.planning/research/SUMMARY.md` — Cloudflare cost findings, recommended R2 allowlist, forbidden uses, and watch-outs.

### Codebase Maps
- `.planning/codebase/STACK.md` — Cloudflare Workers/Pages, D1/R2/KV, crawler, Wrangler, and R2 SDK context.
- `.planning/codebase/ARCHITECTURE.md` — API, data, frontend, crawler, and gateway layering.
- `.planning/codebase/INTEGRATIONS.md` — R2 bucket, bindings, public URL, crawler secrets, GitHub Actions, and external service wiring.

### R2 Write Entries and Storage Helpers
- `apps/api/src/routes/upload/index.ts` — Current API upload route writes `images/<timestamp>-<nanoid>.<ext>` to R2 and inserts `media` metadata.
- `apps/api/src/lib/r2.ts` — S3-compatible R2 client and presigned upload helper.
- `packages/crawler/src/lib/image-processor.ts` — Crawler image downloader/processor that uploads variants to R2 via `@aws-sdk/lib-storage`.
- `packages/crawler/src/lib/mapping-file-manager.ts` — Mapping file R2 upload and backup behavior under `mappings/`.

### Comic External URL Semantics
- `packages/db/src/schema.ts` — `media.key`, `media.url`, `comics.cover_image`, and `chapter_pages.image_url` storage fields.
- `apps/api/src/routes/public/comics/index.ts` — Public chapter API returns `images: chapter.pages.map(p => p.imageUrl)`.
- `packages/crawler/src/crawlers/comic-crawler.ts` — Comic crawler cover handling and chapter image URL collection path.

### Historical R2 Documentation to Audit
- `docs/r2-mapping-storage-setup-guide.md` — Historical mapping storage setup guidance.
- `docs/r2-mapping-storage-implementation-report.md` — Historical implementation details for R2 mapping storage.
- `docs/r2-mapping-quick-deploy-guide.md` — Historical deploy guidance for mapping R2 usage.
- `docs/r2-mapping-env-vars-guide.md` — Historical R2 mapping environment variable guidance.
- `docs/r2-mapping-deployment-checklist.md` — Historical mapping deployment checklist.
- `docs/r2-mapping-usage-examples.md` — Historical examples for mapping storage usage.
- `docs/task-15.7-r2-storage-completion-summary.md` — Historical task summary describing automatic R2 mapping uploads.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/api/src/routes/upload/index.ts`: Existing server-side R2 binding path, MIME/extension validation, media metadata insert, and current generic `images/` prefix.
- `apps/api/src/lib/r2.ts`: Existing S3-compatible R2 client creation and presigned URL helper.
- `packages/crawler/src/lib/image-processor.ts`: Existing R2 image processing pipeline with generated `thumb`, `preview`, and `original` variants.
- `packages/crawler/src/lib/mapping-file-manager.ts`: Existing mapping upload path and backup key generation under `mappings/`.
- `packages/db/src/schema.ts`: Existing `media` and comic chapter image fields for DB reference checks.

### Established Patterns
- API routes use Hono handlers with service auth and D1/R2 Cloudflare bindings.
- Crawler code uses Node scripts/classes, environment-provided R2 config, and AWS S3-compatible clients.
- Public comic chapter API currently returns plain `images: string[]`, so semantics must be documented before any later API shape change.
- Existing R2 uploads mix code paths and historical docs, so the audit needs both runtime entries and documentation-declared entries.

### Integration Points
- R2 audit planning connects to API upload, crawler image processing, mapping file upload, backfill/verification scripts, D1 `media` metadata, and comic chapter page URL fields.
- Later Phase 8 enforcement should use this phase's allowlist and forbidden-use vocabulary.
- Later Phase 10 cleanup should use this phase's naming semantics and inventory rather than rediscovering storage boundaries.

</code_context>

<specifics>
## Specific Ideas

- `mappings/` remains allowed only as a restricted prefix because the existing dashboard/crawler mapping workflow depends on it, but backups must not grow without controls.
- `images/` must be treated as ambiguous historical debt, not a valid future-purpose prefix.
- Audit reports should separate cost risk from delete risk so "expensive" and "unsafe to delete" are not collapsed into one vague severity.
- Existing `image_url` and `images` names are tolerated for now only as historical names; their intended meaning is source/external URL.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 6-Storage Policy Audit*
*Context gathered: 2026-07-11*
