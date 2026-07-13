# Project Research Summary

**Project:** Starye — 个人内容中台
**Domain:** Cloudflare account/domain switching and local-to-production content pipeline verification
**Researched:** 2026-07-13
**Confidence:** HIGH

## Executive Summary

v1.2 should be treated as a deployment-target and verification milestone, not a feature expansion milestone. The main problem is that Starye currently has one implicit production target (`starye.org` plus one Cloudflare account/resource set) spread across Wrangler files, GitHub workflows, CORS/auth config, gateway origins, crawler secrets, tests and RUNBOOK. Switching Cloudflare account/domain safely requires one explicit target model and fail-closed validation before deployment, migration, crawler or smoke commands run.

Official Cloudflare guidance supports two different switching mechanisms that must not be confused: Wrangler authentication profiles are useful for local operators working across multiple accounts, while CI/CD uses `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. Therefore v1.2 should separate local profile ergonomics from GitHub Actions target selection and secret inventory. The acceptance path should remain Gateway-first: local verification through `http://localhost:8080/...`, production verification through the selected canonical domain, not direct app ports or `*.pages.dev` URLs.

The highest-risk part is the data chain. A deploy can succeed while crawler auth, D1 migration, R2 backup, dashboard management or front-end viewing still point at the wrong target. The milestone should therefore end with a minimal, deterministic full-chain smoke: targeted crawl or fixture -> API write -> D1/admin validation -> front-end viewing through canonical gateway -> verification artifact.

## Key Findings

### Recommended Stack

Use the existing stack and harden its configuration boundaries rather than introducing a new platform.

**Core technologies:**
- Wrangler `^4.90.0`: deployment, env/config/profile selection, D1/R2/KV commands.
- Cloudflare Workers: API and gateway runtime with target-specific bindings/routes.
- Cloudflare Pages: dashboard/movie/comic/blog/auth front-end hosting with target-specific public API/origin values.
- D1/R2/KV: existing data/cache/storage layer; all identifiers must become target-specific.
- GitHub Actions: CI/CD, migration, crawler, rollback and evidence collection.
- Vitest/Playwright/smoke scripts: automated local and production evidence.

### Expected Features

**Must have (table stakes):**
- Deployment target profile with account, domain, Workers, Pages, D1, R2, KV, URL and required-secret metadata.
- Wrangler/API/gateway/dashboard config selection by target.
- GitHub Actions target selection for deploy, migration, crawl and rollback workflows.
- Domain-aware API CORS, auth URL, gateway origins and front-end public API config.
- Local Gateway-first full-chain smoke.
- Production full-chain smoke with crawler -> D1 -> admin -> viewing evidence.
- Tests and RUNBOOK updates for repeatability.

**Should have (differentiators):**
- Fail-closed preflight that prevents mixed account/resource/domain deploys.
- Evidence bundle or verification artifact per target.
- One-command smoke wrappers for local and production checks.

**Defer (v2+):**
- Full Cloudflare IaC provisioning.
- Automated DNS/project/resource creation.
- Multi-target scheduled crawler matrix.
- Blue/green account migration.

### Architecture Approach

Introduce a small target-profile layer that projects non-secret target identity into Wrangler config, GitHub workflow inputs/environments, app public URLs, CORS/auth config and smoke scripts. Keep secrets in Wrangler/GitHub/.dev.vars only. Preserve app-specific deploy/rollback workflow boundaries, but make each workflow target-aware. Accept only Gateway/canonical-domain smoke as release evidence.

**Major components:**
1. Target profile manifest — owns account/domain/resource identity without secrets.
2. Config/preflight resolver — validates target completeness and renders/selects config.
3. CI target selection — maps target to GitHub environment/secrets.
4. Runtime config adoption — API/gateway/dashboard/pages consume target values.
5. Smoke/evidence harness — local and production chain verification.

### Critical Pitfalls

1. **Mixed account/resource/domain target** — avoid with target manifest and preflight validation.
2. **Wrangler profiles mistaken for CI auth** — local profiles are separate from GitHub token/account secrets.
3. **Domain switch breaks auth/CORS/gateway** — parameterize domains and test through gateway.
4. **Deploy succeeds but data chain fails** — require crawler/D1/admin/viewing smoke.
5. **Full crawler as gate** — use a deterministic small target, not full scheduled volume.
6. **Tests hard-code old domain** — move domain assumptions into fixtures/profile factories.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 11: Deployment Target Profile Foundation
**Rationale:** Everything else depends on one authoritative target model and fail-closed validation.
**Delivers:** Target manifest/schema, inventory of current `starye.org` resources, local Wrangler profile guidance, preflight checks.
**Addresses:** Profile, account/domain/resource identity, secret requirements.
**Avoids:** Mixed account/resource/domain pitfall.

### Phase 12: Cloudflare Config and CI Target Switching
**Rationale:** After the target is explicit, API/gateway/dashboard/CI workflows can consume it.
**Delivers:** Target-aware Wrangler config or generated env/config, GitHub environment/input strategy, deploy/migration/crawler workflow selection, domain-aware CORS/gateway/front-end config.
**Uses:** Wrangler env/config/profile, GitHub Actions secrets/environments.
**Implements:** Config projection layer and CI target selection.

### Phase 13: Local-to-Production Data Chain Smoke
**Rationale:** User's stated success is not deployment alone; it is crawl -> ingest -> manage -> view.
**Delivers:** Local Gateway-first smoke, production canonical-domain smoke, targeted crawler/fixture flow, D1/admin/front-end evidence.
**Addresses:** End-to-end data chain and "looks deployed but not usable" risk.

### Phase 14: Test Coverage and Operations Hardening
**Rationale:** The milestone asks to complete tests; after the flow exists, harden regression coverage and runbook ownership.
**Delivers:** Parameterized tests, smoke wrappers, RUNBOOK updates, verification checklist, old-domain literal audit, evidence artifact format.
**Addresses:** Tests locking in old domain, non-repeatable release proof.

### Phase Ordering Rationale

- Target identity must come before runtime config changes; otherwise each file invents its own target language.
- CI/deploy switching must come before production smoke; otherwise smoke can only prove the current singleton target.
- Data-chain smoke should come after deploy switching so it proves the selected target.
- Test/runbook hardening should close the milestone after real paths exist and can be documented accurately.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 11:** Confirm exact current Cloudflare resource inventory and what can be validated without live credentials.
- **Phase 12:** Decide whether to use Wrangler env blocks, generated config files, or both; verify Pages workflows/project configuration.
- **Phase 13:** Pick a deterministic crawler target/fixture that is useful but cheap and non-flaky.

Phases with standard patterns:
- **Phase 14:** Mostly repo-local test/runbook work once phase 11-13 contracts are fixed.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Official Cloudflare docs and current repo dependencies align on Wrangler/Workers/Pages/D1/R2/KV/GitHub Actions. |
| Features | HIGH | User goal maps directly to identifiable repo surfaces and official deployment primitives. |
| Architecture | HIGH | Target manifest + config projection is a standard fail-closed pattern for multi-target deployment. |
| Pitfalls | HIGH | Most risks are visible in current repo hard-coded domains/resources and Cloudflare auth semantics. |

**Overall confidence:** HIGH

### Gaps to Address

- **Live Cloudflare inventory:** Research could not verify the user's actual accounts/zones/resource IDs. Phase 11 should inventory from current config and any live credentials the operator chooses to provide.
- **Pages configuration source:** Only dashboard has a tracked Wrangler config; other Pages apps likely rely on workflows/Cloudflare project settings. Phase 12 must inspect each deploy workflow.
- **Crawler smoke target:** Needs a user/repo-approved low-cost target URL or fixture during phase planning.
- **Secrets strategy:** GitHub environment names and secret naming convention need a concrete decision before workflow edits.

## Sources

### Primary (HIGH confidence)
- Context7 `/llmstxt/developers_cloudflare_workers_llms-full_txt` — Wrangler config, env bindings, routes/custom domains, CI deploy commands.
- Context7 `/cloudflare/workers-sdk` — Wrangler E2E helper, Miniflare persisted D1/KV/R2, secrets config behavior.
- Cloudflare Docs: <https://developers.cloudflare.com/workers/wrangler/profiles/> — authentication profiles, resolution order, local-vs-CI boundary, account selection.
- Cloudflare Docs: <https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/> — GitHub Actions authentication with API token/account ID.
- Cloudflare Docs: <https://developers.cloudflare.com/d1/wrangler-commands/> — D1 local/remote, migrations, export, time travel.

### Repository Evidence (HIGH confidence)
- `apps/api/wrangler.toml` — current D1/R2/KV/routes/domain values.
- `apps/gateway/wrangler.toml` — current gateway routes/origins/domain values.
- `apps/dashboard/wrangler.toml` — current public API URL.
- `.github/workflows/deploy-*.yml`, `.github/workflows/deploy-migrations.yml`, `.github/workflows/daily-manga-crawl.yml` — current CI deploy/migration/crawler environment.
- `apps/api/src/config.ts`, `apps/gateway/src/index.ts` — domain/CORS/gateway behavior.
- `RUNBOOK.md` — canonical operations owner for deployment, rollback, D1/R2 and accidental upload handling.

---
*Research completed: 2026-07-13*
*Ready for roadmap: yes*
