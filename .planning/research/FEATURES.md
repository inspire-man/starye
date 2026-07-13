# Feature Research

**Domain:** Cloudflare account/domain switching and end-to-end release verification for a personal content platform
**Researched:** 2026-07-13
**Confidence:** HIGH

## Feature Landscape

### Table Stakes (Users Expect These)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Deployment target profile manifest | Account/domain switching cannot be reproducible if target values live across comments, secrets, and local memory. | MEDIUM | Should include account ID, zone/domain, Workers names, Pages projects, D1 DB, R2 bucket, KV namespace, public URLs, crawler API URL and required secrets. |
| Wrangler env/config support | Official Cloudflare deployment path expects explicit env/config/profile selection. | MEDIUM | API/gateway/dashboard currently have hard-coded values; v1.2 should make target selection explicit. |
| GitHub Actions profile selection | Production deploy/crawl/migration happens in CI, where local Wrangler profiles do not apply. | MEDIUM | Use GitHub environments, workflow inputs, or target-specific secret names; preserve rollback/migration gates. |
| Domain-aware gateway and API config | Gateway, CORS, auth URLs and front-end API URLs are domain-sensitive. | HIGH | `apps/api/src/config.ts`, `apps/gateway/wrangler.toml`, gateway tests and RUNBOOK all contain current-domain assumptions. |
| Local full-chain smoke | The repo rule says local verification must go through Gateway at `http://localhost:8080/...`. | MEDIUM | Must cover API health, dashboard/auth route, comic/movie/blog visible route, and crawler-to-API ingestion where feasible. |
| Production full-chain smoke | The milestone goal requires evidence from deployed production, not only local tests. | HIGH | Should include deploy result, D1 migration state, crawler run or targeted crawl, admin validation, and front-end viewing URL. |
| Data pipeline validation | Crawling, D1 persistence, admin management, and front-end viewing are the core user chain. | HIGH | Use a small deterministic fixture/target to avoid long, flaky crawler runs during normal verification. |
| Test and runbook coverage | "完善所有测试" means durable repeatability, not one-off manual commands. | HIGH | Add focused unit/integration/smoke/UAT checks and update RUNBOOK as the canonical ops owner. |

### Differentiators (Competitive Advantage)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Fail-closed target validation | Prevents deploying to account A with account B's D1/R2/KV/domain values. | MEDIUM | Validate account ID/resource IDs/domain/profile before deploy. |
| Evidence bundle per deployment target | Makes release proof auditable across local and production. | MEDIUM | Store check outputs or summary artifact references in phase verification files. |
| One command local smoke | Reduces friction before production deploy. | MEDIUM | Should call existing scripts and Gateway URL, not duplicate app-specific checks. |
| Minimal production smoke mode | Allows safe proof without running a six-hour crawl. | MEDIUM | Targeted crawler URL or seeded fixture plus API/admin/front-end checks. |
| Account/domain switch runbook | Helps future operator switch back or add another domain without rediscovering steps. | LOW | RUNBOOK is canonical owner for long-term deployment/rollback/storage ops. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Full infrastructure-as-code rewrite | Sounds clean for multi-account Cloudflare resources. | Too large for this milestone; risks dragging resource creation, DNS, Pages, Workers and secrets into one risky phase. | Start with explicit profile manifests and validation; add IaC later if needed. |
| Running the entire crawler corpus as smoke | Looks like strong end-to-end proof. | Expensive, slow, flaky, and can stress source sites. | Use targeted crawl fixture/URL plus separate scheduled crawl observability. |
| Replacing all app deployment with one giant workflow | Promises simplicity. | Creates a single blast radius for every app and makes rollback harder. | Add profile-aware inputs to existing app-specific workflows and keep rollback boundaries. |
| Using Pages default domains as acceptance URLs | Easy to test. | Does not prove Gateway/canonical domain behavior, auth cookies, CORS, or redirects. | Gateway canonical URL for local and production acceptance. |
| Storing secrets in repo profile files | Makes local switching easy. | Security risk and likely accidental leak. | Store secret names/requirements in manifests; real values stay in `.dev.vars`, Wrangler secrets, GitHub secrets/environments. |

## Feature Dependencies

```text
Deployment target profile
    -> Wrangler/API/gateway/dashboard config selection
        -> CI deploy/migration/crawler target selection
            -> Local smoke
            -> Production deploy smoke
                -> Targeted crawler ingestion
                    -> Dashboard/admin validation
                        -> Front-end viewing validation

Test harness
    -> Local smoke
    -> Production smoke
    -> Regression guard for future account/domain changes
```

### Dependency Notes

- **Deployment target profile requires resource inventory:** Without known D1/R2/KV/Pages/Workers/domain values, scripts cannot fail closed.
- **CI target selection requires secret strategy:** GitHub Actions use `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`; local Wrangler profiles are irrelevant in CI.
- **Production smoke requires deploy/migration first:** API/gateway must point at the selected account/domain before crawler/admin/front-end checks have meaning.
- **Viewing validation requires data chain:** A front-end page can load without proving fresh crawl/ingest; the smoke should trace a known item.

## MVP Definition

### Launch With (v1.2)

- [ ] Deployment target profile model and validation for account/domain/resource bindings.
- [ ] API/gateway/dashboard Cloudflare config can be selected per target without editing hard-coded production values.
- [ ] GitHub deploy/migration/crawler workflows can run against a selected target using the correct account/domain secrets.
- [ ] Local Gateway-first smoke proves API, dashboard/auth, content app access, and a minimal data path.
- [ ] Production smoke proves deploy, D1 migration state, crawler ingestion, admin validation, and front-end viewing on the selected domain.
- [ ] Tests and RUNBOOK document the repeatable verification path.

### Add After Validation (v1.x)

- [ ] Full infrastructure-as-code provisioning for new Cloudflare accounts.
- [ ] Automated DNS record creation and certificate validation.
- [ ] Rich deployment evidence dashboard.
- [ ] Multi-target scheduled crawler matrix.

### Future Consideration (v2+)

- [ ] Multi-user account/domain administration UI.
- [ ] Blue/green account migration with live traffic switching.
- [ ] Cross-account backup replication.

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Deployment target profile | HIGH | MEDIUM | P1 |
| Wrangler config/env selection | HIGH | MEDIUM | P1 |
| Domain-aware API/gateway/auth config | HIGH | HIGH | P1 |
| GitHub Actions target selection | HIGH | MEDIUM | P1 |
| Local full-chain smoke | HIGH | MEDIUM | P1 |
| Production deploy/data smoke | HIGH | HIGH | P1 |
| Evidence bundle | MEDIUM | MEDIUM | P2 |
| One command smoke wrapper | MEDIUM | MEDIUM | P2 |
| IaC provisioning | MEDIUM | HIGH | P3 |

## Competitor Feature Analysis

This is an internal personal platform, so "competitor" analysis is less relevant than ecosystem pattern analysis.

| Feature | Cloudflare Official Pattern | Current Repo State | Our Approach |
|---------|-----------------------------|--------------------|--------------|
| Multi-account local work | Wrangler auth profiles, `--profile`, pinned `account_id` | `PREPARATION.md` still describes logout/delete `.wrangler` flow | Use profiles for local switching and document fallback recovery. |
| CI deploy auth | `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` | Workflows already use these but only one global secret set | Add target-aware secret/environment strategy. |
| Env-specific bindings | Wrangler env blocks and per-env resource bindings | API/gateway configs mostly top-level hard-coded | Move target-sensitive values behind env/profile selection. |
| Local binding tests | Miniflare / Workers test tooling | Repo uses Vitest and custom D1 adapter in places | Extend existing tests first; add Cloudflare-specific test tooling only where it reduces fake-env drift. |

## Sources

- Context7 `/llmstxt/developers_cloudflare_workers_llms-full_txt` — env-specific bindings, routes/custom domains, deploy commands.
- Context7 `/cloudflare/workers-sdk` — Wrangler E2E helper and Miniflare persisted D1/KV/R2 examples.
- Cloudflare Docs: <https://developers.cloudflare.com/workers/wrangler/profiles/> — local profiles and CI/API-token boundary.
- Cloudflare Docs: <https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/> — GitHub Actions deploy auth.
- Cloudflare Docs: <https://developers.cloudflare.com/d1/wrangler-commands/> — D1 migration/export/local/remote commands.
- Repository evidence: `apps/api/wrangler.toml`, `apps/gateway/wrangler.toml`, `.github/workflows/deploy-*.yml`, `.github/workflows/deploy-migrations.yml`, `.github/workflows/daily-manga-crawl.yml`, `apps/api/src/config.ts`, `apps/gateway/src/index.ts`, `RUNBOOK.md`.

---
*Feature research for: Starye v1.2 Cloudflare account/domain switching*
*Researched: 2026-07-13*
