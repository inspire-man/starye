---
phase: 10-storage-code-cleanup
plan: "01"
subsystem: shared-storage-contract
tags: [storage, api-types, upload, policy]
requirements-completed:
  - CODE-01
  - CODE-02
completed: 2026-07-13
status: complete
---

# Phase 10 Plan 01 Summary

## Accomplishments

- 扩展 `packages/api-types/src/storage-purpose-policy.ts`，把 manual upload purpose/prefix contract 扩成 shared pure helper：新增 `buildManualUploadObjectKey()`、`resolveCrawlerManagedAssetPrefix()` 和 `classifyStorageUrlKind()`。
- 新建 `packages/api-types/src/storage-purpose-policy.test.ts`，直接锁住 manual key shape、crawler namespace allowlist 和 managed-vs-external URL classification。
- `apps/api/src/routes/upload/index.ts` 去掉 route 私有 key builder，改成直接消费 shared helper，继续保持现有 response shape 和 approved prefix contract。
- `apps/api/src/routes/upload/__tests__/upload.route.test.ts` 改成固定 `Date.now()`/`nanoid()`，精确锁住 `covers/manual/...` 与 `manual-assets/blog-inline/...` key shape。

## Verification

- `pnpm --filter @starye/api-types exec vitest run src/storage-purpose-policy.test.ts`
- `pnpm --filter @starye/api-types exec tsc --noEmit`
- `pnpm --filter api exec vitest run src/routes/upload/__tests__/upload.route.test.ts`
- `pnpm --filter api exec tsc --noEmit`

## Notes

- 这一 plan 只收口 pure helper，没有引入新的 shared runtime service，也没有修改既有 key/prefix contract。
- upload route 仍保留 request parsing、multipart 校验、R2 put 和 `media` metadata insert 的 route-local 职责；变化点只在 key 语义的 canonical owner。
