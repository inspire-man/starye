# Requirements: Starye v1.2 Cloudflare 账户/域名切换与全链路发布验证

**Defined:** 2026-07-13
**Core Value:** 部署在公网、能稳定日常使用的个人内容中台 —— "能用、不崩" 优先于 "功能全"。

## v1.2 Requirements

### Target Profiles

- [x] **PROF-01**: Operator can define a non-secret Cloudflare target profile with account, domain, Workers, Pages, D1, R2, KV, URLs, and required-secret metadata.
- [x] **PROF-02**: Operator can validate a target profile before deploy, migration, crawl, or smoke commands run.
- [x] **PROF-03**: Operator gets fail-closed errors when account, domain, resource IDs, bucket names, or required secrets are missing or inconsistent.
- [x] **PROF-04**: Operator can use Wrangler auth profiles for local account switching while CI remains token/account-secret based.

### Env Config

- [x] **ENV-01**: Operator can define local env values once and project them into Worker `.dev.vars`, Vite `.env`, Nuxt runtime config, and crawler env files.
- [x] **ENV-02**: Operator can validate local env completeness before starting the full local stack.
- [x] **ENV-03**: Front-end apps share a typed public config contract for API base, gateway base, app base paths, and selected target identity.
- [x] **ENV-04**: Front-end runtime config exposes only public values and blocks accidental exposure of secrets through `VITE_*` or `NUXT_PUBLIC_*`.
- [x] **ENV-05**: Gateway/API remain the service-discovery boundary for internal origins; browser apps call the canonical gateway/API instead of discovering individual services.
- [ ] **ENV-06**: Local and production smoke tests verify that front-end config resolves to the selected target without source-code edits.

### Cloudflare Deploy Config

- [x] **DEPL-01**: Operator can deploy API, gateway, and dashboard using target-aware Wrangler config or env selection.
- [x] **DEPL-02**: Gateway routes/origins, API CORS/auth URLs, and front-end API URLs switch according to the selected target domain.
- [ ] **DEPL-03**: GitHub deploy workflows can select the correct Cloudflare account/domain secret set.
- [ ] **DEPL-04**: D1 migration workflow exports backup, validates target bucket/account, and applies migrations against the selected target.
- [ ] **DEPL-05**: Crawler workflows use target-specific `API_URL`, `CRAWLER_SECRET`, R2 bucket, and Cloudflare account credentials.
- [ ] **DEPL-06**: Operator can rollback the selected API/gateway/Pages target using documented commands.

### Data Chain Smoke

- [ ] **DATA-01**: Operator can run local smoke through `http://localhost:8080/...` for API, auth/dashboard, and content routes.
- [ ] **DATA-02**: Operator can verify local D1 schema and minimal data setup before production deploy.
- [ ] **DATA-03**: Operator can run a targeted crawler or fixture against the selected API target and record the resulting item identity.
- [ ] **DATA-04**: Operator can verify the crawled item exists in D1/API/admin state.
- [ ] **DATA-05**: Operator can manage or validate the crawled item through dashboard.
- [ ] **DATA-06**: Operator can view the crawled/managed item through the selected canonical gateway domain.
- [ ] **DATA-07**: Operator can capture local and production smoke evidence as verification artifacts.

### Tests And Ops

- [ ] **TEST-01**: Active source/tests no longer depend on unqualified `starye.org` literals except default-target fixtures.
- [x] **TEST-02**: Automated tests cover target profile validation and fail-closed mismatch cases.
- [ ] **TEST-03**: Automated tests cover domain-aware gateway/API/auth configuration.
- [x] **TEST-04**: Automated tests cover deploy, migration, and crawler workflow target resolution without real secrets.
- [ ] **TEST-05**: Smoke scripts produce repeatable local and production verification output.
- [ ] **TEST-06**: RUNBOOK documents account/domain switching, required secrets, deploy, smoke, rollback, and recovery.
- [ ] **TEST-07**: Final verification checklist maps every v1.2 requirement to command output or artifact evidence.

## Future Requirements

Deferred to future milestones unless explicitly pulled forward.

### Infrastructure Automation

- **FUT-01**: Operator can provision Cloudflare Workers, Pages, D1, R2, KV, DNS, and routes from infrastructure-as-code.
- **FUT-02**: Operator can automatically create DNS/project/resource records for a new Cloudflare account/domain.
- **FUT-03**: Operator can run scheduled crawler jobs across a matrix of deployment targets.
- **FUT-04**: Operator can perform blue/green cross-account migration with live traffic switching.

## Out of Scope

Explicit exclusions for v1.2.

| Feature | Reason |
|---------|--------|
| Real secrets in repo profile files | Secrets must stay in `.dev.vars`, Wrangler secrets, GitHub secrets/environments, or local operator stores. |
| Full crawler corpus as release gate | Too slow and flaky for milestone verification; use a targeted crawl or fixture for smoke. |
| Paid Cloudflare add-ons | v1.1 locked free-tier-first policy; paid add-ons require separate cost approval. |
| Multi-user account/domain management UI | Starye remains single-operator; profile management can stay in config/scripts. |
| Full Cloudflare IaC provisioning | Valuable later, but too broad for this milestone's deploy/data-chain verification goal. |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| PROF-01 | Phase 11 | Complete |
| PROF-02 | Phase 11 | Complete |
| PROF-03 | Phase 11 | Complete |
| PROF-04 | Phase 11 | Complete |
| ENV-01 | Phase 11 | Complete |
| ENV-02 | Phase 11 | Complete |
| ENV-03 | Phase 12 | Complete |
| ENV-04 | Phase 12 | Complete |
| ENV-05 | Phase 12 | Complete |
| ENV-06 | Phase 12 | Pending |
| DEPL-01 | Phase 12 | Complete |
| DEPL-02 | Phase 12 | Complete |
| DEPL-03 | Phase 12 | Pending |
| DEPL-04 | Phase 12 | Pending |
| DEPL-05 | Phase 12 | Pending |
| DEPL-06 | Phase 12 | Pending |
| DATA-01 | Phase 13 | Pending |
| DATA-02 | Phase 13 | Pending |
| DATA-03 | Phase 13 | Pending |
| DATA-04 | Phase 13 | Pending |
| DATA-05 | Phase 13 | Pending |
| DATA-06 | Phase 13 | Pending |
| DATA-07 | Phase 13 | Pending |
| TEST-01 | Phase 14 | Pending |
| TEST-02 | Phase 11 | Complete |
| TEST-03 | Phase 12 | Pending |
| TEST-04 | Phase 12 | Complete |
| TEST-05 | Phase 13 | Pending |
| TEST-06 | Phase 14 | Pending |
| TEST-07 | Phase 14 | Pending |

**Coverage:**

- v1.2 requirements: 30 total
- Mapped to phases: 30
- Unmapped: 0

---
*Requirements defined: 2026-07-13*
*Last updated: 2026-07-13 after roadmap creation*
