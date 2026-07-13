---
phase: 07-comic-external-image-flow
plan: 02
subsystem: api-contract
tags: [api, public-contract, admin, integrity, ssrf]
requirements-completed:
  - COMIC-03
  - COMIC-05
completed: 2026-07-13
---

# Phase 7 Plan 02 Summary

## Accomplishments

- `apps/api/src/routes/public/comics/index.ts` 的 public chapter route 保持 `images: string[]` 输出形状，继续按 `pages.pageNumber` 顺序原样返回数据库中的 external/source URLs。
- `apps/api/src/routes/admin/chapters/handlers.ts` 新增只读 integrity probe，显式区分 cheap local `/check` 与远端外链探测 `/:id/integrity`。
- integrity probe 加入 URL 守卫，只允许 `http/https` 外链，拒绝 `localhost`、私网 IPv4、link-local、IPv6 loopback/ULA 等 SSRF 风险目标。
- 新增 public contract 与 admin probe 测试，锁住“public route 不 rewrite URL”“integrity probe 不写库、不 waitUntil、不补 R2”的 Phase 7 边界。

## Verification

- `pnpm --filter api exec vitest run src/routes/public/comics/__tests__/public-comics.test.ts`
- `pnpm --filter api exec vitest run src/routes/admin/chapters/__tests__/integrity-check.test.ts`

## Known Blockers

- 无新的 plan blocker。只读 probe 的真实远端行为仍建议在本地 Gateway / admin 会话下做一次真实外链 smoke，但不影响本 plan 的 API contract 收口。

## Notes

- `/check` 继续是“本地页数/完成度”检查，不被提升成昂贵的网络健康检查。
- `/:id/integrity` 只读取章节已有 `pages.imageUrl`，不会接受调用方自带 URL，也不会对数据库做任何修复性写入。
