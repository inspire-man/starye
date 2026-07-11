---
phase: 06-storage-policy-audit
plan: "01"
subsystem: storage-policy
tags:
  - phase-6
  - r2
  - storage-policy
  - terminology
  - audit-boundary
dependency_graph:
  requires:
    - STOR-01
    - STOR-03
    - D-01
    - D-02
    - D-03
    - D-04
    - D-05
    - D-06
    - D-15
    - D-16
    - D-17
    - D-18
  provides:
    - canonical storage policy for Phase 6
    - stable prefix classification for Phase 8 and Phase 10
    - source-vs-R2 terminology contract for future cleanup and enforcement work
  affects:
    - .planning/phases/06-storage-policy-audit/06-STORAGE-POLICY.md
    - .planning/phases/06-storage-policy-audit/06-02-PLAN.md
    - .planning/phases/06-storage-policy-audit/06-03-PLAN.md
tech_stack:
  added: []
  patterns:
    - markdown policy matrix
    - prefix tree classification
    - glossary-based semantic lock
key_files:
  created:
    - .planning/phases/06-storage-policy-audit/06-STORAGE-POLICY.md
    - .planning/phases/06-storage-policy-audit/06-01-SUMMARY.md
  modified:
    - .planning/STATE.md
    - .planning/ROADMAP.md
    - .planning/REQUIREMENTS.md
decisions:
  - R2 policy is frozen into standard allowed, restricted allowed, short-term allowed, historical risk, and forbidden classes.
  - system/ and ops/d1-backups/ remain discovered unlisted prefixes until a later operations classification phase.
  - sourceImageUrl or externalImageUrl identify source URLs, while r2Key plus r2Url identify R2-backed assets; historical image_url and images: string[] names remain but their semantics are locked.
requirements_completed:
  - STOR-01
  - STOR-03
coverage:
  - deliverable: canonical prefix policy matrix
    verification:
      - kind: command
        ref: rg -n "D-01|D-02|D-03|D-04|D-05|D-06|system/|ops/d1-backups/|Forbidden Uses|Historical Risk" .planning/phases/06-storage-policy-audit/06-STORAGE-POLICY.md
        status: pass
      - kind: command
        ref: rg -n "Purpose and Scope|Allowlist|Restricted Allowed|Short-Term Allowed|Historical Risk|Forbidden Uses|不删除 R2 对象|不应用 lifecycle|不实施上传封禁" .planning/phases/06-storage-policy-audit/06-STORAGE-POLICY.md
        status: pass
    human_judgment: false
  - deliverable: naming glossary and semantic lock for source vs R2 assets
    verification:
      - kind: command
        ref: rg -n "D-15|D-16|D-17|D-18|sourceImageUrl|externalImageUrl|r2Key|r2Url|image_url|images: string\\[\\]|storage|proxy|cache|comic-crawler -> ImageProcessor -> syncChapterData -> pages.image_url -> public comics API -> comic-app" .planning/phases/06-storage-policy-audit/06-STORAGE-POLICY.md
        status: pass
      - kind: command
        ref: rg -n "system/|ops/d1-backups/|sourceImageUrl|externalImageUrl|r2Key|r2Url|comic-crawler -> ImageProcessor -> syncChapterData -> pages.image_url -> public comics API -> comic-app" .planning/phases/06-storage-policy-audit/06-STORAGE-POLICY.md
        status: pass
    human_judgment: false
metrics:
  duration: 6 min
  completed_at: 2026-07-12T04:30:40+08:00
status: complete
---

# Phase 06 Plan 01: Storage Policy Summary

Canonical R2 prefix policy with source-vs-R2 terminology lock and a no-delete/no-proxy baseline for Phase 6.

## Outcome

`06-STORAGE-POLICY.md` 已成为本 phase 的单一 storage contract。它固定了 `covers/`、`avatars/`、`logos/`、`fallback/`、`manual-assets/`、`mappings/`、`mappings/backups/`、`tmp/`、`crawler-debug/`、`import-staging/`、`images/` 的分类，并把 `system/`、`ops/d1-backups/` 记录为 discovered unlisted prefixes，明确要求后续 phase 先做 operations classification，不能 silently 并入标准媒体资产 allowlist。

同一文档还锁定了 `sourceImageUrl` / `externalImageUrl` 与 `r2Key` / `r2Url` 的语义边界，确认 `chapter.pages.image_url` 和 public comics API 的 `images: string[]` 只是历史字段名，Phase 6 只冻结语义、不做字段或接口改名。

## Tasks Completed

### Task 1: 编写 canonical R2 prefix policy

- 创建 `Purpose and Scope`、`Allowlist`、`Restricted Allowed`、`Short-Term Allowed`、`Historical Risk`、`Forbidden Uses`、`Discovered Unlisted Prefixes`、`Policy Matrix`、`Restrictions and Follow-up` 章节。
- 把 D-01 到 D-06 落成 prefix 分类矩阵，并明确 Phase 6 不删除 R2 对象、不应用 lifecycle、不实施上传封禁。
- 提交：`54eb65d` `docs(06-01): add canonical storage policy`

### Task 2: 锁定命名语义和 forbidden-risk 基线词汇

- 追加 `Naming Glossary`、`Semantic Locks for Existing Fields`、`Storage vs Proxy vs Cache`、`Forbidden-Risk Baseline`、`Current Heuristics`、`Future Enforcement Hooks`。
- 把 `comic-crawler -> ImageProcessor -> syncChapterData -> pages.image_url -> public comics API -> comic-app` 固定为后续 phase 的 regression baseline，而不是当前 phase 的修复项。
- 提交：`bb870d1` `docs(06-01): lock storage terminology and risk baseline`

## Verification

### Task Acceptance Gates

- PASS — `rg -n "D-01|D-02|D-03|D-04|D-05|D-06|system/|ops/d1-backups/|Forbidden Uses|Historical Risk" .planning/phases/06-storage-policy-audit/06-STORAGE-POLICY.md`
- PASS — `rg -n "Purpose and Scope|Allowlist|Restricted Allowed|Short-Term Allowed|Historical Risk|Forbidden Uses|不删除 R2 对象|不应用 lifecycle|不实施上传封禁" .planning/phases/06-storage-policy-audit/06-STORAGE-POLICY.md`
- PASS — `rg -n "D-15|D-16|D-17|D-18|sourceImageUrl|externalImageUrl|r2Key|r2Url|image_url|images: string\\[\\]|storage|proxy|cache|comic-crawler -> ImageProcessor -> syncChapterData -> pages.image_url -> public comics API -> comic-app" .planning/phases/06-storage-policy-audit/06-STORAGE-POLICY.md`

### Plan-Level Verification

- PASS — `rg -n "D-01|D-02|D-03|D-04|D-05|D-06|D-15|D-16|D-17|D-18" .planning/phases/06-storage-policy-audit/06-STORAGE-POLICY.md`
- PASS — `rg -n "system/|ops/d1-backups/|sourceImageUrl|externalImageUrl|r2Key|r2Url|comic-crawler -> ImageProcessor -> syncChapterData -> pages.image_url -> public comics API -> comic-app" .planning/phases/06-storage-policy-audit/06-STORAGE-POLICY.md`
- PASS — `npx gitnexus detect-changes --repo starye --scope all`
  - 结果：`Risk level: low`。
  - 备注：输出只提示当前工作树里预先存在的 `AGENTS.md` / `CLAUDE.md` 脏修改；本计划未触碰这两个文件。

## Decisions Made

1. Phase 6 的 canonical storage vocabulary 以 prefix 分类和 glossary 为准，后续 phase 不再重复定义。
2. `system/` 与 `ops/d1-backups/` 不属于标准媒体资产 allowlist，而是待单独纳入 operations classification 的例外前缀。
3. `image_url` 与 `images: string[]` 继续保留历史命名，但语义已经被固定为 source/external URL，不再默认代表 R2 URL。

## Deviations from Plan

None - plan executed exactly as written.

## Authentication Gates

None.

## Known Stubs

None.

## Self-Check: PASSED

- 文件存在：`06-STORAGE-POLICY.md`、`06-01-SUMMARY.md`
- 提交存在：`54eb65d`、`bb870d1`
