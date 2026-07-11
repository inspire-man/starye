# Roadmap: Starye v1.1 存储成本控制与代码/文件整理

## Milestones

- ✅ **v1.0 部署可用、日常使用态** - Phases 1-5 shipped 2026-07-11. Archive: [v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)
- 🔄 **v1.1 存储成本控制与代码/文件整理** - Phases 6-10 planned 2026-07-11.

## Current Status

v1.1 is in planning. The milestone protects the project from Cloudflare storage charges by moving comic chapter body images to external source URLs, limiting R2 to necessary assets, adding cost guardrails, and cleaning up documentation/code entrypoints.

## Phase Plan

| Phase | Name | Goal | Requirements |
|-------|------|------|--------------|
| 6 | Storage Policy Audit | Establish the exact R2/D1/URL storage boundary and inventory current risk before deleting or rewriting anything. | STOR-01, STOR-02, STOR-03, STOR-04 |
| 7 | Comic External Image Flow | Stop comic chapter body images from entering R2 and make crawler/API/Reader work with source image URLs. | COMIC-01, COMIC-02, COMIC-03, COMIC-04, COMIC-05 |
| 8 | Cost Guardrails | Enforce approved R2 purposes and add audit/lifecycle/budget operations that prevent surprise Cloudflare charges. | COST-01, COST-02, COST-03, COST-04, COST-05 |
| 9 | Documentation Restructure | Shrink AGENTS.md and organize historical/current docs so future work starts from the right source of truth. | DOC-01, DOC-02, DOC-03, DOC-04 |
| 10 | Storage Code Cleanup | Consolidate storage helpers/tests and remove legacy assumptions that images should always become R2 URLs. | CODE-01, CODE-02, CODE-03, CODE-04 |

## Phase Details

### Phase 6: Storage Policy Audit

**Goal:** Establish the exact R2/D1/URL storage boundary and inventory current risk before deleting or rewriting anything.

**Requirements:** STOR-01, STOR-02, STOR-03, STOR-04

**Plans:** 3 plans

Plans:
**Wave 1**

- [ ] 06-01-PLAN.md — 固化 canonical storage policy、prefix 分类与 source-vs-R2 术语契约。
- [ ] 06-02-PLAN.md — 盘点 live repo 的 R2 write entries、历史文档声明和 forbidden-risk baselines。

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 06-03-PLAN.md — 构建只读 R2 审计脚本、Markdown/JSON/CSV 报告契约和 no-delete 验证工单。

**Success criteria:**

1. A storage policy doc records allowed R2 purposes, forbidden prefixes, external URL semantics, and why Worker image proxying is not default.
2. Current code paths that upload to R2 are listed with owner modules, including API upload, crawler image processing, mapping files, covers, avatars, logos, and scripts.
3. A dry-run R2 audit plan can identify forbidden chapter/image prefixes and DB references before deletion.
4. No R2 object is deleted during the audit phase unless an explicit dry-run report proves it is safe.

### Phase 7: Comic External Image Flow

**Goal:** Stop comic chapter body images from entering R2 and make crawler/API/Reader work with source image URLs.

**Requirements:** COMIC-01, COMIC-02, COMIC-03, COMIC-04, COMIC-05

**Success criteria:**

1. Comic crawler chapter processing preserves normalized source image URLs and no longer calls R2 image processing for chapter pages.
2. Comic cover handling remains possible through an explicit allowed path, separate from chapter page handling.
3. Public comic chapter API returns external image URLs without rewriting them to R2/CDN assumptions.
4. Reader shows per-image load failure feedback and a usable chapter-level failure state while retaining lazy loading and progress save behavior.
5. Admin integrity checks can report missing/failed external images without silently replacing them with R2 mirrors.

### Phase 8: Cost Guardrails

**Goal:** Enforce approved R2 purposes and add audit/lifecycle/budget operations that prevent surprise Cloudflare charges.

**Requirements:** COST-01, COST-02, COST-03, COST-04, COST-05

**Success criteria:**

1. `/api/upload` requires a `purpose` and rejects disallowed purposes such as comic chapter page uploads.
2. Crawler image processing uses the same allowed-purpose policy and has tests for rejected chapter page uploads.
3. R2 object lifecycle guidance covers temporary, debug, import-staging, and mapping backup prefixes with concrete retention windows.
4. RUNBOOK includes a repeatable R2 cost audit procedure and forbidden-prefix failure conditions.
5. RUNBOOK documents Cloudflare Budget Alerts and makes clear that alerts notify only; they do not enforce a spending cap.

### Phase 9: Documentation Restructure

**Goal:** Shrink AGENTS.md and organize historical/current docs so future work starts from the right source of truth.

**Requirements:** DOC-01, DOC-02, DOC-03, DOC-04

**Success criteria:**

1. AGENTS.md becomes a concise operational index with links to detailed docs rather than a long duplicated project manual.
2. Detailed repository guidance is grouped into stable docs or `.planning` files with clear ownership and update triggers.
3. v1.0 phase evidence is preserved in milestone archives or intentionally cleared according to GSD workflow, with no loss of verification evidence.
4. RUNBOOK contains storage cleanup, rollback, and accidental R2 upload remediation steps.

### Phase 10: Storage Code Cleanup

**Goal:** Consolidate storage helpers/tests and remove legacy assumptions that images should always become R2 URLs.

**Requirements:** CODE-01, CODE-02, CODE-03, CODE-04

**Success criteria:**

1. Allowed R2 purposes and key generation are centralized or clearly shared between API and crawler code.
2. Code names and call sites distinguish necessary stored assets from preserved external image URLs.
3. Tests cover allowed uploads, rejected chapter page uploads, comic API external URLs, and Reader failure behavior.
4. Legacy scripts that assume "cover image must be R2 URL" are either updated to a cost-aware mode or documented as optional flows.

## Coverage

| Category | Requirements | Phases |
|----------|--------------|--------|
| Storage Policy | 4 | Phase 6 |
| Comic External Images | 5 | Phase 7 |
| Cost Guardrails | 5 | Phase 8 |
| Documentation Cleanup | 4 | Phase 9 |
| Code Organization | 4 | Phase 10 |

**Coverage:** 22/22 v1 requirements mapped, 0 unmapped.

## Next

Execute Phase 6 with:

```text
$gsd-execute-phase 6
```

Also available:

```text
$gsd-plan-phase 6 --research
$gsd-review --phase 6 --all
```

---
*Roadmap created: 2026-07-11 for milestone v1.1*
