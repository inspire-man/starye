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
| 12 | 4/4 | Complete    | 2026-07-15 |
| 13 | 15/20 | In Progress|  |
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

**Plans:** 4/4 plans complete
**Wave 1**

- [x] 12-01-PLAN.md

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 12-02-PLAN.md

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 12-03-PLAN.md

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 12-04-PLAN.md

**Success criteria:**

1. API, gateway, and dashboard Cloudflare configuration can deploy against the selected target through explicit Wrangler env/config selection.
2. Gateway routes/origins, API CORS/auth URLs, front-end public API config, and browser-visible runtime config are target-aware and expose no secrets.
3. GitHub deploy, migration, crawler, and rollback workflows can select target-specific Cloudflare/GitHub secret sets.
4. D1 backup/migration and R2 backup bucket usage validate the selected target before remote mutation.
5. Tests cover domain-aware gateway/API/auth config and workflow target resolution without requiring real production secrets.

### Phase 13: Full Chain Data Smoke

**Goal:** Prove the selected target is actually usable by running the local and production data chain through Gateway/canonical domain.

**Requirements:** DATA-01, DATA-02, DATA-03, DATA-04, DATA-05, DATA-06, DATA-07, TEST-05

**Plans:** 20/26 plans executed
**Wave 1**

- [x] 13-01-PLAN.md
- [x] 13-02-PLAN.md

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 13-03-PLAN.md

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 13-04-PLAN.md

**Wave 4** *(gap closure; blocked on Wave 3 completion)*

- [x] 13-05-PLAN.md — Restore the canonical one-item fixture and evidence contract.

**Wave 5** *(gap closure; blocked on Wave 4 completion)*

- [x] 13-06-PLAN.md — Enforce the one-item tuple through prepared D1 snapshots and local/remote runners.

**Wave 6** *(gap closure; blocked on Wave 5 completion)*

- [x] 13-07-PLAN.md — Require runner/provider/browser provenance instead of self-attested pass rows.

**Wave 7** *(gap closure; blocked on Wave 6 completion)*

- [x] 13-08-PLAN.md — Run authorized local and selected-target proof or retain an honest checkpoint. *(Executed to honest external-preflight checkpoint; phase goal remains pending.)*

**Wave 8** *(gap closure; blocked on Wave 7 completion)*

- [x] 13-09-PLAN.md — Pass the official selected-target live preflight, then run one fresh collision-checked local/production proof without rewriting Attempts A-E. *(Executed once; stopped at the immutable local projection checkpoint, so the phase goal remains pending.)*

**Wave 9** *(gap closure; blocked on Wave 8 completion)*

- [x] 13-10-PLAN.md — Re-prove or restore official local projection before allocating a fresh run, then execute one terminal local-to-production D1/API/Dashboard/viewer proof. *(Executed once; standalone local gates passed, but the immutable run stopped at `local_projection/target_projection_unmet`, so the phase goal remains pending.)*

**Wave 10** *(gap closure; blocked on Wave 9 completion)*

- [x] 13-11-PLAN.md — Unify the standalone and runner local-preflight environment contract, preserve fail-closed token-shadowing, and expose an allowlisted non-secret checkpoint issue code.

**Wave 11** *(gap closure; blocked on Wave 10 completion)*

- [x] 13-12-PLAN.md — Use a new collision-gated `p13-12-*` run to prove the terminal local and selected-production D1/API/Dashboard/viewer chain through persistent Codex IAB. *(Executed once; all repaired local gates passed, but the immutable run stopped at `gateway_auth/gateway_auth_unavailable`, so IAB and remote proof were forbidden.)*

**Wave 12** *(gap closure; blocked on Wave 11 completion)*

- [x] 13-13-PLAN.md — Replace listener-only readiness with bounded canonical Gateway HTTP checks and deterministic local auth observation.

**Wave 13** *(gap closure; blocked on Wave 12 completion)*

- [x] 13-14-PLAN.md — Add a target-first, fixed-root, reservation-backed handoff and exact root-script exit contract.
- [x] 13-15-PLAN.md — Persist closed auth checkpoint classes and prove checkpoint-before-exit process behavior.

**Wave 14** *(gap closure; blocked on Wave 13 completion)*

- [ ] 13-16-PLAN.md — Establish fresh runtime ownership and canonical Gateway readiness, or record an honest runtime blocker.

**Wave 15** *(historical gap-closure checkpoint; immutable)*

- [x] 13-21-PLAN.md — Executed once and remains immutable as `blocked_pre_teardown/missing_process_39560`; it is historical diagnosis only and cannot release downstream work.

**Wave 16** *(historical gap-closure checkpoint; immutable)*

- [x] 13-22-PLAN.md — Executed once and remains immutable as `blocked_pre_teardown/supervisor_not_found`; its evaluator remains fail closed and cannot release downstream work.

**Wave 21** *(historical gap-closure checkpoint; immutable)*

- [x] 13-23-PLAN.md — Executed once as a repaired read-only snapshot and remains immutable as `blocked_pre_teardown/supervisor_not_found`; it cannot release downstream work.

**Wave 22** *(historical gap-closure checkpoint; immutable)*

- [x] 13-24-PLAN.md — Executed once and remains immutable as `blocked_after_launch`; it cannot release downstream work.

**Wave 23** *(historical gap-closure checkpoint; immutable)*

- [x] 13-25-PLAN.md — Closed as `blocked_after_launch`; it is historical diagnosis only and cannot release downstream work.

**Wave 28 isolated repair** *(gap closure; blocked on the immutable 13-25 wrapper diagnosis)*

- [x] 13-26-PLAN.md — Repaired the root tsx loader and its static regression without launching a runtime.

**Wave 29 streamlined retry** *(historical gap-closure checkpoint; immutable)*

- [x] 13-27-PLAN.md — Closed as an entry-observation blocker; it did not release downstream work.

**Wave 30 basic lifecycle smoke** *(gap closure; blocked on the root-loader repair)*

- [x] 13-28-PLAN.md — Passed the basic local service smoke, canonical Gateway check, and fixed-port cleanup; its three release fields are the current handoff input.

**Wave 24** *(gap closure; blocked on Wave 23 released-and-cleaned eligibility)*

- [ ] 13-17-PLAN.md — Run one collision-gated local handoff only after the three 13-25 release fields pass.

**Wave 25** *(gap closure; blocked on Wave 24 completion)*

- [ ] 13-18-PLAN.md — Let root persistent Codex IAB record local Dashboard then viewer for the exact pending tuple.

**Wave 26** *(gap closure; blocked on Wave 25 completion)*

- [ ] 13-19-PLAN.md — Perform one reservation-backed remote handoff with official preflight and closed checkpoint behavior.

**Wave 27** *(gap closure; blocked on Wave 26 completion)*

- [ ] 13-20-PLAN.md — Record selected-production IAB surfaces and rerun exact plus canonical Phase verification.

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

Plans 13-13 through 13-26 close the diagnosed Gateway readiness, runtime ownership, handoff, and full selected-production proof gaps. Plans 13-21 through 13-25 are immutable historical checkpoints. Plan 13-26 repairs only the Windows root-command wrapper and cannot release data-chain work; execute it solely with `$gsd-execute-phase 13 --gaps-only --wave 28`, never as an unfiltered gaps-only run. After it passes static gates, run `$gsd-plan-phase 13 --gaps` again to create Plan 13-27: that separate retry must start from a new all-free snapshot, own one newly launched root `pnpm.cmd dev` tree, prove its absolute supervisor/listener ancestry, clean only its revalidated tree, and emit the three release fields before Plans 13-17 through 13-20 can be rewired and executed. Preserve every historical evidence directory and treat any new checkpoint as terminal for its run:

```text
$gsd-execute-phase 13 --gaps-only
```

---
*Last updated: 2026-07-20 after Phase 13 immutable 13-24 closeout and Wave 23-27 retry routing*
