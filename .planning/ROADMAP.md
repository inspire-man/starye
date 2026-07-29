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
| 13 | Scope closeout | Complete (production Viewer proof deferred) | 2026-07-29 |
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

**Plans:** 48/65 plans executed

- [x] 13-63-PLAN.md
- [ ] 13-64-PLAN.md
- [ ] 13-65-PLAN.md

- [ ] 13-32-PLAN.md
- [ ] 13-33-PLAN.md
- [ ] 13-34-PLAN.md
- [ ] 13-35-PLAN.md
- [x] 13-40-PLAN.md
- [x] 13-41-PLAN.md
- [x] 13-42-PLAN.md
- [x] 13-43-PLAN.md
- [x] 13-44-PLAN.md
- [ ] 13-45-PLAN.md
- [ ] 13-46-PLAN.md
- [ ] 13-47-PLAN.md
- [x] 13-48-PLAN.md
- [x] 13-49-PLAN.md
- [x] 13-50-PLAN.md

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

- [x] 13-16-PLAN.md — Establish fresh runtime ownership and canonical Gateway readiness, or record an honest runtime blocker.

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

- [x] 13-17-PLAN.md — Ran one collision-gated local handoff using the released 13-28 lifecycle fields.

**Wave 25** *(gap closure; blocked on Wave 24 completion)*

- [x] 13-18-PLAN.md — Root persistent Codex IAB recorded the exact local Dashboard then Viewer tuple.

**Wave 26** *(historical remote contract; superseded for execution by Wave 31)*

- [ ] 13-19-PLAN.md — Historical remote-handoff contract retained on disk; do not execute as written (stale 13-25 lifecycle gate). Superseded by 13-29.

**Wave 27** *(historical production IAB contract; superseded for execution by Wave 32)*

- [ ] 13-20-PLAN.md — Historical production Dashboard/viewer contract retained on disk; do not execute as written (depends on unexecuted 13-19). Superseded by 13-30.

**Wave 31** *(gap closure; blocked on live 13-18 terminal local + 13-28 lifecycle)*

- [x] 13-29-PLAN.md — Human-gated selected-production remote handoff consuming p13-17 local evidence (supersedes executable intent of 13-19).

**Wave 32** *(gap closure; blocked on Wave 31 remote pending)*

- [ ] 13-30-PLAN.md — Historical post-13-29 production IAB contract; do not execute against p13-17 checkpoint. Superseded for execution by 13-38/13-39.

**Wave 33** *(gap closure; blocked on Wave 32)*

- [ ] 13-31-PLAN.md — Historical re-verify contract dependent on 13-30; superseded for execution by 13-39.

**Wave 34** *(gap closure; blocked on 13-29 complete + local-dev profile fix)*

- [x] 13-36-PLAN.md — Commit/regression-lock local-dev Pages profile wiring for fresh pnpm dev.

**Wave 35** *(gap closure; blocked on Wave 34)*

- [x] 13-37-PLAN.md — New run_id local lifecycle + handoff + Dashboard/viewer terminal proof (not p13-17).

**Wave 36** *(gap closure; blocked on Wave 35 local terminal; human remote auth)*

- [x] 13-38-PLAN.md — One remote handoff for 13-37 run; pending or honest checkpoint.

**Wave 37** *(gap closure; blocked on Wave 36)*

- [x] 13-39-PLAN.md — Production surfaces if remote pending + refresh 13-VERIFICATION.md from live truths.

**Wave 46** *(gap closure; blocked on live 13-50 local Dashboard observer checkpoint + 13-VERIFICATION production UI gap)*

- [x] 13-51-PLAN.md — Repair local observer choke point where signed-in Dashboard still maps to `dashboard_auth_unavailable`; regression-lock; no new smoke run.

**Wave 47** *(gap closure; blocked on Wave 46)*

- [x] 13-52-PLAN.md — Executed; immutable local Dashboard checkpoint `dashboard_auth_unavailable` on p13-52; does not unlock 13-53.
- [x] 13-55-PLAN.md — Executed; local terminal_passed / provesExternalChain true on p13-55 via signed-in IAB observeSurface; unlocks human-gated 13-53 on this run.

**Wave 48** *(gap closure; blocked on Wave 47 local terminal; human remote auth)*

- [x] 13-53-PLAN.md — Executed; human-authorized but frozen at remote preflight Invalid access token [code: 9109]; no remote pending pair; does not unlock 13-54.

**Wave 49** *(gap closure; blocked on Wave 48)*

- [x] 13-54-PLAN.md — Production session + ordered Dashboard→viewer on the fresh remote pending pair, dual verify or honest checkpoint, refresh 13-VERIFICATION.md from live truths.

**Wave 50** *(gap closure; blocked on Wave 49 p13-55 remote preflight freeze + nested reliability fix in tree)*

- [x] 13-56-PLAN.md — Prove standalone + nested/handoff-owned remote preflight green for starye-org without creating remote.attempt or a new run id.

**Wave 51** *(gap closure; blocked on Wave 50 nested preflight green)*

- [x] 13-57-PLAN.md — Executed; local handoff pending then frozen at dashboard_auth_unavailable; does not unlock 13-58.

**Wave 52** *(gap closure; blocked on Wave 51 local terminal; human remote auth for new run only)*

- [ ] 13-58-PLAN.md — Historical remote-handoff contract bound to p13-57; do not execute (local terminal never unlocked). Superseded by 13-61.

**Wave 53** *(gap closure; blocked on Wave 52)*

- [ ] 13-59-PLAN.md — Historical production UI contract bound to p13-57; do not execute. Superseded by 13-62.

**Wave 54** *(gap closure; blocked on 13-57 local dashboard auth freeze + 13-56 preflight green)*

- [x] 13-60-PLAN.md — Executed once as pre-allocation block `blocked_without_local_session_proof`; no run id; re-execute after cookie/IAB session proof.

**Wave 55** *(gap closure; blocked on Wave 54 local terminal; human remote auth for new run only)*

- [ ] 13-61-PLAN.md — One human-gated remote handoff bound to p13-60; remote pending with non-empty itemId or permanent checkpoint; never reopen p13-55/p13-57.

**Wave 56** *(gap closure; blocked on Wave 55)*

- [ ] 13-62-PLAN.md — Production session + ordered https://starye.org Dashboard→viewer on p13-60 remote pending (or blocked_on_remote_checkpoint), dual verify, refresh 13-VERIFICATION.md from live truths.

**Success criteria:**

1. Local smoke goes through `http://localhost:8080/...` and verifies API, auth/dashboard, and content routes without treating direct app ports as canonical.
2. Local D1 schema and minimal data setup can be verified before production deploy.
3. A targeted crawler or fixture writes a known item to the selected API target and records item identity.
4. D1/API/admin checks prove the item exists and is manageable after ingest.
5. Front-end viewing proves the item is visible through the selected canonical Gateway domain, with local and production smoke evidence captured.

### Phase 14: Test and Operations Hardening

**Goal:** Turn the v1.2 switching and full-chain proof into repeatable tests, runbook procedures, and final evidence mapping.

**Requirements:** TEST-01, TEST-06, TEST-07

**Plans:** 7/7 plans complete

- [x] 14-01-PLAN.md — Promote TargetProfile Pages metadata and add the strict redirect renderer contract.
- [x] 14-02-PLAN.md — Materialize selected-target redirects, atomically write final build output, and remove tracked redirect sources.
- [x] 14-03-PLAN.md — Pass prepared redirect input through all five Pages CI workflows and enforce their inventory contract.
- [x] 14-04-PLAN.md — Add the tracked-file fixed-literal audit and migrate non-redirect active literals.
- [x] 14-05-PLAN.md — Consolidate test default-target fixtures and close the zero-unclassified TEST-01 gate.
- [x] 14-06-PLAN.md — Rewrite the stable target-first RUNBOOK and test its metadata and terminal-state contract.
- [x] 14-07-PLAN.md — Create the final read-only 30-row requirement-to-evidence matrix and validator.

**Wave 1:** `14-01-PLAN.md`, `14-06-PLAN.md`

**Wave 2:** `14-02-PLAN.md` (depends on 14-01)

**Wave 3:** `14-03-PLAN.md` (depends on 14-02)

**Wave 4:** `14-04-PLAN.md` (depends on 14-03)

**Wave 5:** `14-05-PLAN.md` (depends on 14-04)

**Wave 6:** `14-07-PLAN.md` (depends on 14-05 and 14-06)

**Success criteria:**

1. Active source/test literals for `starye.org` are either parameterized, converted to default-target fixtures, or explicitly justified.
2. RUNBOOK documents account/domain switching, local env normalization, required secrets, deploy, smoke, rollback, and recovery paths.
3. Final verification maps every v1.2 requirement to a command output, automated test, smoke result, or artifact.

## Coverage

- v1.2 requirements: 30 total
- Mapped to phases: 30
- Unmapped: 0

## Next

13-60 stopped at local session gate (no run id). Unblock with untracked `local-session.cookie` or recoverable IAB signed-session proof, then re-run:

```text
$gsd-execute-phase 13 --gaps-only
```

Immutable: p13-55 remote, p13-57 local. 13-61/13-62 still wait on a terminal local carrier.

### Phase 15: Reconcile v1.2 evidence matrix with Phase 13 closeout

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 14
**Plans:** 0 plans

Plans:

- [ ] TBD (run /gsd-plan-phase 15 to break down)

---
*Last updated: 2026-07-26 after 13-60 pre-allocation session-gate block*
