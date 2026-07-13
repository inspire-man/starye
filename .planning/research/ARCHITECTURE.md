# Architecture Research

**Domain:** Cloudflare account/domain switching and end-to-end release verification for Starye
**Researched:** 2026-07-13
**Confidence:** HIGH

## Standard Architecture

### System Overview

```text
┌─────────────────────────────────────────────────────────────┐
│ Operator / CI Target Selection                              │
│ local profile | GitHub environment | workflow_dispatch input │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│ Deployment Target Profile                                   │
│ account_id, domain, zone, API/gateway routes, Pages origins, │
│ D1 DB, R2 bucket, KV namespace, secret requirements          │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│ Config Projection Layer                                     │
│ Wrangler env/config, app public URLs, CORS/auth origins,     │
│ GitHub env/secrets, crawler API URL, smoke base URLs         │
└──────────────┬───────────────┬─────────────────┬────────────┘
               │               │                 │
┌──────────────▼───┐ ┌────────▼────────┐ ┌───────▼───────────┐
│ Workers          │ │ Pages apps      │ │ GitHub Actions    │
│ API / Gateway    │ │ dashboard/movie │ │ deploy/migrate/   │
│ D1/R2/KV bindings│ │ comic/blog/auth │ │ crawl/rollback    │
└──────────────┬───┘ └────────┬────────┘ └───────┬───────────┘
               │              │                  │
┌──────────────▼──────────────▼──────────────────▼────────────┐
│ Verification Chain                                           │
│ local Gateway smoke -> production deploy smoke -> crawler ->  │
│ D1/API/admin validation -> front-end viewing -> evidence      │
└──────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| Deployment target profile | Single non-secret description of account/domain/resource target. | Versioned JSON/TOML/TS manifest plus schema validation. |
| Config resolver | Projects profile values into Wrangler, app env, workflow env, and smoke command inputs. | Typed helper or scripts that produce config/env files; fail closed when required values are missing. |
| Wrangler env/config | Cloudflare runtime bindings and routes. | `wrangler.toml`/`wrangler.jsonc` env blocks or generated config selected by `--env`/`--config`. |
| GitHub environment strategy | Selects the correct account token, account ID, API URL, R2 bucket, crawler secret and domain. | GitHub environments or workflow inputs mapped to explicit secrets. |
| Local smoke harness | Proves repo works through local Gateway. | PowerShell/Node wrapper around existing scripts and `http://localhost:8080/...` checks. |
| Production smoke harness | Proves deployed target works end to end. | Scripted checks against canonical domain plus crawler/admin/front-end evidence. |
| Evidence writer | Captures what was checked and where output lives. | Phase `*-VERIFICATION.md`, GitHub artifacts, and RUNBOOK references. |

## Recommended Project Structure

```text
config/
└── cloudflare-targets/
    ├── schema.ts                 # typed profile schema and validation
    ├── starye-org.json           # current target, no secrets
    └── <new-domain>.json         # future target, no secrets

scripts/
├── cloudflare/
│   ├── resolve-target.ts         # reads target profile and validates resource IDs/domains
│   ├── render-wrangler-env.ts    # optional config projection if env blocks are not enough
│   ├── smoke-local.ts            # Gateway-first local smoke
│   └── smoke-production.ts       # production chain smoke
└── verify-*.ts / *.ps1           # existing verification scripts extended where useful

apps/
├── api/wrangler.toml             # env/profile-aware D1/R2/KV/routes/vars
├── gateway/wrangler.toml         # env/profile-aware routes/origins/KV
└── dashboard/wrangler.toml       # env/profile-aware public API URL

.github/workflows/
├── deploy-*.yml                  # target-aware deploys
├── deploy-migrations.yml         # target-aware D1 export/apply, backup bucket validation
├── daily-*-crawl.yml             # target-aware crawler API/R2/secrets
└── rollback.yml                  # target-aware rollback commands
```

### Structure Rationale

- **`config/cloudflare-targets/`:** keeps account/domain/resource identity in one current owner without leaking secrets.
- **`scripts/cloudflare/`:** deployment and smoke orchestration belongs outside app runtime code; implementation phases can add only what is needed.
- **Wrangler files stay with apps:** Cloudflare runtime config remains close to each deployable surface.
- **GitHub workflows stay app-specific:** existing rollback/deploy boundaries are valuable; avoid one giant workflow.

## Architectural Patterns

### Pattern 1: Target Manifest With Fail-Closed Validation

**What:** A non-secret target profile describes every Cloudflare resource and canonical URL required for one deploy target.
**When to use:** Any command that deploys, migrates, crawls, or smokes a Cloudflare target.
**Trade-offs:** Adds up-front schema work but prevents mixed-account mistakes.

**Example:**

```json
{
  "id": "starye-org",
  "accountId": "72b60b6c...",
  "domain": "starye.org",
  "apiHost": "api.starye.org",
  "workers": {
    "api": "starye-api",
    "gateway": "starye-gateway"
  },
  "resources": {
    "d1Database": "starye-db",
    "r2Bucket": "starye-media",
    "kvCacheNamespaceId": "f7f6a8..."
  },
  "requiredSecrets": [
    "CLOUDFLARE_API_TOKEN",
    "CLOUDFLARE_ACCOUNT_ID",
    "CRAWLER_SECRET",
    "R2_BUCKET_NAME"
  ]
}
```

### Pattern 2: Config Projection, Not String Scattering

**What:** Runtime configs consume resolved target values instead of literals repeated through source, tests, docs and workflows.
**When to use:** `WEB_URL`, `ADMIN_URL`, `API_ORIGIN`, Pages origins, CORS allowed origins, Better Auth base URLs, smoke URLs.
**Trade-offs:** Requires a resolver boundary; reduces future domain-switch churn.

### Pattern 3: Local Profiles for Humans, API Tokens for CI

**What:** Wrangler auth profiles help local operators switch Cloudflare accounts; CI uses secrets.
**When to use:** Local deploy/testing against different accounts.
**Trade-offs:** Wrangler profiles are beta and local-only; never make them the CI contract.

### Pattern 4: Gateway-First Acceptance

**What:** Smoke tests route through `http://localhost:8080` locally and the production canonical domain remotely.
**When to use:** All user-visible acceptance checks.
**Trade-offs:** Direct app ports still help debugging, but do not satisfy repo-level acceptance.

## Data Flow

### Deployment Flow

```text
Select target
  -> validate target profile and required secrets
  -> render/select Wrangler/app/workflow config
  -> run typecheck/build/tests
  -> apply D1 backup/migration gate
  -> deploy API/gateway/Pages apps
  -> run production smoke
  -> write verification evidence
```

### Content Pipeline Flow

```text
Targeted crawler run
  -> API service-token auth
  -> D1 write
  -> optional R2 necessary asset write only
  -> admin/dashboard validation
  -> front-end canonical-domain viewing
  -> verification artifact
```

### State Management

```text
Target profile (non-secret)
  -> config resolver
  -> command env / Wrangler env / workflow env
  -> runtime Env bindings
```

### Key Data Flows

1. **Local smoke:** Start app/dev stack -> Gateway `8080` -> API/dashboard/movie/comic/blog/auth routes -> local D1 or test fixture evidence.
2. **Production deploy:** GitHub environment secrets -> Wrangler deploy/migrations -> canonical domain smoke -> verification.
3. **Crawler ingestion:** GitHub workflow or local targeted command -> API URL + CRAWLER_SECRET -> D1 -> dashboard/front-end evidence.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| One personal target | One `starye-org` profile, one GitHub environment, direct smoke scripts. |
| Two or three targets | Multiple target profiles, GitHub environments, required profile selection in workflows. |
| Many targets | Consider Cloudflare IaC / Terraform / API-based provisioning and generated workflows. |

### Scaling Priorities

1. **First bottleneck:** Mixed domain/account/resource IDs. Fix with manifest validation before adding automation.
2. **Second bottleneck:** Flaky end-to-end crawler proof. Fix with targeted fixture/URL smoke instead of full corpus runs.
3. **Third bottleneck:** Manual GitHub secret drift. Fix with explicit secret inventory and environment-level checks.

## Anti-Patterns

### Anti-Pattern 1: Hidden Singleton Production Target

**What people do:** Leave `starye.org`, `starye-db`, KV ID and bucket names scattered across code and tests.
**Why it's wrong:** Switching account/domain becomes a search-and-replace operation with high miss risk.
**Do this instead:** One deployment target profile plus tests that assert config uses resolved target values.

### Anti-Pattern 2: CI Uses Whatever Wrangler Logged Into Locally

**What people do:** Assume Wrangler profiles affect GitHub Actions.
**Why it's wrong:** Official docs state API token overrides profiles and profiles are local-machine convenience.
**Do this instead:** CI uses `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` from the selected GitHub environment.

### Anti-Pattern 3: Pages Default Domain Smoke

**What people do:** Verify `*.pages.dev` and call release done.
**Why it's wrong:** It bypasses gateway path routing, auth cookie domain behavior, CORS, redirects and canonical SEO/noindex rules.
**Do this instead:** Smoke through the gateway production domain.

### Anti-Pattern 4: Full-Scale Crawler as Release Gate

**What people do:** Treat a long scheduled crawler run as the only ingestion proof.
**Why it's wrong:** It is slow, source-site-dependent and hard to debug.
**Do this instead:** Use a minimal deterministic target plus separate scheduled crawler monitoring.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Cloudflare Workers | Wrangler deploy/env/config, routes/custom domains | API/gateway Worker config is the first hardening surface. |
| Cloudflare Pages | Project deploy plus public env vars | Dashboard has Wrangler config; other Pages apps may be configured by workflow or dashboard and need inventory. |
| Cloudflare D1 | `wrangler d1 migrations list/apply/export`, local/remote flags | Migration safety must stay intact and target-aware. |
| Cloudflare R2 | Bucket binding and `wrangler r2 object put/list` | Preserve v1.1 no-chapter-body policy and backup prefix semantics. |
| Cloudflare KV | Namespace binding | API/gateway share current namespace ID; profile-specific IDs are required. |
| GitHub Actions | Environment secrets and workflow inputs | CI cannot use local profiles. |
| Source content sites | Targeted crawler URL | Use conservative, bounded smoke target to avoid high-cost source interaction. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `config/cloudflare-targets` -> scripts/workflows | Structured profile values | No secrets in repo. |
| `apps/gateway` -> app origins | Env vars / Wrangler vars | Origin defaults must not lock production to one domain. |
| `apps/api` -> web/admin origins | Env vars / CORS resolver | Allowed origins need domain-aware tests. |
| crawler -> API | `API_URL` + `CRAWLER_SECRET` | API_URL must point at selected target and Gateway/canonical path as decided. |
| dashboard/front-end -> API | public env vars | Must switch with domain/profile. |

## Sources

- Context7 `/llmstxt/developers_cloudflare_workers_llms-full_txt` — Wrangler env, route/custom-domain and binding examples.
- Context7 `/cloudflare/workers-sdk` — Miniflare persisted D1/KV/R2 and Wrangler E2E testing patterns.
- Cloudflare Docs: <https://developers.cloudflare.com/workers/wrangler/profiles/> — profiles, resolution order, account selection, CI boundary.
- Cloudflare Docs: <https://developers.cloudflare.com/pages/functions/wrangler-configuration/> — Pages env-specific bindings.
- Cloudflare Docs: <https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/> — GitHub Actions deployment auth.
- Cloudflare Docs: <https://developers.cloudflare.com/d1/wrangler-commands/> — D1 commands and migration behavior.
- Repository evidence: `apps/api/src/config.ts`, `apps/gateway/src/index.ts`, `apps/api/wrangler.toml`, `apps/gateway/wrangler.toml`, `.github/workflows/*`.

---
*Architecture research for: Starye v1.2 Cloudflare account/domain switching*
*Researched: 2026-07-13*
