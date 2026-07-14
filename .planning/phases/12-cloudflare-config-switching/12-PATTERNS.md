---
phase: 12
slug: cloudflare-config-switching
artifact: patterns
status: complete
created: 2026-07-15
---

# Phase 12 Implementation Patterns

## Scope

This mapping is deliberately limited to selected-target projections, browser public runtime adapters, API/gateway domain configuration, workflow target resolution/preflight, remote-mutation workflows, and fixture tests. It does not authorize broad `starye.org` cleanup, UI work, new Cloudflare resources/IaC, or Phase 13 credentialed smoke work.

Required data flow:

```text
tracked TargetProfile + explicit target id
  -> resolveTargetProfile / parseTargetProfile
  -> typed non-secret public, deploy, and workflow projections
  -> runtime consumers OR GitHub resolver-job outputs
  -> Environment-scoped fixed-name secrets + ci/remote preflight + read-only checks
  -> existing deploy/migrate/crawl/rollback command
```

The profile is the only non-secret target source. Browser output must be a typed allowlist, never a pass-through environment map. A workflow may consume validated projection output but may not recreate account IDs, domains, worker/pages identities, or API URLs in YAML.

## Closest Existing Anchors

### 1. Strict target schema and one explicit resolver

- [target-profile.schema.ts](../../../packages/config/src/deployment-target/target-profile.schema.ts) defines closed target surfaces at lines 3-31 and uses `v.strictObject` for the complete profile at lines 120-167. Copy this closed-shape style for any public/deploy/workflow projection input and output. Unknown fields, especially credential-shaped fields, must not be silently retained.
- [target-profile.schema.ts](../../../packages/config/src/deployment-target/target-profile.schema.ts) lines 169-186 cross-check worker routes and Pages canonical URLs against `profile.urls`; projection builders should consume the already parsed profile rather than duplicate this consistency logic.
- [target-resolver.ts](../../../packages/config/src/deployment-target/target-resolver.ts) lines 41-86 is the single resolution choke point: trim input, reject an unknown ID, parse the profile, verify map key equals profile ID, then return `{ id, profile }`. New projection helpers receive `TargetResolution`, not a domain string, `prod`, or an unparsed profile.
- [preflight.ts](../../../packages/config/src/deployment-target/preflight.ts) lines 78-151 adds the stricter legacy-alias boundary (`default`, `prod`, `production`, legacy domains) before calling the resolver. Reuse it for CLI/workflow entry points so aliases never gain a fallback path.

### 2. Managed projection and non-secret reporting

- [projection-plan.ts](../../../packages/config/src/deployment-target/projection-plan.ts) lines 127-182 builds all outputs from one `TargetResolution` and calls `assertProjectionPlanComplete()` before returning. The new public/deploy/CI projection should follow this shape: derive one typed object, assert required surfaces, return only after completeness checks.
- [projection-plan.ts](../../../packages/config/src/deployment-target/projection-plan.ts) lines 18-72 explicitly separates `targetManagedEnvKeysByFile` from `userManagedSecretKeysByFile`. Public config must have an even stronger split: no secret names or values in its type or serialized object.
- [projection-plan.ts](../../../packages/config/src/deployment-target/projection-plan.ts) lines 231-263 returns structured mismatch records, while [preflight.ts](../../../packages/config/src/deployment-target/preflight.ts) lines 112-126 formats only path/key-level messages. Reuse the same two-stage validation/reporting pattern so logs never include a compared credential value.
- [scripts/target-profile.ts](../../../scripts/target-profile.ts) lines 151-159 prints only target ID, profile/account selector names, and resource identity. Machine-readable workflow output should apply the same redaction policy: target ID, mapped Environment, public/deploy identity, and run ID only.

### 3. Fail-closed remote preflight and injected read-only checks

- [preflight.ts](../../../packages/config/src/deployment-target/preflight.ts) lines 189-225 distinguishes local Wrangler-profile validation from CI/remote GitHub-Environment validation. Do not run local `.dev.vars` checks in CI; make projection validation scope-aware before passing it to `runTargetPreflight()`.
- [preflight.ts](../../../packages/config/src/deployment-target/preflight.ts) lines 228-276 requires both fixed credential keys, exact selected account ID, `--live`, and an injected check executor before high-risk remote commands can proceed. Keep its aggregate-error behavior and `blocking: true` result contract.
- [live-checks.ts](../../../packages/config/src/deployment-target/live-checks.ts) lines 29-44 models checks as typed `argv` arrays and [live-checks.ts](../../../packages/config/src/deployment-target/live-checks.ts) lines 63-99 catches executor failures without passing stdout/stderr into an error. Extend this list with selected Workers and Pages projects; do not shell-concatenate resource names or print CLI output.
- [scripts/target-profile.ts](../../../scripts/target-profile.ts) lines 215-228 supplies the production executor with `spawnSync(..., { shell: false })`. Keep the executable wrapper import-safe and make tests inject a fake executor.

### 4. Runtime origin consumers and local Gateway boundary

- [apps/gateway/src/index.ts](../../../apps/gateway/src/index.ts) lines 80-156 is the current runtime split: local requests retain direct development ports, production requests use explicit origin fields and strip app base paths where Pages is rooted. Keep those direct ports internal to the gateway implementation; selected public config still points browsers at `http://localhost:8080` locally.
- [apps/gateway/src/__tests__/routing.test.ts](../../../apps/gateway/src/__tests__/routing.test.ts) lines 37-48 stubs `fetch` and captures the proxied request; lines 231-300 compare production path stripping with local path preservation. This is the closest test harness for profile-derived gateway origins and stable app base paths.
- [apps/api/src/config.ts](../../../apps/api/src/config.ts) lines 3-34 is the CORS choke point consumed by [cors.ts](../../../apps/api/src/middleware/cors.ts) lines 5-14 and [auth.ts](../../../apps/api/src/lib/auth.ts) lines 59-130. Replace only this domain-aware source, then preserve its use by both CORS and Better Auth.
- [apps/dashboard/src/lib/hono-rpc-client.ts](../../../apps/dashboard/src/lib/hono-rpc-client.ts) lines 15-32 is the right browser-client pattern to preserve: a typed client with `credentials: 'include'`, gateway-relative default, and no new service-discovery UI. Nuxt consumers use the analogous `useRuntimeConfig().public.apiUrl` adapter at [useApiClient.ts](../../../apps/blog/app/composables/useApiClient.ts) lines 25-28.

### 5. Workflow command ordering and test fixtures

- [deploy-migrations.yml](../../../.github/workflows/deploy-migrations.yml) lines 13-63 shows an existing independent gate and `needs` sequencing; keep that structure, but place selected-target resolution/preflight before every remote mutation.
- [deploy-migrations.yml](../../../.github/workflows/deploy-migrations.yml) lines 83-132 is the migration sequence that must be corrected to `validation/live read -> D1 export -> selected R2 upload -> repair/apply write`. Its existing `github.run_id`/`github.run_attempt` naming is the reusable non-secret run-identity pattern.
- [rollback.yml](../../../.github/workflows/rollback.yml) lines 24-78 is the Worker command shape; lines 80-91 deliberately fail closed for Pages. Preserve the Pages branch as a failing manual boundary.
- [live-checks.test.ts](../../../packages/config/src/deployment-target/__tests__/live-checks.test.ts) lines 25-63 validates argv arrays through a mocked executor, and lines 110-150 proves errors do not echo token-like output. New workflow/projection fixtures should follow this pattern rather than execute Wrangler.
- [preflight.test.ts](../../../packages/config/src/deployment-target/__tests__/preflight.test.ts) lines 34-54 creates isolated files in an OS temp root, and lines 175-206 tests failure modes while asserting the fixture secret is absent from logs. Reuse this fixture isolation and secret-redaction assertion for config/workflow output tests.

## Target File Map

The module name for a new projection/helper is planner discretion. The data ownership and imports below are not discretionary.

| Target file / group | Role and data flow | Copy from | Required implementation boundary |
|---|---|---|---|
| `packages/config/src/deployment-target/target-profile.schema.ts` | Existing closed profile input schema; only extend if projection metadata cannot be derived from existing fields. | Schema lists and `strictObject` at lines 3-31 and 120-186. | Do not add secret values or a second editable target source. Existing `urls`, `workers`, `pages`, `resources`, and `ci.githubEnvironment` are projection inputs. |
| New typed public/deploy/workflow projection module under `packages/config/src/deployment-target/` | `TargetResolution -> { publicRuntime, deploy, workflow }`; shared semantic contract for runtime adapters, temporary deploy config, and workflow outputs. | `buildLocalEnvProjectionPlan()` at [projection-plan.ts](../../../packages/config/src/deployment-target/projection-plan.ts:127) and completeness assertion at [projection-plan.ts](../../../packages/config/src/deployment-target/projection-plan.ts:185). | Export explicit readonly fields, not `Record<string,string>`. Public contract contains only target ID, canonical gateway/API bases, and fixed app base paths. Build app URLs from `gatewayBase + appBasePath`; exclude `pages.*.canonicalUrl`, Worker origins, Pages deployment origins, account ID, resource IDs, and all secret-shaped fields. |
| `packages/config/src/deployment-target/index.ts` | Public export boundary for the projection/helper API. | Existing one-file barrel at [index.ts](../../../packages/config/src/deployment-target/index.ts:1). | Export only the intended typed functions/types. Keep CLI imports through this package boundary; do not let workflows parse `target-profiles.ts` directly. |
| `packages/config/src/deployment-target/live-checks.ts` | `TargetResolution -> readonly argv-only resource checks -> redacted issues`. | Existing `LiveResourceCheck`, `buildLiveResourceChecks`, and redacted runner at lines 14-99. | Add Worker and Pages identity checks alongside D1/R2/KV. Missing Worker/Pages project must block deployment/rollback; no `pages project create`, no `|| true`, and no command stdout in messages. |
| `packages/config/src/deployment-target/preflight.ts` | Common selected-target, scope, Environment, credentials, and live-check gate. | `resolveSelectedTarget()` lines 128-151; local/CI identity branch lines 189-225; remote gate lines 228-276. | Split local projection-file validation from CI/remote validation so CI does not require operator-owned files. Preserve all blocking diagnostics, fixed credential-key checks, account equality, and legacy-alias rejection. |
| `scripts/target-profile.ts` | Import-safe CLI adapter used by both a resolver job and local operators. | Parser lines 50-132; `shell: false` executor lines 215-228; direct-execution guard lines 290-325. | Add a selected-target projection/output command or equivalent existing command extension. It must require `--target`, serialize only approved non-secret fields, and write a stable machine-readable result suitable for `GITHUB_OUTPUT`; it must not dump `process.env` or secret values. |
| `apps/api/wrangler.toml`, `apps/gateway/wrangler.toml`, `apps/dashboard/wrangler.toml` | Static deploy templates currently containing singleton Worker/Page/resource/public identity. | Current singleton inventory: API lines 1-39, gateway lines 1-38, dashboard lines 1-5. | Remove target-specific runtime facts from committed static config and feed a temporary command-time config from the shared deploy projection. Preserve stable non-target build metadata and gateway local port. Do not add persistent `[env.<target>]` sections. |
| `apps/api/src/config.ts`, `apps/api/src/middleware/cors.ts`, `apps/api/src/lib/auth.ts` | Profile-derived public origins -> CORS allowlist -> Better Auth `trustedOrigins`/cookie domain. | `getAllowedOrigins()` at [config.ts](../../../apps/api/src/config.ts:3), its only CORS consumer at [cors.ts](../../../apps/api/src/middleware/cors.ts:5), and auth's forwarded host/base/cookie flow at [auth.ts](../../../apps/api/src/lib/auth.ts:53). | Change the shared origin source, not every old-domain literal in the repo. Retain local Gateway support (`localhost:8080`) and auth forwarded-host behavior. Do not weaken credentials CORS or add browser recovery UI. |
| `apps/gateway/src/index.ts` and `apps/gateway/src/__tests__/routing.test.ts` | Projected production origins -> gateway routing; local direct ports remain internal. | `Env` fields and branches at [index.ts](../../../apps/gateway/src/index.ts:14) and [index.ts](../../../apps/gateway/src/index.ts:80); captured-fetch harness at [routing.test.ts](../../../apps/gateway/src/__tests__/routing.test.ts:37). | Inject all production origins from one projection. Preserve local/prod rewrite distinction and proxy headers. Tests must use a fixture profile-derived origin set and verify browser canonical base is not a direct app port. |
| `apps/auth/nuxt.config.ts`, `apps/blog/nuxt.config.ts`, `apps/auth/app/lib/auth-client.ts`, `apps/blog/app/lib/auth-client.ts` | Nuxt public config -> auth/browser client base URL. | Nuxt `runtimeConfig.public` lines 38-43 and 52-57; client construction at auth lines 5-9 and blog lines 5-9. | Replace independent `NUXT_PUBLIC_* || VITE_* || fallback` reads with a shared validated adapter. Keep `/auth/` and `/blog/` base paths. Ensure no unregistered public key or secret-shaped value can reach `runtimeConfig.public` or client bundles. |
| `apps/dashboard/vite.config.ts`, dashboard API/auth clients, and direct `VITE_API_URL` consumers in `apps/dashboard/src/views/Actors.vue` and `Publishers.vue` | Vite public projection -> dashboard build/runtime requests. | Stable base path at [vite.config.ts](../../../apps/dashboard/vite.config.ts:17), Hono client at [hono-rpc-client.ts](../../../apps/dashboard/src/lib/hono-rpc-client.ts:15), and current direct imports in `Actors.vue:108,126` / `Publishers.vue:102,120`. | Use the same typed Vite adapter/allowlist. Keep relative Hono RPC where it already correctly uses the gateway; remove only inconsistent direct public-env reads. No dashboard target selector or visual changes. |
| `apps/movie-app/**` and `apps/comic-app/**` API env consumers | Browser app base paths and gateway-relative client behavior. | Vite base paths at `apps/movie-app/vite.config.ts:10` and `apps/comic-app/vite.config.ts:10`; relative clients at `apps/movie-app/src/lib/api-client.ts:29-43` and `apps/comic-app/src/lib/api-client.ts:15-29`. | Preserve existing relative gateway clients where valid. Any `VITE_API_URL` adoption must consume only the shared allowlist and must not turn internal dev proxy ports into canonical public endpoints. |
| `packages/config/src/deployment-target/__tests__/` new/extended projection, public-config, workflow-context, preflight, and live-check test files | In-memory fixture profile -> exact projection/output -> blocking/redaction assertions. | `target-resolver.test.ts:10-37`, `projection-plan.test.ts:23-60`, `preflight.test.ts:34-54,175-206`, and `live-checks.test.ts:25-150`. | Test at least two fixture profiles, legacy aliases, mismatched Environment/account/project, missing Worker/Pages/D1/R2/KV, local-vs-CI projection boundaries, and secret-free serialization/logs. No real credentials or remote Wrangler invocation. |
| Runtime-consumer tests under API/gateway/frontend app test roots | Fixture public contract -> CORS/auth/gateway/Nuxt/Vite consumers. | Gateway mocked-fetch cases at `routing.test.ts:71-83,231-300`; existing API auth test import pattern at `apps/api/src/lib/__tests__/auth.test.ts:25-43`. | Add narrow domain-aware tests at the shared choke points. Do not use an end-to-end browser/Cloudflare smoke as a Phase 12 replacement for these unit tests. |

## Workflow Adoption Matrix

All rows share one shape: determine explicit selected target -> run non-secret resolver output -> bind the mutation job to its mapped GitHub Environment -> inject only fixed standard secret names -> execute CI/remote preflight with read-only checks -> run the existing operation. The resolver job must not receive deployment secrets; the mutation job must not derive its own target values.

| Workflow file | Existing command pattern | Required Phase 12 adoption |
|---|---|---|
| `.github/workflows/deploy-api.yml` | Repository secrets and `pnpm --filter api run deploy` at lines 35-39. | Required manual `target` input; explicit tracked target for push; profile output drives Environment, generated Worker config, and preflight before deploy. |
| `.github/workflows/deploy-gateway.yml` | Same direct-secret Worker deploy at lines 34-38. | Same resolver/Environment/preflight handoff; gateway Worker name/routes/origins come only from deploy projection. |
| `.github/workflows/deploy-api-after-pr.yml` | Direct `wrangler deploy` at lines 37-43. | Join the same Worker deploy contract; it cannot remain a bypass around `deploy-api.yml`. |
| `.github/workflows/deploy-dashboard.yml` | Static `VITE_API_URL`, project create `|| true`, and hard-coded project at lines 38-57. | Use projected public values and Pages project; remove creation fallback. A missing project blocks through the live check. |
| `.github/workflows/deploy-auth.yml`, `deploy-blog.yml`, `deploy-movie.yml`, `deploy-comic.yml` | Repeated Pages build/deploy template; for example auth lines 35-54, blog lines 35-54, movie lines 41-60, comic lines 41-60. | Use one target-aware output contract for build public config and `--project-name`; remove every `wrangler pages project create ... || true`. Resolve the documented `starye-blog` versus `blog-pages` mismatch explicitly through profile validation, never by silently choosing one. |
| `.github/workflows/deploy-migrations.yml` | Independent destructive-SQL gate at lines 13-63; current remote write incorrectly begins at lines 83-89 before backup. | Keep the reviewer gate, then insert resolver -> mapped Environment -> CI/remote preflight/live read. Reorder to `preflight -> export selected D1 -> upload to selected R2 -> repair/apply`; backup object/logs may contain target/resource/run identity but no tokens. |
| `.github/workflows/daily-manga-crawl.yml` | Schedule/manual trigger plus direct repository secret bundle at lines 4-12 and 44-52. | Schedule target must be explicit in version control; manual target input must be required. Inject non-secret profile API/R2/account identity separately from fixed-name Environment secrets and preflight before crawl/search-index write. |
| `.github/workflows/daily-movie-crawl.yml`, `daily-actor-crawl.yml`, `daily-publisher-crawl.yml` | Each currently reads `API_URL`, R2 identity, and crawler secrets directly; e.g. movie lines 85-116 and actor/publisher `API_URL`/R2 matches. | Reuse the manga workflow's target-resolution helper. Health/auth checks stay after preflight but consume resolved public API URL and Environment-scoped `CRAWLER_SECRET`, never an API URL secret or dynamic secret key. |
| `.github/workflows/rollback.yml` | Static Worker names at lines 50-72 and Pages manual failure at lines 80-91. | Require target; after mapped Environment/preflight/live ownership check, obtain worker name from profile output. Retain Pages `exit 1` manual rollback behavior unchanged. |
| `.github/workflows/monthly-cleanup.yml` | Scheduled/manual remote D1 reads/writes with hard-coded `D1_DB_NAME` at lines 3-20 and direct secrets at lines 44-48. | This is a remote mutation inventory item: give dispatch/schedule an explicit target and use the same resolver/Environment/preflight route before both reads and writes. Do not allow top-level D1 identity to remain a parallel source. |
| `.github/workflows/ci.yml` | Test-only CI currently provides dummy test env values at lines 86-93. | Do not bind normal unit-test CI to a real target Environment or real secrets. Add only static/helper fixture tests here if they do not require remote credentials. |

### Workflow YAML Rules

1. `workflow_dispatch` target input is `required: true`; push/schedule target is a checked-in literal target ID, not a repository secret or branch-derived value.
2. The resolver job validates the ID via the same TypeScript/CLI contract and exposes only selected target ID, mapped `githubEnvironment`, public/deploy identities, and run-scoped paths. The following remote-mutation job uses that mapped Environment and fixed standard secret names such as `secrets.CLOUDFLARE_API_TOKEN`; it never constructs `secrets[format(...)]`.
3. Treat any `wrangler deploy`, `wrangler pages deploy`, `wrangler d1 ... --remote`, `wrangler r2 ... --remote`, crawler remote run, or rollback as a mutation boundary. It must follow preflight/live validation and use resolver-produced argv/resource values.
4. Temporary generated deploy config belongs in the job temporary directory and is removed on job exit. It may carry non-secret resource identity only; it is not committed or reused as a target source.
5. YAML remains orchestration. Target-to-Environment mapping, resource membership, command argv construction, and public/deploy output validation live in importable TypeScript with fixture tests.

## Shared Test and Security Patterns

### Fixtures and validation

- Use the resolver's explicit ID fixture style in [target-resolver.test.ts](../../../packages/config/src/deployment-target/__tests__/target-resolver.test.ts:10). Include two in-memory valid profiles so a matching `starye-org` value cannot accidentally mask hard-coded singleton behavior.
- Assert exact public field names and reject unknown/unregistered `VITE_*` / `NUXT_PUBLIC_*` keys. Test both secret-shaped keys (`TOKEN`, `SECRET`, `ACCESS_KEY`, credential names) and secret-shaped values; assertions must prove they are absent from serialization and errors.
- Reuse `expect.objectContaining({ code, blocking: true })` from [preflight.test.ts](../../../packages/config/src/deployment-target/__tests__/preflight.test.ts:101) for each fail-closed branch. Do not assert raw credential values.
- Mock `WranglerCommandExecutor` as in [live-checks.test.ts](../../../packages/config/src/deployment-target/__tests__/live-checks.test.ts:47), then assert ordered argv. New Worker/Pages checks must be read-only and profile-owned.
- For CLI/workflow helper tests, dynamically import the script as [preflight.test.ts](../../../packages/config/src/deployment-target/__tests__/preflight.test.ts:7-11) does, allowing imports without direct process exit or remote execution.

### Runtime tests

- Gateway: derive `API_ORIGIN`, `AUTH_ORIGIN`, `DASHBOARD_ORIGIN`, `BLOG_ORIGIN`, `MOVIE_ORIGIN`, `COMIC_ORIGIN`, and `TAVERN_ORIGIN` from a fixture projection; retain the current mock-fetch assertions for local gateway path preservation and production prefix stripping.
- API: test the shared `getAllowedOrigins()` result, then a `createAuth()` instance using the same selected input. Assert canonical gateway/domain trust and cookie-domain behavior while preserving `localhost:8080`; avoid direct production literals in new tests.
- Nuxt/Vite: validate the adapter before passing values into `runtimeConfig.public` or build env; assert auth/blog clients use that same contract and no browser config includes secrets, worker origins, Pages origins, account IDs, or resource IDs.
- Workflow helpers: fixture-test manual, push, and schedule source selection; mismatched requested Environment; missing resource; Pages-manual rollback; migration argv order; and no dynamic secret lookup. Static YAML tests should verify every listed workflow calls the helper/preflight before its first mutation rather than testing provider credentials.

### Commands to retain

```powershell
pnpm --filter @starye/config test --run src/deployment-target
pnpm --filter api test --run
pnpm --filter gateway test
pnpm --filter dashboard test --run
pnpm --filter starye-auth build
pnpm --filter blog build
pnpm target-profile validate --target starye-org
```

These are fixture/static checks only in Phase 12. Do not add `wrangler --remote`, real GitHub Environment secrets, or crawler-to-D1 evidence to automated tests; Phase 13 owns that smoke proof.

## Planner Caveats

1. [scripts/target-profile.ts](../../../scripts/target-profile.ts:260) currently collects local projection issues for every scope. A CI checkout lacks operator-owned `.dev.vars` / `.env` files, so direct reuse will always fail CI. Scope the collection itself, not merely the final preflight error handling.
2. Existing live checks cover only D1/R2/KV ([live-checks.ts](../../../packages/config/src/deployment-target/live-checks.ts:29)); deploy/rollback planning is incomplete until Worker and Pages identity checks are added and fixture-tested.
3. The gateway's `*_ORIGIN` values are upstream deployment identities, while browser public URLs are `gatewayBase + appBasePath`. Do not leak `profile.pages.*.canonicalUrl` or collapse the two roles.
4. Existing Nuxt fallback chains and dashboard direct `VITE_API_URL` reads are separate public-config paths. Updating only `.env.local`, only `nuxt.config.ts`, or only dashboard build YAML leaves a mixed-target deployment path.
5. The Pages `blog-pages` workflow name conflicts with profile `pages.blog.project = starye-blog` ([target-profiles.ts](../../../packages/config/src/deployment-target/target-profiles.ts:63)). Add an explicit validation/decision in the plan; do not silently normalize a value in one workflow.
6. Do not pull `apps/tavern` creation or a new deployment workflow into Phase 12: the target profile/gateway know the `tavern` surface, but there is no current `apps/tavern*` application/workflow target to copy. Treat it as an inventory/scope question, not permission for UI or IaC work.
7. `monthly-cleanup.yml` is a remote D1 write path and is within the target-resolution inventory even though it is not a deploy workflow. Leaving it fixed to `starye-db` would preserve the exact parallel-target-source failure the phase is intended to remove.
8. Keep the existing migration destructive-review Environment independent from the mapped deployment target Environment unless the plan spells out their distinct purposes. The reviewer acknowledgement is not a secret bundle selector.
9. Preserve unrelated dirty files and do not do repository-wide literal cleanup. Phase 14 owns old-domain cleanup and final operations documentation.

## Pattern Verdict

Phase 12 should extend the existing `TargetResolution -> typed projection -> fail-closed preflight` family. The highest-risk regression is not a missing deploy command; it is allowing runtime consumers or a single workflow to recreate target identity outside that family. Every new test should therefore prove both correct selected-target projection and rejection of bypasses.

---
*Pattern mapping completed: 2026-07-15*
