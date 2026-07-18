---
status: resolved
trigger: Local GitHub login completes the provider round trip, then redirects to `/api/auth/error?error=invalid_code` instead of Dashboard Movies.
created: 2026-07-17
updated: 2026-07-18T15:49:57+08:00
---

# Debug: Local GitHub Login Redirect

## Symptoms

- Expected behavior: from `http://localhost:8080/auth/login?next=%2Fdashboard%2Fmovies`, GitHub login returns to `http://localhost:8080/dashboard/movies` so the ordered Phase 13 Dashboard observation can be appended.
- Current behavior: the Codex in-app browser uses its existing GitHub session, completes the provider round trip, then the API redirects to `/api/auth/error?error=invalid_code`; direct Dashboard access redirects back to login.
- Current error: Better Auth logs a `github.validateAuthorizationCode` token-exchange internal error after approximately 21 seconds. OAuth code, state, cookies, and secrets remain redacted.
- Reproduction: start a clean local stack, confirm Gateway health, open the Gateway login URL above, and select the unique `Login with GitHub` link in the Codex in-app browser. The current failure reproduced three times, including after `pnpm clean:ports` followed by a fresh `pnpm dev` restart.
- Historical behavior: on 2026-07-17 the callback instead reached an Auth application 404 at `http://localhost:8080/auth/dashboard/movies`. This is no longer the current symptom and must be reconciled with the newer token-exchange failure.
- Timeline: current evidence is from Phase 13 Plan 13-08 Attempt B on 2026-07-18.

## Current Focus

- hypothesis: Confirmed and verified: Windows system proxy routing covered the browser but not Node/workerd; with Clash TUN disabled, workerd's direct TCP path to `github.com:443` timed out and Better Auth mapped that provider exception to `invalid_code`.
- test: Enable Clash TUN, verify the credential-free Node/workerd harness reaches GitHub, then complete a fresh OAuth flow through the persistent browser session.
- expecting: Both runtimes return GitHub HTTP responses instead of TCP-connect timeouts, and the browser lands on `/dashboard/movies` without `invalid_code`.
- next_action: Archive this resolved session and its temporary credential-free harness, then append the confirmed pattern to the debug knowledge base.

reasoning_checkpoint:
  hypothesis: Windows system proxy routing covered the browser but not Node/workerd, so with Clash TUN disabled workerd connected directly to `github.com:443`, timed out, and Better Auth converted the provider exception into `invalid_code`.
  confirming_evidence:
    - The unchanged credential-free probes reproduced Node `UND_ERR_CONNECT_TIMEOUT` and workerd Windows `ConnectEx #121` at their characteristic timeout durations.
    - The operator confirmed a system proxy at `127.0.0.1:7897`, browser connectivity through that proxy, and Clash TUN disabled during the failures.
    - After enabling Clash TUN, both credential-free runtimes returned GitHub HTTP responses and a fresh persistent-browser OAuth flow reached `/dashboard/movies`.
  falsification_test: If either credential-free runtime still timed out after TUN enabled, or the fresh browser flow still ended at `invalid_code` while both probes succeeded, the route-split hypothesis would be incomplete or wrong.
  fix_rationale: Enabling Clash TUN gives Node/workerd the same usable outbound route as the browser, directly correcting the failed TCP path; no repository code change is warranted.
  blind_spots: The external network route remains operator-managed and may regress if TUN is disabled; no cookies, browser storage, OAuth codes, credentials, or secrets were inspected.

## Evidence

- timestamp: 2026-07-18
  checked: `.planning/debug/knowledge-base.md`
  found: No debug knowledge base exists yet.
  implication: There is no known-pattern candidate to prioritize; this session requires fresh execution-flow tracing.
- timestamp: 2026-07-18
  checked: GitNexus query for the GitHub OAuth callback and Better Auth `invalid_code` flow
  found: The graph found `createAuth` in `apps/api/src/lib/auth.ts` and Gateway `fetch` in `apps/gateway/src/index.ts`, but no indexed Better Auth authorization-code exchange process; the index did not report staleness.
  implication: Investigation must trace the two application-owned boundaries and the installed Better Auth implementation/runtime separately.
- timestamp: 2026-07-18
  checked: GitNexus context for `createAuth` and Gateway `fetch`
  found: `createAuth` has one indexed caller (`authMiddleware`), configures GitHub only with client credentials, and supplies no custom exchange handler; Gateway `fetch` sends all `/api` paths through one cached-proxy call to the API origin and marks local traffic cache-bypassed.
  implication: The exchange is dependency-owned; application-owned candidates are limited to request/proxy metadata, dynamic Better Auth configuration, or runtime networking rather than custom authorization-code logic.
- timestamp: 2026-07-18
  checked: Complete `createAuth`, auth middleware/catch-all, Gateway `fetch`/`proxy`, and cache middleware implementations
  found: `/api/auth/*` is always no-store/bypass; `createCachedProxy` invokes `proxy` once; `proxy` constructs one manual-redirect subrequest and preserves request headers/body while setting forwarded host/proto; the API catch-all invokes `authInstance.handler` once after a non-mutating session lookup.
  implication: Source inspection contradicts duplicate callback forwarding and cache replay; the 21-second exchange behavior must be distinguished inside the dependency/runtime before any application change.
- timestamp: 2026-07-18
  checked: Installed Better Auth `1.6.10`, `@better-auth/core` GitHub provider, callback route, and `@better-fetch/fetch` implementation
  found: The GitHub token POST supplies neither timeout nor retry; a parsed GitHub OAuth error returns `null`, while a rejected native `fetch` escapes to the callback catch and is mapped to `invalid_code`.
  implication: The observed approximately 21-second internal `validateAuthorizationCode` error is structurally consistent with a native Worker fetch rejection, not Better Auth retry logic; log error category is the next discriminator.
- timestamp: 2026-07-18
  checked: Immutable Phase 13 evidence artifacts and live local process/listener metadata
  found: Attempt artifacts contain no detailed exchange error beyond the debug summary; ports 8080 and 8787 each have one listener, while two Wrangler/API/Gateway process families remain alive.
  implication: Detailed error logs cannot be recovered from stored evidence; overlapping process families may confuse log attribution or bind an older runtime, but one-listener ownership does not support duplicate callback forwarding.
- timestamp: 2026-07-18
  checked: Redacted proxy environment metadata
  found: `HTTP_PROXY`, `HTTPS_PROXY`, `ALL_PROXY`, `NO_PROXY`, and `NODE_USE_ENV_PROXY` are all absent in the current shell.
  implication: The specific environment-proxy omission hypothesis is eliminated; a runtime-specific networking problem remains independently testable.
- timestamp: 2026-07-18
  checked: First credential-free Miniflare reachability harness run
  found: The probe did not reach the network because workerd rejected compatibility date `2026-07-18`; the installed binary reports `2026-05-15` as its newest supported date.
  implication: This harness error is unrelated to the OAuth symptom and requires a one-variable date correction before the network hypothesis can be evaluated.
- timestamp: 2026-07-18T15:11:00+08:00
  checked: Corrected credential-free Node versus Miniflare/workerd token-endpoint probe
  found: The same dummy form POST completed in both runtimes; Node returned HTTP 404 in 511ms and workerd returned HTTP 404 in 402ms, with neither runtime throwing or timing out.
  implication: The exact GitHub token endpoint is reachable over HTTPS from minimal workerd, so the approximately 21-second OAuth failure is not explained by a generic workerd network boundary.
- timestamp: 2026-07-18T15:13:00+08:00
  checked: API Wrangler runtime configuration versus the corrected Miniflare harness
  found: The API uses compatibility date `2024-04-01` with `nodejs_compat`; the successful minimal probe used `2026-05-15` without compatibility flags.
  implication: The first successful workerd probe did not exactly reproduce API runtime settings, so one exact-runtime differential remains necessary before eliminating runtime networking entirely.
- timestamp: 2026-07-18T15:15:00+08:00
  checked: Credential-free probe under the exact API Worker compatibility date and `nodejs_compat` flag
  found: The host Node POST returned HTTP 404 in 482ms and the exact-config workerd POST returned HTTP 404 in 411ms; neither runtime threw or timed out.
  implication: The API's compatibility settings do not reproduce the approximately 21-second exchange rejection; runtime networking is eliminated down to callback-specific request data or a different live process/config.
- timestamp: 2026-07-18T15:17:00+08:00
  checked: Live 8080 and 8787 listener process ancestry, executable paths, and creation times
  found: Both listeners are workerd processes from the current repository install, created one millisecond apart at 14:17:17, and converge on the same `pnpm dev` parent process tree started at 14:16:59.
  implication: The live Gateway and API are the intended sibling services from one current dev-stack launch; an older or unintended listener is not handling the callback.
- timestamp: 2026-07-18T15:21:00+08:00
  checked: Complete Better Auth GitHub provider, authorization-code request builder, callback route, and Better Fetch transport implementation
  found: The provider has no fetch hook, timeout, or retry; its method, form body, and headers match the raw probe except for optional PKCE data. Better Fetch obtains `globalThis.fetch` as a function value and later invokes that local value, while the successful probe called the Worker global directly.
  implication: Fetch receiver/binding is the one dependency/runtime behavior not exercised by the successful raw probe and is independently testable without OAuth data.
- timestamp: 2026-07-18T15:23:00+08:00
  checked: Unbound `globalThis.fetch` invocation under exact API Worker compatibility settings
  found: Node returned HTTP 404 in 505ms and workerd returned HTTP 404 in 394ms; extracting fetch into a local value caused neither runtime to throw or delay.
  implication: Better Fetch's unbound invocation style does not explain the provider failure; only lower-level request-context shape differences remain in the runtime branch.
- timestamp: 2026-07-18T15:25:00+08:00
  checked: First exact Better Fetch/provider-shaped credential-free probe
  found: Node failed after 10676ms with `TypeError`, network category, and `UND_ERR_CONNECT_TIMEOUT`; workerd failed after 21203ms and emitted sanitized Windows `ConnectEx #121` timeout diagnostics. The combined run took 34.9 seconds.
  implication: The probe reproduced the OAuth failure's approximately 21-second workerd timing and a direct TCP-connect error, while Node also timed out; because earlier identical endpoint probes succeeded, intermittent host-route connectivity is now the leading hypothesis.
- timestamp: 2026-07-18T15:28:00+08:00
  checked: Second unchanged exact Better Fetch/provider-shaped credential-free probe
  found: Node again failed after 10639ms with `UND_ERR_CONNECT_TIMEOUT`; workerd again failed after 21171ms with sanitized Windows `ConnectEx #121` diagnostics. The combined run took 33.5 seconds.
  implication: The exact-shaped failure is repeatable, so one immediate counterfactual against the last successful raw context is required to distinguish current network state from request-context causation.
- timestamp: 2026-07-18T15:31:00+08:00
  checked: Final counterfactual after restoring the last previously successful raw request context
  found: Node still failed after 10692ms with `UND_ERR_CONNECT_TIMEOUT`; workerd still failed after 21293ms with sanitized Windows `ConnectEx #121` diagnostics. The combined run took 33.8 seconds.
  implication: Request-context shape is not causal. Identical raw probes changed from sub-second success earlier to TCP-connect timeouts later, and both runtimes now fail at their characteristic connect timeout; the failure is time-varying external host-network reachability.
- timestamp: 2026-07-18T15:48:26+08:00
  checked: Independent credential-free harness rerun after the operator enabled Clash TUN
  found: Workerd reached GitHub and returned the expected HTTP 404 in 4520ms; Node encountered one sanitized `ECONNRESET` after 5327ms rather than its previous `UND_ERR_CONNECT_TIMEOUT`.
  implication: The OAuth runtime's outbound route is restored and no longer reproduces the 21-second connect timeout. The one Node reset indicates residual external-route jitter, so one unchanged stability rerun is warranted before archive.
- timestamp: 2026-07-18T15:49:57+08:00
  checked: Second unchanged credential-free harness rerun after Clash TUN was enabled
  found: Node returned the expected HTTP 404/Not Found in 4256ms and workerd returned the expected HTTP 404/Not Found in 5340ms; neither runtime threw or timed out.
  implication: The restored network path is usable from both runtimes, and workerd no longer reproduces the transport failure that Better Auth mapped to `invalid_code`.
- timestamp: 2026-07-18
  checked: Operator's system-route counterfactual and persistent-browser end-to-end verification
  found: With the Windows system proxy active but Clash TUN disabled, Node/workerd direct connections to `github.com:443` timed out while the browser remained connected through the system proxy. After enabling TUN, an earlier unchanged credential-free rerun returned HTTP 404 in both Node (approximately 3202ms) and workerd (approximately 4420ms), and a fresh OAuth flow landed stably at `http://localhost:8080/dashboard/movies` with the administrator movie-management UI and fixture rows visible instead of `/api/auth/error?error=invalid_code`.
  implication: The route split, its external correction, and the original user workflow are all verified. No OAuth code, cookie, browser storage, credential, or secret was inspected.
- timestamp: 2026-07-17
  observation: Login page exposes `/auth/start/github?next=%2Fdashboard%2Fmovies`; post-login request reaches Auth as `/auth/dashboard/movies` and returns 404.
- timestamp: 2026-07-17
  observation: Phase 13 local smoke is `resolved_pending_observation` with the Dashboard surface intentionally unappended.
- timestamp: 2026-07-18
  observation: The current browser flow reaches GitHub through the Gateway and returns to the API callback, but Better Auth redirects to `/api/auth/error?error=invalid_code` after a `github.validateAuthorizationCode` internal error lasting approximately 21 seconds.
- timestamp: 2026-07-18
  observation: The current failure reproduced three times in the Codex in-app browser, including after `pnpm clean:ports` and a fresh `pnpm dev` restart; direct Dashboard access then redirects back to login.
- timestamp: 2026-07-18
  observation: OAuth App `Starye Local` has callback `http://localhost:8080/api/auth/callback/github`; local `.dev.vars` uses that app's client ID, its secret fingerprint matches the newest GitHub-listed secret, and neither `.dev.vars.local` nor a process-environment override exists.
- timestamp: 2026-07-18
  observation: `/auth/start/github` emits the expected client ID, callback URI, and a state. A process-only fake-code token probe with the current credential pair returns `bad_verification_code`, showing GitHub accepts the client credentials and the token endpoint is reachable.
- timestamp: 2026-07-18
  observation: Gateway source performs one `/api` forward with manual redirect handling. No source evidence of a duplicate callback has yet been found.
- timestamp: 2026-07-18
  observation: Attempt B reached one item in `resolved_pending_observation/pending`; D1 count is 1, the observer checkpoint is `dashboard_auth_unavailable`, and the verifier reports `provesExternalChain=false`. Attempt A/B evidence is immutable and remains untracked.

## Eliminated

- hypothesis: The shell reaches GitHub through `HTTP_PROXY`, `HTTPS_PROXY`, or `ALL_PROXY` while workerd omits those environment settings.
  evidence: All three proxy environment variables and `NODE_USE_ENV_PROXY` are absent in the current shell, so this specific environment-proxy mechanism cannot explain the differential.
  timestamp: 2026-07-18
- hypothesis: The local D1 schema is the immediate cause of the 404.
  evidence: All 28 local D1 migrations applied and the failure occurs in Auth route resolution after login start.
- hypothesis: The OAuth App callback, local client ID, or currently selected client secret is simply misconfigured.
  evidence: The app callback and emitted redirect URI agree, the client ID matches, the newest secret fingerprint matches, and GitHub accepts the credential pair in a deliberately invalid-code token probe.
- hypothesis: The current symptom is still the historical Auth-internal `/auth/dashboard/movies` 404.
  evidence: Three fresh reproductions now pass the provider round trip and fail earlier at the authorization-code exchange with `/api/auth/error?error=invalid_code`; the old symptom is retained only as historical evidence.
- hypothesis: Native workerd networking generically cannot complete the GitHub token POST.
  evidence: After correcting only the unsupported compatibility date, the credential-free workerd POST completed in 402ms while the host Node POST completed in 511ms; neither threw or approached the observed 21-second failure duration.
  timestamp: 2026-07-18T15:11:00+08:00
- hypothesis: The API Worker's `2024-04-01` compatibility date plus `nodejs_compat` flag causes the GitHub token POST failure.
  evidence: With those exact settings, workerd completed the same credential-free token POST in 411ms; Node completed it in 482ms, and neither threw or timed out.
  timestamp: 2026-07-18T15:15:00+08:00
- hypothesis: The port 8787 listener belongs to an older or unintended Wrangler process family after the clean restart.
  evidence: The 8787 API and 8080 Gateway workerd listeners were created together from the same current `pnpm dev` ancestry and current repository workerd binary.
  timestamp: 2026-07-18T15:17:00+08:00
- hypothesis: Better Fetch's unbound invocation of an extracted `globalThis.fetch` fails in workerd.
  evidence: The credential-free exact-config workerd probe completed in 394ms after changing to the same extracted-function invocation style; Node completed in 505ms.
  timestamp: 2026-07-18T15:23:00+08:00

## Resolution

- root_cause: Windows system proxy routing and the Node/workerd direct route were split. The browser reached GitHub through the system proxy, but with Clash TUN disabled workerd's direct TCP connection to GitHub's token endpoint timed out after approximately 21 seconds with Windows `ConnectEx #121`; Better Auth caught that provider exception and redirected to `/api/auth/error?error=invalid_code`. Node independently reproduced the same direct-route failure as `UND_ERR_CONNECT_TIMEOUT`.
- fix: Enabled Clash TUN so the browser, Node, and workerd use a unified usable outbound network path. No production code or repository configuration fix was made or justified.
- verification: Passed. After TUN was enabled, the operator's credential-free rerun returned the expected HTTP 404/Not Found from both Node (approximately 3202ms) and workerd (approximately 4420ms). An independent unchanged rerun returned the same expected response from Node in 4256ms and workerd in 5340ms. A newly generated OAuth flow in the persistent browser session landed stably at `http://localhost:8080/dashboard/movies`, displayed the administrator movie-management UI and fixture rows, and did not return `invalid_code`. Verification did not inspect OAuth codes, cookies, browser storage, credentials, or secrets.
- files_changed: [.planning/debug/resolved/local-github-login-redirect.md, .planning/debug/resolved/local-github-login-redirect-workerd-reachability.mjs, .planning/debug/knowledge-base.md]
