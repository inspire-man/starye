---
phase: 6
slug: storage-policy-audit
status: planned
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-12
---

# Phase 6 - Validation Strategy

> Per-phase validation contract for storage policy, evidence inventory, and read-only R2 audit tooling.

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | source assertions + `vitest` for crawler audit script + manual credentialed dry-run |
| **Config file** | `packages/crawler/vitest.config.ts`, `.planning/phases/06-storage-policy-audit/06-*.md` |
| **Quick run command** | `pnpm --filter @starye/crawler exec vitest run test/audit-r2-storage.test.ts` |
| **Full suite command** | targeted Phase 6 matrix below + no-delete grep + package-scoped crawler test |
| **Estimated runtime** | doc assertions ~1-5s; crawler test ~5-20s; credentialed remote dry-run depends on bucket size |

## Sampling Rate

- **After every task commit:** run the narrowest `rg` or `vitest` command for the touched artifact.
- **After every plan wave:** rerun the Phase 6 doc matrix; if `06-03` changed, rerun the crawler audit script test.
- **Before `$gsd-verify-work 6`:** all source assertions must pass, the read-only audit script test must be green, and the no-delete grep must stay clean.
- **Max feedback latency:** < 30s for local doc/script checks; remote credentialed dry-run is manual and may exceed this window.

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Secure / Stable Behavior | Test Type | Automated Command | Output State | Status |
|---------|------|------|-------------|--------------------------|-----------|-------------------|--------------|--------|
| V-06-01A | 06-01 | 1 | STOR-01 | storage policy names allowed, restricted, short-term, historical-risk, and forbidden prefixes | source assertion | `rg -n "Purpose and Scope|Allowlist|Restricted Allowed|Short-Term Allowed|Historical Risk|Forbidden Uses|system/|ops/d1-backups/" .planning/phases/06-storage-policy-audit/06-STORAGE-POLICY.md` | planned target | ⬜ pending |
| V-06-01B | 06-01 | 1 | STOR-03 | source/external URL terms stay distinct from `r2Key` / `r2Url`, and chapter image semantics remain historical-only | source assertion | `rg -n "sourceImageUrl|externalImageUrl|r2Key|r2Url|image_url|images: string\\[\\]|storage|proxy|cache|comic-crawler -> ImageProcessor -> syncChapterData -> pages.image_url -> public comics API -> comic-app" .planning/phases/06-storage-policy-audit/06-STORAGE-POLICY.md` | planned target | ⬜ pending |
| V-06-02A | 06-02 | 1 | STOR-02, STOR-03 | live write inventory includes runtime prefixes, runnable risk classes, and forbidden-risk baseline evidence | source assertion | `rg -n "images/|mappings/|mappings/backups/|system/search-index.json|ops/d1-backups/|production schedule|manual operation|test verification|historical script" .planning/phases/06-storage-policy-audit/06-R2-WRITE-INVENTORY.md && rg -n "/upload/presign|chapter.pages.image_url|images: string\\[\\]|comic-crawler -> ImageProcessor -> syncChapterData -> pages.image_url -> public comics API -> comic-app" .planning/phases/06-storage-policy-audit/06-RISK-BASELINES.md` | planned target | ⬜ pending |
| V-06-03A | 06-03 | 2 | STOR-04 | read-only audit script shapes rows, fails closed when env is incomplete, and keeps comics cover vs chapter prefixes separate | unit | `pnpm --filter @starye/crawler exec vitest run test/audit-r2-storage.test.ts` | planned target | ⬜ pending |
| V-06-03B | 06-03 | 2 | STOR-04 | Markdown, JSON, and CSV audit contracts expose count/size/samples/DB risk/combined recommendation and keep `comics/<slug>` separate from `comics/<slug>/<chapter>` | source assertion | `rg -n "Executive Summary|Prefix Matrix|Runtime Write Paths|Docs-Declared Entries|DB Reference Checks|No-Delete Confirmation|Follow-up Candidates|delete_risk|cost_risk|combined_recommendation|system/|ops/d1-backups/|comics/<slug>|comics/<slug>/<chapter>" .planning/phases/06-storage-policy-audit/06-R2-AUDIT-DRY-RUN.md .planning/phases/06-storage-policy-audit/06-r2-audit-details.json .planning/phases/06-storage-policy-audit/06-r2-audit-details.csv` | planned target | ⬜ pending |
| V-06-03C | 06-03 | 2 | STOR-02, STOR-04 | Phase 6 verification keeps a hard no-delete boundary and requires GitNexus scope check before commit | source assertion | `$bad = Select-String -Path 'packages/crawler/scripts/audit-r2-storage.ts' -Pattern 'DeleteObjectCommand|PutBucketLifecycleConfigurationCommand|\\.delete\\('; if ($bad) { Write-Error 'destructive storage API found'; exit 1 }; rg -n "gitnexus detect-changes|Phase 6 不做|dry-run|06-R2-AUDIT-DRY-RUN.md|06-r2-audit-details.json|06-r2-audit-details.csv" .planning/phases/06-storage-policy-audit/06-VERIFICATION.md` | planned target | ⬜ pending |

*Status: ⬜ pending · ✅ green · ⚠ manual-only*

## Wave 0 Requirements

- [x] `packages/crawler/vitest.config.ts` provides a package-scoped test harness for the planned audit script.
- [x] Phase 6 plan docs define the artifact set and no-delete boundary before execution starts.
- [x] The current shell lacks Cloudflare credentials, so fail-closed behavior is an explicit validation target rather than an afterthought.
- [x] `06-RESEARCH.md` and `06-03-PLAN.md` now agree on package-scoped `tsx` / `vitest` execution patterns.

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 在真实 R2 / D1 上跑一次 read-only dry-run inventory | STOR-04 | 依赖真实 Cloudflare bucket、D1 数据量和凭据 | 按 `06-03` 的 `user_setup` 准备环境变量后，运行 package-scoped `tsx` 脚本并检查 Markdown/JSON/CSV 输出 |
| 确认 `system/` 与 `ops/d1-backups/` 的运营归类符合当前 owner 预期 | STOR-01 | 需要 owner 对 system-purpose / operations-purpose 的最终接受，而不是只看代码证据 | 审阅 `06-STORAGE-POLICY.md` 与 `06-R2-WRITE-INVENTORY.md` 中对应条目，确认没有被误归入标准媒体资产 allowlist |

## Validation Sign-Off

- [x] All planned work has automated or source-assertable verification
- [x] Manual-only remote checks are explicitly listed
- [x] Wave 0 dependencies are covered by existing repo structure and current phase artifacts
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** planned 2026-07-12
