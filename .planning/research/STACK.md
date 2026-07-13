# Stack Research

**Domain:** Starye v1.2 Cloudflare account/domain switching and local-to-production content pipeline verification
**Researched:** 2026-07-13
**Confidence:** HIGH

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Wrangler | `^4.90.0` (repo baseline) | Deploy Workers/Pages, manage D1/R2/KV, secrets, profiles and local dev | Official Cloudflare CLI supports `--env`, `--config`, `--env-file`, `--profile`, D1 commands, R2 commands and CI authentication; this is the current deployment control plane. |
| Cloudflare Workers | Existing platform | API and gateway runtime | Existing `apps/api` and `apps/gateway` are Workers; custom domains/routes and bindings are configured through Wrangler files. |
| Cloudflare Pages | Existing platform | Static/front-end app hosting | Existing dashboard/movie/comic/blog/auth deployment target; v1.2 should parameterize Pages project names/domains and verify gateway access through the canonical domain. |
| D1 | Existing platform | Primary relational database | Existing DB is `starye-db`; v1.2 must validate local D1, migration apply/export, and production query evidence. |
| R2 | Existing platform | Necessary asset storage and D1 backup artifact storage | v1.1 locked R2 to necessary assets and auditable backup paths; v1.2 should keep that boundary while making bucket names/account credentials profile-aware. |
| KV | Existing platform | Gateway/API cache namespace | Existing `CACHE` binding is shared by API/gateway; namespace IDs are currently hard-coded and must become profile-specific. |
| GitHub Actions | Existing CI/CD | Deploy, crawl, migrate, rollback, smoke evidence | Existing workflows already inject `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`; v1.2 should formalize profile-specific secrets and workflow inputs/environments. |
| Vitest / Playwright / smoke scripts | Repo baseline | Automated route, integration, and browser-visible verification | v1.2 success depends on evidence, not just config edits; tests must prove local gateway, deployed gateway, crawler ingestion, dashboard management and front-end viewing. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Miniflare / Workers Vitest integration | via Cloudflare Workers SDK | Local Workers binding simulation and persisted D1/KV/R2 fixtures | Use for API/gateway unit and integration tests that should not hit real Cloudflare resources. |
| `@cloudflare/workers-types` | `^4.20260417.1` | Runtime binding types | Continue using precise Env typings when adding profile-aware config. |
| `wrangler auth profiles` | Wrangler beta feature | Local-machine multi-account switching | Use for local operator setup only; CI must still use API token/account ID. |
| Repository scripts under `scripts/` | Existing | Service checks, schema verification, operational smoke | Extend rather than creating a parallel verification language. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `wrangler deploy --env <name>` | Deploy environment-specific Worker config | Works when env blocks carry profile-specific bindings/routes/vars. |
| `wrangler deploy --profile <name>` | Run one local command with a specific auth profile | Local convenience only; API token overrides profiles in CI. |
| `wrangler d1 migrations apply/list/export` | Validate local and remote database lifecycle | Official command supports `--local`, `--remote`, `--env`, `--config`, and `--env-file`; use explicit profile/env. |
| `wrangler r2 object put/list` | Backup artifact and R2 smoke checks | Must use profile-specific bucket names and preserve v1.1 purpose/prefix rules. |
| `scripts/check-services.ps1` | Local service health check | Should remain Gateway-first: canonical local URL is `http://localhost:8080/...`. |

## Installation

No new core runtime dependency is required for milestone planning. The expected implementation should reuse existing dev dependencies:

```bash
pnpm install
pnpm --filter api exec wrangler --version
```

If a phase adds Cloudflare Workers Vitest pool or Miniflare-specific helpers, add them narrowly in that phase only after checking existing test setup.

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Wrangler `env` blocks plus explicit profile/environment wrappers | Multiple divergent `wrangler.toml` files copied per account | Only if Cloudflare config syntax cannot express a needed binding; otherwise copies drift quickly. |
| GitHub environment/secret sets per deployment profile | One global repository secret set | Use one global set only for single-account projects; v1.2 explicitly needs account/domain switching. |
| Local Wrangler auth profiles plus pinned `account_id` | Re-running `wrangler login` and deleting `.wrangler` state | Manual logout/login is acceptable as emergency recovery, not a reproducible workflow. |
| Gateway-first smoke through `http://localhost:8080` and production canonical domain | Direct smoke on random app ports or Pages default domains | Direct ports are useful for debugging but cannot be canonical acceptance evidence in this repo. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Hard-coded `starye.org`, `api.starye.org`, Pages default domains in source/test assertions | Blocks domain switching and makes tests pass only for one account/domain. | Profile-derived config plus tests that inject target domain/origins. |
| Hard-coded D1 database IDs, KV namespace IDs or bucket names without profile metadata | Easy to deploy code to one account while pointing at another account's resources. | Explicit per-profile manifest and Wrangler env binding validation. |
| Treating Wrangler profiles as CI authentication | Official docs state `CLOUDFLARE_API_TOKEN` overrides profiles and profiles are local-machine convenience. | GitHub environments/secrets with `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. |
| Deploying production before proving local data chain | Makes failures ambiguous across config, auth, crawler, DB, and UI. | Local chain first, then production dry-run/smoke with evidence. |
| Broad Cloudflare paid add-ons | Violates free-tier-first v1.1 constraint. | Workers/Pages/D1/R2/KV only unless a later phase explicitly evaluates cost. |

## Stack Patterns by Variant

**If switching local developer accounts:**
- Use Wrangler auth profiles and directory activation.
- Pair profile selection with a pinned `account_id` or profile manifest so wrong-account commands fail closed.

**If switching CI deployment accounts:**
- Use GitHub environments or explicit workflow inputs to select `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, resource IDs, bucket names, and domain names.
- Do not rely on local Wrangler profile state.

**If switching domains inside the same account:**
- Keep account credentials stable but parameterize routes/custom domains, gateway origins, CORS allowed origins, Better Auth URLs, Pages public API URLs, and smoke-test base URLs.

**If switching both account and domain:**
- Treat the deployment target as one profile object: account, zone/domain, Workers names, Pages projects, D1 DB, R2 bucket, KV namespace, CORS/auth URLs, crawler API URL, and smoke URLs.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `wrangler@^4.90.0` | Cloudflare Workers/Pages/D1/R2/KV current docs | Repo already pins this as devDependency; v1.2 should keep commands compatible with Wrangler 4 behavior. |
| Wrangler auth profiles | Local CLI only | Beta. Use as operator helper, not as the single source of truth. |
| D1 migration commands | GitHub Actions and local PowerShell | Use explicit `--remote`/`--local` and avoid ambiguous default targets. |

## Sources

- Context7 `/llmstxt/developers_cloudflare_workers_llms-full_txt` — Wrangler configuration, environments, custom domains/routes, bindings, CI deploy.
- Context7 `/cloudflare/workers-sdk` — Wrangler E2E helper examples, Miniflare persistence for D1/KV/R2, secrets config behavior.
- Cloudflare Docs: <https://developers.cloudflare.com/workers/wrangler/profiles/> — authentication profiles, resolution order, API token override, account selection.
- Cloudflare Docs: <https://developers.cloudflare.com/workers/wrangler/configuration/> — Wrangler config and env flags.
- Cloudflare Docs: <https://developers.cloudflare.com/pages/functions/wrangler-configuration/> — Pages Wrangler configuration with env-specific bindings.
- Cloudflare Docs: <https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/> — GitHub Actions deployment authentication.
- Cloudflare Docs: <https://developers.cloudflare.com/d1/wrangler-commands/> — D1 local/remote commands, migrations, export, time travel.
- Repository evidence: `apps/api/wrangler.toml`, `apps/gateway/wrangler.toml`, `.github/workflows/deploy-*.yml`, `.github/workflows/daily-manga-crawl.yml`, `apps/api/src/config.ts`, `apps/gateway/src/index.ts`.

---
*Stack research for: Starye v1.2 Cloudflare account/domain switching*
*Researched: 2026-07-13*
