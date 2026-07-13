# Project Milestones: Starye

## v1.1 存储成本控制与代码/文件整理 (Shipped: 2026-07-13)

**Delivered:** A free-tier-first storage cleanup milestone that locked the R2/storage policy boundary, moved comic chapter body images to external/source URLs, enforced upload-purpose guardrails, tightened documentation ownership, and consolidated storage semantics across API, crawler, admin, and legacy scripts.

**Phases completed:** 6-10 (15 plans total)

**Key accomplishments:**

- Established a read-only R2 audit toolkit with fixed Markdown/JSON/CSV report contracts, explicit no-delete verification gates, and runtime-vs-historical storage evidence separation.
- Removed comic chapter body images from the default R2 path while preserving public API readability, explicit admin integrity probes, and Reader failure-safe UX.
- Enforced upload-purpose and crawler namespace guardrails so chapter-page assets cannot silently slip back into managed R2 storage.
- Shrunk root docs into canonical entrypoints, formalized documentation ownership, and archived superseded storage docs without losing milestone evidence.
- Consolidated shared storage semantics so upload routes, crawler image processing, admin pending heuristics, and operator-facing scripts all agree on managed-vs-external asset rules.

**Stats:**

- 5 phases
- 15 plans
- 22 v1 requirements mapped
- 5/5 phases verified
- 0 unsatisfied requirements in final audit

**Audit result:**

- `status: passed` in [v1.1-MILESTONE-AUDIT.md](milestones/v1.1-MILESTONE-AUDIT.md)

**Archives:**

- [v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md)
- [v1.1-REQUIREMENTS.md](milestones/v1.1-REQUIREMENTS.md)
- [v1.1-MILESTONE-AUDIT.md](milestones/v1.1-MILESTONE-AUDIT.md)

**What's next:** Start the next milestone with `$gsd-new-milestone`.

---

## v1.0 部署可用、日常使用态 (Shipped: 2026-07-11)

**Delivered:** A production-ready personal content platform with unified auth, access hardening, stable playback recovery, unified progress tracking, and deploy/rollback/observability operations.

**Phases completed:** 1-5 (24 plans total)

**Key accomplishments:**

- Unified cross-app auth/session behavior across gateway, API, dashboard, movie, comic, blog, and auth surfaces.
- Hardened public exposure with dashboard/admin gates, R18 server-side filtering, robots/noindex controls, docs auth, WAF runbook coverage, and pages.dev redirects.
- Stabilized movie playback with visible error cards, same-source retry, offline Aria2/TorrServer feedback, and Sentry video failure telemetry.
- Added a unified `progress` model for movie watching and comic reading restore/save/completion semantics.
- Established deploy, rollback, migration backup, destructive migration review, Sentry, and RUNBOOK operations for day-to-day production use.

**Stats:**

- 5 phases
- 24 plans
- 41 v1 requirements mapped
- 5/5 phases verified
- 0 unsatisfied requirements in final audit

**Known tech debt accepted at closeout:**

- Phase 1 has no retroactive `01-SECURITY.md` artifact.
- Some older Phase 1/2 summary frontmatter and traceability rows lag behind verification evidence.
- The next real `deploy-migrations.yml` run should reconfirm the R2 backup object path recorded in Phase 5.

**Archives:**

- [v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)
- [v1.0-REQUIREMENTS.md](milestones/v1.0-REQUIREMENTS.md)
- [v1.0-MILESTONE-AUDIT.md](milestones/v1.0-MILESTONE-AUDIT.md)

**What's next:** Start the next milestone with `$gsd-new-milestone`.

---
