# Roadmap: Starye v1.2 Cloudflare 账户/域名切换与全链路发布验证

## Milestones

- ✅ **v1.0 部署可用、日常使用态** - Phases 1-5 shipped 2026-07-11. Archive: [v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)
- ✅ **v1.1 存储成本控制与代码/文件整理** - Phases 6-10 shipped 2026-07-13. Archive: [v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md)
- ◇ **v1.2 Cloudflare 账户/域名切换与全链路发布验证** - Phases 11-14 active.

## Current Status

v1.2 is active. The milestone goal is to make Starye switchable across Cloudflare account/domain targets, normalize local env and public frontend runtime config, and prove the full local-to-production chain: deploy, migrate, crawl, ingest, manage, view, and verify.

## Phase Plan

| Phase | Name | Goal | Requirements |
|-------|------|------|--------------|
| 11 | 4/4 | Complete    | 2026-07-14 |
| 12 | 0/4 | Planned    |  |
| 13 | Full Chain Data Smoke | Prove local and production data flow from crawler/fixture through D1/API/admin to front-end viewing via Gateway/canonical domain. | DATA-01, DATA-02, DATA-03, DATA-04, DATA-05, DATA-06, DATA-07, TEST-05 |
| 14 | Test and Operations Hardening | Close old-domain drift, document account/domain switching, and produce final requirement-to-evidence verification. | TEST-01, TEST-06, TEST-07 |

## Phase Details

### Phase 11: Deployment Target Foundation

**Goal:** Establish a single non-secret target profile model and local env normalization contract before changing deploy/runtime behavior.

**Requirements:** PROF-01, PROF-02, PROF-03, PROF-04, ENV-01, ENV-02, TEST-02

**Plans:** 4/4 plans complete

- [x] 11-01-PLAN.md
- [x] 11-02-PLAN.md
- [x] 11-03-PLAN.md

- **Wave 1:** `11-01-PLAN.md` — Target profile schema, current `starye-org` profile, resolver, and package test setup.
- **Wave 2** *(blocked on Wave 1 completion)*: `11-02-PLAN.md` — Marker-aware local env projection for API/gateway/root/crawler env files.
- **Wave 3**: `11-03-PLAN.md` — Fail-closed preflight CLI, local Wrangler vs CI identity boundary, and live-check wrappers.

**Success criteria:**

1. A target profile schema can represent Cloudflare account, domain, Workers, Pages, D1, R2, KV, URLs, and required-secret metadata without storing real secrets.
2. A validation command fails closed for missing or inconsistent account/domain/resource/secret metadata.
3. Local env normalization can project one target into Worker `.dev.vars`, Vite `.env`, Nuxt public runtime config, and crawler env expectations.
4. Wrangler local auth profile guidance is documented separately from CI token/account-secret behavior.
5. Automated tests cover valid profile resolution and fail-closed mismatch cases.

### Phase 12: Cloudflare Config Switching

**Goal:** Make deployable Cloudflare surfaces and CI workflows consume the selected target instead of hard-coded singleton production values.

**Requirements:** ENV-03, ENV-04, ENV-05, ENV-06, DEPL-01, DEPL-02, DEPL-03, DEPL-04, DEPL-05, DEPL-06, TEST-03, TEST-04

**Plans:** 0/4 plans executed
**Wave 1**

- [ ] 12-01-PLAN.md

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 12-02-PLAN.md

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 12-03-PLAN.md

**Wave 4** *(blocked on Wave 3 completion)*

- [ ] 12-04-PLAN.md

**Success criteria:**

1. API, gateway, and dashboard Cloudflare configuration can deploy against the selected target through explicit Wrangler env/config selection.
2. Gateway routes/origins, API CORS/auth URLs, front-end public API config, and browser-visible runtime config are target-aware and expose no secrets.
3. GitHub deploy, migration, crawler, and rollback workflows can select target-specific Cloudflare/GitHub secret sets.
4. D1 backup/migration and R2 backup bucket usage validate the selected target before remote mutation.
5. Tests cover domain-aware gateway/API/auth config and workflow target resolution without requiring real production secrets.

### Phase 13: Full Chain Data Smoke

**Goal:** Prove the selected target is actually usable by running the local and production data chain through Gateway/canonical domain.

**Requirements:** DATA-01, DATA-02, DATA-03, DATA-04, DATA-05, DATA-06, DATA-07, TEST-05

**Plans:** Not planned yet.

**Success criteria:**

1. Local smoke goes through `http://localhost:8080/...` and verifies API, auth/dashboard, and content routes without treating direct app ports as canonical.
2. Local D1 schema and minimal data setup can be verified before production deploy.
3. A targeted crawler or fixture writes a known item to the selected API target and records item identity.
4. D1/API/admin checks prove the item exists and is manageable after ingest.
5. Front-end viewing proves the item is visible through the selected canonical Gateway domain, with local and production smoke evidence captured.

### Phase 14: Test and Operations Hardening

**Goal:** Turn the v1.2 switching and full-chain proof into repeatable tests, runbook procedures, and final evidence mapping.

**Requirements:** TEST-01, TEST-06, TEST-07

**Plans:** Not planned yet.

**Success criteria:**

1. Active source/test literals for `starye.org` are either parameterized, converted to default-target fixtures, or explicitly justified.
2. RUNBOOK documents account/domain switching, local env normalization, required secrets, deploy, smoke, rollback, and recovery paths.
3. Final verification maps every v1.2 requirement to a command output, automated test, smoke result, or artifact.

## Coverage

- v1.2 requirements: 30 total
- Mapped to phases: 30
- Unmapped: 0

## Next

Verify Phase 11 with:

```text
$gsd-verify-work 11
```

---
*Last updated: 2026-07-14 after Phase 11 planning*
