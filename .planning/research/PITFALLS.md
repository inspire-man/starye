# Pitfalls Research

**Domain:** Cloudflare account/domain switching and end-to-end release verification for Starye
**Researched:** 2026-07-13
**Confidence:** HIGH

## Critical Pitfalls

### Pitfall 1: Mixed Account, Resource and Domain Target

**What goes wrong:**
API deploys to one Cloudflare account while D1/R2/KV IDs, routes, Pages origins or crawler secrets point at another target.

**Why it happens:**
`wrangler.toml`, GitHub secrets, local `.dev.vars`, workflow env and docs each carry a piece of the target identity. Without a single profile, commands can combine stale values silently.

**How to avoid:**
Create a deployment target manifest and validate account ID, domain, D1 DB, R2 bucket, KV namespace, Worker names, Pages project names and required secret names before deploy/migration/crawl.

**Warning signs:**
Hard-coded IDs/domains in more than one file; workflow uses global secrets only; smoke passes on API but fails through gateway; D1 contains no expected migrated tables after deploy.

**Phase to address:**
First roadmap phase.

---

### Pitfall 2: Treating Wrangler Profiles as CI Contract

**What goes wrong:**
Local profile switching works, but GitHub Actions still deploys with `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` from the old target.

**Why it happens:**
Wrangler profiles are local-machine convenience. Official docs state API token overrides profiles and profiles do not apply in CI/containers.

**How to avoid:**
Separate local profile support from CI target selection. CI must use GitHub environments or explicit target inputs mapped to token/account/resource secrets.

**Warning signs:**
Workflow docs mention `wrangler auth activate`; no GitHub environment/secret inventory exists; workflow dispatch has no target selector.

**Phase to address:**
First or second roadmap phase.

---

### Pitfall 3: Domain Switch Breaks Auth, CORS and Gateway Routing

**What goes wrong:**
Static app loads, but login, dashboard guard, API CORS, auth callbacks or cookie behavior fail on the new domain.

**Why it happens:**
Domain values appear in API CORS (`apps/api/src/config.ts`), gateway routes/origins, front-end API URLs, Better Auth config, tests and RUNBOOK. Pages default-domain smoke does not exercise these paths.

**How to avoid:**
Make domain/profile values flow into API allowed origins, gateway origins, Pages env vars, auth base/callback URLs and tests. Accept only Gateway/canonical domain smoke as release evidence.

**Warning signs:**
Tests still construct `https://starye.org/...`; dashboard smoke uses `*.pages.dev`; local smoke bypasses `http://localhost:8080`.

**Phase to address:**
Second roadmap phase before production smoke.

---

### Pitfall 4: Production "Deploy Succeeded" But Data Chain Was Not Verified

**What goes wrong:**
Workers/Pages deploy successfully, but crawler cannot authenticate, writes to wrong DB, dashboard cannot manage the item, or front-end cannot display it.

**Why it happens:**
Deployment and data lifecycle are separate systems: GitHub deploy workflows, D1 migration workflow, crawler workflows, API service-token auth, dashboard admin UI, and front-end routes.

**How to avoid:**
Define a minimal full-chain smoke: targeted crawl or fixture -> API write -> D1 query/admin validation -> front-end viewing through canonical gateway -> verification artifact.

**Warning signs:**
Verification only shows `wrangler deploy`; no D1 row evidence; no admin endpoint/UI check; no canonical viewing URL.

**Phase to address:**
Third roadmap phase.

---

### Pitfall 5: Full Crawler Used As Gate

**What goes wrong:**
Release gate takes hours, flakes due to source-site behavior, or accidentally increases R2/API/source load.

**Why it happens:**
"Full chain" is interpreted as full production crawler volume instead of a deterministic slice of the chain.

**How to avoid:**
Use a narrow target URL or fixture for milestone smoke. Keep scheduled long crawler runs as operational monitoring, not the gating proof.

**Warning signs:**
Smoke requires a 6-hour GitHub job; crawler env uses broad max counts; verification cannot identify a single expected item.

**Phase to address:**
Third roadmap phase.

---

### Pitfall 6: Tests Lock In The Old Domain

**What goes wrong:**
After profile abstraction, tests still assert `starye.org`, `api.starye.org` or Pages default domains, so they either fail unnecessarily or hide missing parameterization.

**Why it happens:**
Existing gateway tests, e2e fixtures and docs include old domain literals as stable examples.

**How to avoid:**
Move domain assumptions into test fixtures/target profile factories. Keep explicit tests that the default `starye-org` target still resolves to current production.

**Warning signs:**
`rg starye.org` finds active source/test assertions after the config abstraction phase.

**Phase to address:**
Second and fourth roadmap phases.

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Add new domain as another literal in wrangler/tests | Fast deploy | Doubles future switch work and risks mixed domains | Never for active implementation; acceptable only in archived docs. |
| Reuse one global GitHub secret set | No workflow restructuring | Cannot safely switch targets or audit where a deploy went | Only if project explicitly returns to one account/domain. |
| Verify direct app ports or Pages URLs only | Faster local debugging | Misses gateway/auth/CORS/cookie path | Debug-only, not acceptance. |
| Run full crawler for proof | Strong-looking evidence | Slow/flaky/costly | Manual post-release soak, not phase gate. |
| Skip D1 backup/export validation | Faster migration | Weak rollback evidence | Never for production migration. |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Wrangler profiles | Assume profile affects CI | Use profiles only locally; CI uses API token/account ID. |
| Wrangler env blocks | Put vars in top-level config and forget env override | Target-sensitive values must be env/profile-specific. |
| Custom domains/routes | Configure Worker route but forget zone/domain inventory | Include route/custom domain and zone/domain in target manifest. |
| D1 migrations | Apply remote migration to wrong database name/account | Validate target account/database and run `migrations list` before apply. |
| R2 backup | Use stale `R2_BUCKET_NAME` with new account | Validate bucket exists in target account before backup upload. |
| KV cache | Reuse old namespace ID in new account | Treat namespace ID as target-specific. |
| Crawler API_URL | Point crawler to direct API host while acceptance expects gateway | Decide canonical ingestion URL and test it; document exceptions. |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Crawler smoke uses production-size limits | Long GitHub jobs, source throttling, unclear failures | Dedicated smoke target and low limits | Immediately in CI/release gates. |
| Gateway smoke waits on every app build/deploy serially | Slow feedback | Split build/test/deploy and smoke with explicit dependencies | Multi-app production release. |
| R2/KV checks list large prefixes | Slow audit, possible cost/noise | Prefix-scoped, count-limited checks | As storage grows. |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Commit real tokens/secrets in target profile | Credential leak | Profile stores secret names and resource IDs only; values stay in GitHub/Wrangler/.dev.vars. |
| Using over-broad Cloudflare API token for all targets | Any workflow can mutate too much | Document least-privilege token scopes per target where feasible. |
| New domain not covered by auth/cookie/CORS tests | Login bypass/failure or cross-origin exposure | Domain-aware auth/CORS tests and production smoke. |
| Backup object uploaded to wrong bucket/account | Recovery path broken or data leak | Validate bucket/account before migration backup upload. |
| Crawler secret mismatch | Unauthorized crawler or accidental write to wrong API | Target-specific secret inventory and smoke auth check. |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Smoke says "passed" but gives no URL/evidence | Operator cannot trust release | Show canonical URLs, item IDs, migration status and artifacts. |
| Switching target requires editing many files | Slow and error-prone | One profile selector plus generated/validated config. |
| Failure message says only "deploy failed" | Hard to diagnose account vs domain vs resource mismatch | Preflight classifies missing secret, wrong account, missing resource, route/domain failure. |

## "Looks Done But Isn't" Checklist

- [ ] **Profile switching:** `wrangler deploy --profile` works locally, but CI target selection is still single-account.
- [ ] **Domain switching:** Gateway route works, but API CORS/auth callback still accepts only old domain.
- [ ] **Deploy:** Workers deploy, but Pages app public API URL still points at old API.
- [ ] **Migration:** D1 migration applies, but backup was not uploaded to target R2 bucket.
- [ ] **Crawler:** GitHub crawler succeeds, but writes to old `API_URL`.
- [ ] **Admin:** API row exists, but dashboard cannot manage or view it through canonical domain.
- [ ] **Viewing:** Front-end route loads, but no known crawled item is visible.
- [ ] **Tests:** Unit tests pass, but all smoke still bypass Gateway.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Wrong account deploy | MEDIUM | Stop workflows, identify deployed Worker/Pages versions, rollback/delete wrong target only after verifying no user data impact, fix profile validation. |
| Wrong D1 migration target | HIGH | Use D1 time-travel/export evidence, restore or forward-fix, update target manifest and migration preflight. |
| Wrong R2 backup bucket | MEDIUM | Copy/delete only with explicit inventory, update bucket validation, rerun backup. |
| Domain auth/CORS failure | MEDIUM | Patch domain config, redeploy API/gateway/auth, rerun canonical smoke. |
| Crawler wrote wrong API target | MEDIUM/HIGH | Identify inserted rows, decide cleanup vs retain, rotate crawler secret if target was unintended. |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Mixed account/resource/domain | Phase 11 profile/config foundation | Target manifest schema test and preflight failure tests. |
| Wrangler profile vs CI mismatch | Phase 11/12 deployment workflow | GitHub workflow target selection and secret inventory checks. |
| Auth/CORS/gateway domain breakage | Phase 12 domain-aware runtime | Gateway/API/auth tests with injected target domain. |
| Deploy succeeded but data chain unverified | Phase 13 full-chain smoke | Crawler -> D1 -> admin -> viewing smoke artifact. |
| Tests lock in old domain | Phase 14 test expansion | `rg`/test fixture checks plus parameterized tests. |

## Sources

- Cloudflare Docs: <https://developers.cloudflare.com/workers/wrangler/profiles/> — profile resolution, account selection, CI/API-token boundary.
- Cloudflare Docs: <https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/> — GitHub Actions deploy auth.
- Cloudflare Docs: <https://developers.cloudflare.com/d1/wrangler-commands/> — D1 migration/export/local/remote behavior.
- Context7 `/cloudflare/workers-sdk` — Miniflare D1/KV/R2 persistence and Wrangler E2E testing examples.
- Repository evidence: `apps/api/src/config.ts`, `apps/gateway/src/index.ts`, `apps/api/wrangler.toml`, `apps/gateway/wrangler.toml`, `.github/workflows/deploy-migrations.yml`, `.github/workflows/daily-manga-crawl.yml`, `RUNBOOK.md`.

---
*Pitfalls research for: Starye v1.2 Cloudflare account/domain switching*
*Researched: 2026-07-13*
