---
phase: 08-cost-guardrails
plan: 01
subsystem: api-dashboard-upload
tags: [api, dashboard, upload, r2, guardrails]
requirements-completed:
  - COST-01
completed: 2026-07-13
---

# Phase 8 Plan 01 Summary

## Accomplishments

- `packages/api-types/src/storage-purpose-policy.ts` 新增 Phase 8 manual upload purpose contract，固定 7 个 allowed purposes 和它们的 approved prefixes。
- `apps/api/src/routes/upload/index.ts` 改成必填 `purpose` 的 multipart contract，显式拒绝缺失 purpose、未知 purpose 和 `comic_chapter_page` intent，并移除了新的 `images/` key 生成路径。
- `apps/dashboard/src/lib/api.ts` 收口成统一的 `upload.uploadImage(file, purpose)` helper；`PostEditor.vue` 现在走 `blog_inline`，`Comics.vue` 的封面编辑页走 `cover`，`ImageUpload.vue` 默认走 `manual_asset`。
- `apps/api/src/routes/upload/__tests__/upload.route.test.ts` 与 `apps/dashboard/src/views/__test__/Comics.test.ts` 锁定了 cover/blog_inline prefix mapping 和 comic cover upload contract。

## Verification

- `pnpm --filter api exec vitest run src/routes/upload/__tests__/upload.route.test.ts`
- `pnpm --filter dashboard exec vitest run src/views/__test__/Comics.test.ts`
- `rg -n "/upload/presign|blog_inline|manual_asset|cover" apps/dashboard/src apps/api/src/routes/upload/index.ts packages/api-types/src/storage-purpose-policy.ts`

## Notes

- `api.upload.presign` 已从 dashboard client helper 移除，comic cover 不再绕过 `/api/upload` 的 purpose guard。
- Phase 8 只收紧 manual upload entrypoint，不在本 plan 内统一所有 legacy upload UI 的组件结构。
