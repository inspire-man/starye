---
phase: 13
slug: full-chain-data-smoke
artifact: patterns
status: complete
created: 2026-07-16
---

# Phase 13 Implementation Patterns

## Scope And Required Flow

Phase 13 adds one controlled, deterministic movie smoke path. It is not a new
general crawler, a free-form remote command runner, a second D1 client, or a
replacement for the existing Dashboard and public movie applications.

```text
explicit --target + local/remote mode + run id
  -> selected-target validation and preflight
  -> local projection/schema/service gate OR remote read-only live gate
  -> one registry-owned fixture adapter
  -> ApiClient.syncMovie(each item in a fixed 10-item set, service auth, upsert)
  -> API sync handler -> syncMovieData -> gateway movie-cache invalidation
  -> correlate immutable { targetId, runId, itemCode, itemId }
  -> D1/API + authenticated Dashboard + Gateway/canonical movie viewer
  -> allowlisted JSON record and Markdown summary

remote preflight/auth/provider failure
  -> checkpoint evidence only; no fixture mutation and no passed result
```

Browser evidence is canonical only when it uses `http://localhost:8080/...`
for local mode or the selected target's canonical domain for remote mode.
Implementation ports are diagnostics only. The fixture set must contain exactly
10 non-R18, target/run-derived codes, each with one player; only its primary
code is the browser evidence tuple and no caller can widen the set.

## Likely File Classification

Final module names remain planner discretion. The ownership and data-flow
boundaries below are not discretionary.

| Likely file / group | Role | Data flow | Required boundary |
|---|---|---|---|
| `scripts/data-chain-smoke.ts` (new, or equivalent import-safe root runner) | CLI/orchestration | explicit CLI options -> typed runner result -> stable process status | Require `--target` and an explicit local/remote mode. Delegate to target helpers and typed modules; never parse ambient target identity, credentials, remote origin, or a caller-provided child command. |
| `package.json` | root command registration | `pnpm smoke:data-chain` -> `tsx` runner | Add only one narrow script after the runner is test-covered. Do not create shell-string orchestration or a broad crawler alias. |
| `packages/config/src/deployment-target/mutation-entry.ts` | selected-target remote mutation registry | target + closed entry -> preflight -> materialized context -> fixed child argv | Add one dedicated smoke fixture entry only if remote execution needs it. Keep the closed union, fixed child module/operation, required secret-key inventory, `shell: false`, and no ambient target identity. |
| `packages/crawler/scripts/target-crawl-mutation.ts` plus a new focused smoke-fixture adapter module | controlled ingest adapter | prepared registry context -> deterministic fixture -> existing `ApiClient.syncMovie()` -> normalized returned identity | Extend the intentional stub for exactly one registry-owned operation. Reject all non-owned context/operations; do not reactivate the legacy direct crawler entries or invoke a full corpus. |
| New typed smoke modules under the owning package (for example `packages/crawler/src/smoke/`) | domain model and evidence writer | target/run -> fixture code -> surface observations -> allowlisted JSON/Markdown | Keep identity construction, correlation checks, redaction, path validation, and evidence serialization separate from CLI parsing. Never serialize `process.env`, request headers, tokens, raw prepared context, or a full remote origin. |
| Config/crawler/API/frontend focused tests | regression contract | fake target/preflight/client/surface result -> pass, failure, or checkpoint | Test explicit target, fixed 10-item cap, primary identity, D1 cardinality, direct-port URL rejection, redaction, and no-mutation-on-checkpoint before integration runs. |
| `.planning/phases/13-full-chain-data-smoke/evidence/<target>/<run>.json` and `.md` (generated, uncommitted unless closeout selects an artifact) | run evidence | verified observations -> machine record + human summary | Store only target ID, run ID/timestamp, normalized item identity, surface/path, status, and redacted gate category. A failed remote gate must write `checkpoint`, never synthetic success. |

Existing `apps/dashboard/src/lib/hono-rpc-client.ts`, `apps/dashboard/src/lib/api.ts`,
`apps/movie-app/src/lib/api-client.ts`, API route handlers, and Gateway routing
are integration surfaces, not Phase 13 replacement targets. Modify them only
when a focused test proves a missing smoke seam; do not add bypass endpoints,
fabricated sessions, or direct-port browser URLs.

## Closest Existing Anchors

### 1. Explicit target and fail-closed smoke preflight

`packages/config/src/deployment-target/preflight.ts` already classifies `smoke`
as a remote live-check command and makes every issue blocking:

```ts
// packages/config/src/deployment-target/preflight.ts:31-39, 267-303
export const remoteLiveCheckCommandValues = [
  'deploy', 'migrate', 'rollback', 'remote-crawl', 'smoke',
  'pages-deploy', 'pages-rollback',
] as const

if (missingCredentialKeys.length > 0) {
  addIssue(issues, 'missing-remote-credentials', ...)
  return
}
if (!options.live || !options.liveCheckExecutor) {
  addIssue(issues, 'missing-live-resource-check', ...)
  return
}
```

Copy this contract, not its policy into a second parser. The runner must call
`runTargetPreflight()` before a remote fixture is constructed, map any blocking
issue to a redacted `checkpoint`, and stop before `ApiClient.syncMovie()`.
`scripts/target-profile.ts:298-337` provides the matching local pattern: read
all managed consumer files, validate them together, and reject any target
projection mismatch before considering the local stack ready. Its
`runPreflight()` bridge at `scripts/target-profile.ts:385-415` also shows how
the CLI should print issue codes rather than environment values.

### 2. Closed prepared-entry execution

`packages/config/src/deployment-target/mutation-entry.ts` is the existing
remote-write choke point. Its two essential boundaries are:

```ts
// packages/config/src/deployment-target/mutation-entry.ts:195-221
if (request.scope === 'remote')
  assertNoAmbientTargetIdentity(request.environment)

const preflight = runTargetPreflight({ ..., live: true, ... })
if (!preflight.ok)
  throw new Error(`Target mutation preflight failed: ${...}`)

// packages/config/src/deployment-target/mutation-entry.ts:286-300
const args = fixedEntryCommand(definition)
const environment: NodeJS.ProcessEnv = {
  PATH: process.env.PATH,
  CLOUDFLARE_ACCOUNT_ID: prepared.identity.accountId,
  STARYE_PREPARED_ENTRY: definition.id,
  STARYE_PREPARED_OPERATION: definition.childOperation,
}
if (request.execute('pnpm', args, environment) !== 0)
  throw new Error(`Prepared target entry failed: ${request.entry}.`)
```

The crawler child intentionally refuses unimplemented real operations at
`packages/crawler/scripts/target-crawl-mutation.ts:26-45`; it accepts only a
registry-owned prepared context and otherwise throws
`Prepared crawler operation requires the target runner execution adapter.`
Phase 13 should add one named smoke operation behind this seam. It must not
turn `operation`, API URL, target alias, or a remote command into caller input.

### 3. Fixed-batch per-item service-auth ingest and cache-aware API write

The crawler already has the exact per-item transport needed for the fixed batch:

```ts
// packages/crawler/src/utils/api-client.ts:71-75
async syncMovie(movieData: unknown): Promise<any> {
  return this.sync('/api/movies/sync', {
    movies: [movieData],
    mode: 'upsert',
  })
}
```

`ApiClient` adds `x-service-token` internally at
`packages/crawler/src/utils/api-client.ts:14-31`; no smoke module may create a
second raw authenticated fetch. On the API side,
`apps/api/src/routes/movies/index.ts:12-22` keeps `/sync` behind
`serviceAuth()`, while `apps/api/src/routes/movies/handlers/sync.handler.ts:7-28`
delegates the upsert then invalidates the Gateway movie cache:

```ts
const result = await syncMovieData({ db, movies: body.movies, mode: body.mode || 'upsert' })
await clearGatewayCacheGroup(c.env.CACHE, 'movies')
return c.json({ message: 'Sync completed', result })
```

Build a deterministic, non-R18 fixture payload around this call. Persist the
fixture code plus the resulting database ID as the correlation tuple; never
prove the run with a title-only lookup or a pre-existing random movie.

### 4. Gateway-relative Dashboard and public viewer reads

Dashboard and movie clients already preserve the browser boundary. The
Dashboard client includes the real session cookie and defaults to a
Gateway-relative base:

```ts
// apps/dashboard/src/lib/hono-rpc-client.ts:16-29
export const credentialFetch: typeof fetch = (input, init) =>
  fetch(input as RequestInfo, { ...init, credentials: 'include' })

export function createApiClient(baseUrl: string = dashboardPublicRuntime.gatewayBaseUrl) {
  return hc<AppType>(baseUrl, { fetch: credentialFetch })
}
```

Its conventional admin lookup is `apiFetch('/admin/movies/...')` at
`apps/dashboard/src/lib/api.ts:257-277`. The movie client likewise uses a
relative RPC client and looks up the public detail by immutable code at
`apps/movie-app/src/lib/api-client.ts:29-43,91-100`.

The final proxy boundary is visible in `apps/gateway/src/index.ts:81-118`:
`/api`, `/dashboard`, and `/movie` are routed through Gateway, with Dashboard
auth checked before proxying. The smoke must surface an unauthenticated or
unauthorized Dashboard result as `dashboard_auth_unavailable` (or equivalent
checkpoint), never mint a cookie or convert an API result into a fake browser
pass. Local evidence must record `http://localhost:8080/dashboard/...` and
`http://localhost:8080/movie/<code>`; production records only the selected
canonical host and path.

### 5. Injectable fail-closed fixtures and redaction tests

The closest tests already exercise isolation rather than live providers:

```ts
// packages/config/src/deployment-target/__tests__/preflight.test.ts:101-130
expect(result.ok).toBe(false)
expect(result.issues).toEqual(expect.arrayContaining([
  expect.objectContaining({ code: 'invalid-command', blocking: true }),
]))
expect(result.issues.every(issue => issue.blocking)).toBe(true)

// packages/config/src/deployment-target/__tests__/mutation-entry.test.ts:73-93
await expect(prepareTargetMutation({ scope: 'remote', ... })).rejects.toThrow('Ambient target identity')
expect(materialize).not.toHaveBeenCalled()
expect(execute).not.toHaveBeenCalled()
```

Use the same injected fake executor/temporary directory style for the smoke
runner: assert a remote preflight failure writes only redacted checkpoint
evidence and never calls the fixture adapter. For payload compatibility,
`packages/crawler/src/utils/__tests__/api-client.test.ts:96-125` asserts the
existing `x-service-token` transport and `{ movies: [movieData], mode: 'upsert' }`
shape. For the public surface, the relative-fetch assertions in
`apps/movie-app/src/lib/__tests__/api-client.test.ts:37-50` are the model for
rejecting direct application origins in evidence.

## Mandatory Implementation Rules

1. Build the fixed 10-code set from the Phase 13 namespace and explicit
   target/run inputs. Preserve the primary returned ID for surface evidence,
   audit all 10 writes, and reject any count other than 10.
2. Keep local ordering strict: `target-profile validate` and
   `project-local --check`, local D1 schema/minimal-data check, local services,
   ingest, then D1/API/Dashboard/viewer correlation.
3. For remote mode, use the selected target plus existing preflight/read-only
   ownership checks. Any missing credential, wrong account/resource, provider
   failure, or missing authorized Dashboard session ends the remote mutation
   path and produces a `checkpoint` record.
4. Validate evidence before writing it. Allowlist target ID, run ID/timestamp,
   fixture code, item ID, surface, canonical URL/path, attempt count, status,
   and gate category. Reject secrets, token-like field names, direct app-port
   URLs, full remote origins, raw prepared context, HTTP headers, and an
   arbitrary output path.
5. Keep status semantics distinct: local/remote `passed` requires the actual
   correlated surfaces; `failed` is a completed attempted check that did not
   satisfy its assertion; `checkpoint` is a deliberate non-pass and must use a
   stable non-success process status. Do not erase a checkpoint with a later
   hand-written success artifact.

## Test Map

| Concern | Test owner | Required assertions |
|---|---|---|
| CLI/identity/evidence schema | new smoke runner tests | explicit target only; fixed deterministic 10-item set; one primary tuple; strict allowlist; JSON and Markdown have no secret-shaped data; direct port and mismatched tuple are rejected. |
| Preflight/checkpoint | config or smoke runner tests | remote missing credentials/account/live check becomes checkpoint; adapter and child execution are not invoked; checkpoint exit is non-success and evidence is still valid. |
| Registry adapter | mutation-entry and crawler tests | new entry is closed, fixed-operation only, rejects malformed prepared context and ambient identity, and cannot dispatch a general crawler operation. |
| Ingest path | crawler/API focused tests | `ApiClient.syncMovie()` sends exactly 10 bounded upsert payloads through service auth; the primary normalized result yields the code/ID used for all later checks and D1 verifies the whole set. |
| Browser surfaces | focused dashboard/movie/Gateway tests plus authorized runtime smoke | Dashboard remains cookie/session guarded and Gateway-relative; public detail uses code; persisted local URL is `localhost:8080`; remote URL is selected canonical host only. |

## Pattern Verdict

Phase 13 should extend the established chain
`explicit target -> fail-closed preflight -> fixed prepared child -> existing
service-auth upsert -> Gateway-relative reads -> redacted evidence`. The two
highest-risk regressions are bypassing the selected-target registry for a
remote write and treating an unavailable provider or Dashboard session as a
successful production smoke. Both must be impossible by construction and
proved in focused tests before an authorized live run.

---
*Pattern mapping completed: 2026-07-16*
