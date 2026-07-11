# Requirements: Starye v1.1 存储成本控制与代码/文件整理

**Defined:** 2026-07-11
**Core Value:** 部署在公网、能稳定日常使用的个人内容中台；v1.1 的优先级是 Cloudflare 免费额度内运行、存储策略清楚、代码和文档入口可维护。

## v1 Requirements

### Storage Policy

- [ ] **STOR-01**: Owner can read a documented storage policy that states which assets may use R2 and which assets must remain external URLs.
- [ ] **STOR-02**: System rejects or flags any attempt to store comic chapter body images in R2 by default.
- [ ] **STOR-03**: Owner can distinguish R2-backed URLs from external source URLs in crawler/API/storage documentation and code naming.
- [ ] **STOR-04**: Existing R2 prefixes can be audited before deletion, including object count, rough size, and DB reference risk.

### Comic External Images

- [ ] **COMIC-01**: Crawler saves comic chapter page images as normalized source image URLs instead of uploading them to R2.
- [ ] **COMIC-02**: Crawler still allows necessary comic covers to use R2 when explicitly configured, while chapter body pages remain external.
- [ ] **COMIC-03**: API returns chapter image URLs without assuming they are same-origin or R2-backed assets.
- [ ] **COMIC-04**: Reader displays externally hosted chapter images with lazy loading, visible per-image failure feedback, and a usable chapter-level error state.
- [ ] **COMIC-05**: Admin/chapter integrity checks can report external image failures without replacing them with R2 mirrors.

### Cost Guardrails

- [ ] **COST-01**: `/api/upload` requires an explicit asset purpose and only allows approved R2 purposes such as cover, poster, avatar, logo, fallback, manual, or temp.
- [ ] **COST-02**: Crawler image processing uses the same approved-purpose policy and refuses `comic_chapter_page` uploads.
- [ ] **COST-03**: R2 lifecycle guidance exists for tmp/debug/import-staging/mapping backup prefixes, including recommended retention windows.
- [ ] **COST-04**: Owner has a repeatable R2 cost audit command or runbook section that checks forbidden prefixes and high-growth prefixes.
- [ ] **COST-05**: RUNBOOK documents Cloudflare Budget Alerts with low-cost thresholds and states that alerts notify only; they do not stop billing automatically.

### Documentation Cleanup

- [ ] **DOC-01**: AGENTS.md is reduced to a short operational entrypoint with links to detailed docs instead of duplicating the whole project manual.
- [ ] **DOC-02**: Detailed repo guidance is grouped into stable docs or planning files with clear ownership, so future agents know where to read.
- [ ] **DOC-03**: Historical phase files are either archived under milestone evidence or cleared according to GSD workflow, without losing v1.0 verification evidence.
- [ ] **DOC-04**: RUNBOOK includes the storage policy, R2 cleanup procedure, and rollback notes for accidental storage-policy regressions.

### Code Organization

- [ ] **CODE-01**: R2 key generation and allowed upload purposes are centralized enough that API upload and crawler flows do not drift.
- [ ] **CODE-02**: ImageProcessor or its callers make the difference between `storeNecessaryAsset` and `preserveExternalImageUrl` explicit.
- [ ] **CODE-03**: Storage-related tests cover allowed uploads, rejected chapter page uploads, and comic reader/API external URL behavior.
- [ ] **CODE-04**: Legacy scripts that assume "cover image must be R2 URL" are updated or documented as optional, cost-aware flows.

## v2 Requirements

Deferred to future milestones.

### Reliability

- **REL-01**: Owner can selectively mirror a small number of broken high-value chapter images to R2 after explicit manual approval and quota check.
- **REL-02**: System can track source image health over time and suggest recrawl candidates.
- **REL-03**: Reader can choose between multiple source hosts when a crawler strategy provides alternatives.

### Operations

- **OPS-01**: Cloudflare billing and usage data can be collected into dashboard metrics automatically.
- **OPS-02**: R2 object cleanup can be dry-run and executed from dashboard with confirmation.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Hosting all comic chapter images in R2 | Directly conflicts with free-tier cost goal. |
| Default Worker/Pages Function image proxy | Converts reading traffic into Cloudflare request/CPU cost. |
| Cloudflare Images / Stream / Cache Reserve adoption | Paid add-ons require separate cost evaluation. |
| Full crawler reliability redesign | Useful later, but v1.1 focuses on storage policy and cleanup. |
| Multi-user quota/billing features | Project remains single-owner. |
| Large UI redesign | Not required for storage cost control. |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| STOR-01 | Phase 6 | Pending |
| STOR-02 | Phase 6 | Pending |
| STOR-03 | Phase 6 | Pending |
| STOR-04 | Phase 6 | Pending |
| COMIC-01 | Phase 7 | Pending |
| COMIC-02 | Phase 7 | Pending |
| COMIC-03 | Phase 7 | Pending |
| COMIC-04 | Phase 7 | Pending |
| COMIC-05 | Phase 7 | Pending |
| COST-01 | Phase 8 | Pending |
| COST-02 | Phase 8 | Pending |
| COST-03 | Phase 8 | Pending |
| COST-04 | Phase 8 | Pending |
| COST-05 | Phase 8 | Pending |
| DOC-01 | Phase 9 | Pending |
| DOC-02 | Phase 9 | Pending |
| DOC-03 | Phase 9 | Pending |
| DOC-04 | Phase 9 | Pending |
| CODE-01 | Phase 10 | Pending |
| CODE-02 | Phase 10 | Pending |
| CODE-03 | Phase 10 | Pending |
| CODE-04 | Phase 10 | Pending |

**Coverage:**
- v1 requirements: 22 total
- Mapped to phases: 22
- Unmapped: 0

---
*Requirements defined: 2026-07-11*
*Last updated: 2026-07-11 after v1.1 roadmap creation*
