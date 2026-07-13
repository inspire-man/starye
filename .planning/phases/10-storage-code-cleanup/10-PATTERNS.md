# Phase 10: Storage Code Cleanup - Patterns

**Mapped:** 2026-07-13
**Purpose:** 给 Phase 10 执行阶段提供最接近的实现模式、测试挂点和写集切分，避免把 storage cleanup 做成一次大范围重构。

## Pattern Summary

Phase 10 最值得复用的模式不是“已有完整 shared storage helper”，因为仓库里还没有；真正可复用的是：

- `@starye/api-types` 作为纯 contract 落点的现成边界
- API route 通过 route-local helper 接 shared constants 的方式
- crawler 在 `ImageProcessor` 这一单一 seam 做 fail-closed guard 的方式
- focused route / package Vitest 回归，而不是大而全的 end-to-end
- Phase 7 已有的 external-url tests，可直接复跑作为保护网

## File Classification

| New/Modified File | Role | Closest Analog | Match Quality |
|---|---|---|---|
| `packages/api-types/src/storage-purpose-policy.ts` | shared pure helper / contract | 当前同文件 + Phase 8 purpose map | exact |
| `packages/api-types/src/index.ts` | shared export barrel | 当前同文件 | exact |
| `packages/api-types/src/storage-purpose-policy.test.ts` | shared helper direct test | `packages/crawler/test/image-processor-purpose-policy.test.ts` | role-match |
| `apps/api/src/routes/upload/index.ts` | API upload consumer of shared helper | 当前同文件 | exact |
| `apps/api/src/routes/upload/__tests__/upload.route.test.ts` | API regression guard | 当前同文件 | exact |
| `packages/crawler/src/lib/image-processor.ts` | crawler upload seam | 当前同文件 | exact |
| `packages/crawler/test/image-processor-purpose-policy.test.ts` | crawler seam regression | 当前同文件 | exact |
| `apps/api/src/routes/admin/actors/index.ts` | actor pending heuristic | 当前同文件 | exact |
| `apps/api/src/routes/admin/publishers/index.ts` | publisher pending heuristic | 当前同文件 | exact |
| `apps/api/src/routes/admin/actors/__tests__/pending.test.ts` | actor heuristic regression | `apps/api/src/routes/public/comics/__tests__/public-comics.test.ts` | role-match |
| `apps/api/src/routes/admin/publishers/__tests__/pending.test.ts` | publisher heuristic regression | `apps/api/src/routes/public/comics/__tests__/public-comics.test.ts` | role-match |
| `packages/crawler/scripts/backfill-covers.ts` | legacy script semantics cleanup | 当前同文件 | exact |
| `packages/crawler/scripts/test-full-flow.ts` | smoke narrative cleanup | 当前同文件 | exact |
| `packages/crawler/scripts/test-single-movie.ts` | smoke narrative cleanup | 当前同文件 | exact |

## Shared Contract Patterns

### `packages/api-types` as the pure helper home

**Primary analog:** `packages/api-types/src/storage-purpose-policy.ts`

What already works:

- exports narrow purpose vocabularies
- keeps zero runtime I/O
- is already imported by API route and crawler source

Apply to Phase 10:

- keep all new exports pure
- accept data inputs like `timestamp`, `uniqueId`, `publicUrl`, `namespace`
- do not import platform APIs, env readers, or SDK clients here

### Export-barrel pattern

**Primary analog:** `packages/api-types/src/index.ts`

- shared helper additions should be re-exported from the barrel immediately
- avoid deep source-path-only imports as the long-term contract
- if some consumers temporarily keep deep imports for low blast radius, the plan should still centralize canonical exports in the barrel

## API Route Patterns

### Route-local parsing, shared pure builder

**Primary analog:** `apps/api/src/routes/upload/index.ts`

Reusable split:

- request parsing / auth / I/O stays local to the route
- purpose vocabulary, prefix resolution, and key-building logic come from the shared helper

Apply to Phase 10:

- keep `parseUploadPurpose()` near the request layer if that remains convenient
- move key-shape logic out to shared helper
- preserve the current response shape `{ id, url, key, size, mimeType }`

### Focused route tests

**Primary analog:** `apps/api/src/routes/upload/__tests__/upload.route.test.ts`

- lightweight mock app
- env + bucket + db mocked in-process
- status + returned payload asserted directly

Apply to Phase 10:

- extend, do not replace, the existing upload route regression
- add only enough assertions to prove the route is now consuming shared helpers

## Crawler Seam Patterns

### Single boundary guard

**Primary analog:** `packages/crawler/src/lib/image-processor.ts`

What already works:

- all necessary asset uploads converge here
- chapter-page rejection already happens before upload
- namespace validation is centralized

Apply to Phase 10:

- do not push guard logic back out into actor/publisher/comic callers
- reuse this seam, but have it consume shared helper logic instead of crawler-private helper logic

### Regression-first seam tests

**Primary analog:** `packages/crawler/test/image-processor-purpose-policy.test.ts`

- namespace allow/deny matrix already exists
- this is the natural place to prove shared helper adoption did not weaken policy

Apply to Phase 10:

- keep the current test file as the seam-level regression
- direct helper tests should live separately, not replace this seam test

## Admin Heuristic Patterns

### Preserve outward shape, fix inward semantics

**Primary analog:** `apps/api/src/routes/admin/actors/index.ts` and `publishers/index.ts`

What to reuse:

- keep `needsAvatarUpdate` / `needsLogoUpdate` output field names
- keep pending-route response shape and ordering

What to change:

- replace `startsWith(r2PublicUrl)`-style semantic checks with shared URL classification
- treat external URLs as valid terminal state when policy allows them
- reserve `needs*Update` for missing/invalid/actually incomplete assets

### Minimal route regression pattern

**Closest analog:** `apps/api/src/routes/public/comics/__tests__/public-comics.test.ts`

- route tests can stay Hono-local with mocked db and small fixtures
- no need to stand up wider admin stacks for this phase

## Legacy Script Cleanup Patterns

### Keep control flow, fix narration

**Primary analog:** `packages/crawler/scripts/backfill-covers.ts`

- the script already supports both R2-managed and fallback external outcomes
- Phase 10 should update comments, logs, and success wording before rewriting control flow

Apply to Phase 10:

- make success criteria “policy-compatible result”
- stop implying that fallback external URL is a degraded but incorrect terminal state
- only widen code changes if grep reveals another directly adjacent script with the same hardcoded assumption

### Smoke script assertions as source-level guard

**Primary analog:** `packages/crawler/scripts/test-full-flow.ts`

- these scripts are not under formal unit coverage
- their strongest guard is explicit wording / printed success checklist

Apply to Phase 10:

- source assertions are acceptable for script wording cleanup
- do not over-invest in building a heavy script test harness in this phase

## Existing Coverage to Reuse

| Area | File | Reuse Guidance |
|------|------|----------------|
| comic public external URL contract | `apps/api/src/routes/public/comics/__tests__/public-comics.test.ts` | rerun as-is; no need to rewrite unless helper refactor accidentally touches route behavior |
| Reader failure behavior | `apps/comic-app/src/views/__tests__/Reader.test.ts` | rerun as-is to prove Phase 10 did not regress the external-image UX locked in Phase 7 |
| upload purpose contract | `apps/api/src/routes/upload/__tests__/upload.route.test.ts` | extend with shared-helper adoption checks, not a new parallel upload suite |
| crawler namespace guard | `packages/crawler/test/image-processor-purpose-policy.test.ts` | keep as the seam-level protection after helper extraction |

## Recommended Write-Set Split

### Plan 10-01

- `packages/api-types/src/storage-purpose-policy.ts`
- `packages/api-types/src/index.ts`
- `packages/api-types/src/storage-purpose-policy.test.ts`
- `apps/api/src/routes/upload/index.ts`
- `apps/api/src/routes/upload/__tests__/upload.route.test.ts`

### Plan 10-02

- `packages/crawler/src/lib/image-processor.ts`
- `packages/crawler/test/image-processor-purpose-policy.test.ts`
- `apps/api/src/routes/admin/actors/index.ts`
- `apps/api/src/routes/admin/publishers/index.ts`
- `apps/api/src/routes/admin/actors/__tests__/pending.test.ts`
- `apps/api/src/routes/admin/publishers/__tests__/pending.test.ts`

### Plan 10-03

- `packages/crawler/scripts/backfill-covers.ts`
- `packages/crawler/scripts/test-full-flow.ts`
- `packages/crawler/scripts/test-single-movie.ts`

This split keeps Wave 2 mostly disjoint: plan 10-02 owns runtime consumers, while 10-03 owns legacy script semantics and verification-facing wording.
