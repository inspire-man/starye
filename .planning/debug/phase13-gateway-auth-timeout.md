---
status: diagnosed
trigger: "Phase 13: diagnose p13-12 gateway_auth_unavailable at http://localhost:8080/auth/ and the 300-second runner timeout without replaying the immutable run"
created: 2026-07-19T06:09:02+08:00
updated: 2026-07-19T06:37:55+08:00
---

# Debug: Phase 13 Gateway Auth Timeout

## Current Focus

hypothesis: Diagnosis boundary reached. The current canonical Gateway no-response condition and the 300000 ms Node/Undici headers-timeout mechanism are proven; the exact historical p13-12 fetch exception, HTTP status, or redirect classification is irrecoverable from the immutable artifact.
test: Diagnosis closed from the recorded one-variable probes and source trace; no further reproduction is authorized for this session.
expecting: Phase 13 gap planning uses only the proven current Gateway no-response and 300000 ms timeout mechanism while preserving the exact historical p13-12 classification as unresolved.
next_action: Plan the Phase 13 gaps around proven canonical Gateway no-response readiness and the 300000 ms timeout mechanism; retain the exact historical p13-12 classification as an irrecoverable uncertainty.
reasoning_checkpoint: null
tdd_checkpoint: null

## Symptoms

expected: The canonical Gateway observation at http://localhost:8080/auth/ passes, allowing a newly allocated future smoke run to continue to fixture, D1, API, and a pending browser tuple.
actual: The sole p13-12 run persisted pre_ingest/checkpoint with gateway_auth/gateway_auth_unavailable and itemId null, while its outer execution host timed out after 300 seconds.
errors: The retained artifact exposes gateway_auth_unavailable, outer host exit 124, and provesExternalChain false; it does not preserve the underlying fetch exception, HTTP status, redirect location, or process-liveness diagnostic.
reproduction: Never replay or modify p13-12. Use only new read-only probes of http://localhost:8080/auth/, the Gateway/auth services, process state, and relevant source paths; do not invoke local or remote smoke mode.
started: Observed after Plan 13-11 repaired local preflight caller parity; historical Attempt E had previously produced a terminal local pair.

## Hypothesis Tests

- id: G1
  hypothesis: The canonical auth observation fails in fetch/reachability before an HTTP response is available.
  prediction: A bounded manual-redirect GET to http://localhost:8080/auth/ produces an exception with no status/location; a direct Gateway branch also failing would show general Gateway application unavailability rather than only an invalid Auth response.
  test: P2/P4 canonical /auth/ probes at 8 and 20 seconds, P5 /auth direct redirect, P6 /robots.txt direct response, plus listener/process continuity.
  observation: /auth/ produced no headers and ended only through diagnostic AbortError at 8025 ms and 20006 ms. /auth and /robots.txt likewise produced no response in 5 seconds. The same Gateway workerd started before p13-12 and still owns 127.0.0.1:8080. Auth itself returns 302 /auth/login directly.
  conclusion: CONFIRMED for current state: Gateway is listening but application-unresponsive. INDETERMINATE for the exact p13-12 branch because the artifact discarded its exception and current probes cannot be backfilled as historical facts.

- id: G2
  hypothesis: p13-12/current failure is a reachable HTTP response with a disallowed status such as 4xx/5xx.
  prediction: The manual-redirect observation records an actual status outside 2xx and accepted redirects.
  test: P2/P4 canonical response probe and immutable artifact inspection.
  observation: Current canonical probes received no HTTP response. The p13-12 artifact contains only gateway_auth_unavailable and no status.
  conclusion: ELIMINATED for current state; INDETERMINATE historically.

- id: G3
  hypothesis: p13-12/current failure is a redirect-location contract mismatch.
  prediction: Canonical GET returns 301/302/303/307/308 with a missing, external, direct-port, or non-/auth/ location.
  test: P2/P4 canonical response probe and direct Auth comparison.
  observation: Current canonical probes received no redirect response. Direct Auth returns valid /auth/login, but direct-port output is diagnostic only. The p13-12 artifact retained no location.
  conclusion: ELIMINATED for current state; INDETERMINATE historically.

- id: H1
  hypothesis: The outer runner remained alive after checkpoint persistence because observeGatewayAuthDefault left a normal completed response body unconsumed.
  prediction: A standalone Node process that prints status/location while leaving the same complete redirect body untouched remains alive; pair timestamps materially precede the outer timeout.
  test: P8b unconsumed 302 response lifecycle and P9 exact artifact file/timestamp comparison.
  observation: The body remained untouched but Node exited naturally in 0.9 seconds. Both pair files and artifact timestamp are 21:23:53Z, at the end of the approximately 21:24Z execution window, not 300 seconds earlier.
  conclusion: ELIMINATED for a normal complete redirect and as an explanation of a proven 300-second post-write interval. An unknown incomplete historical response cannot be excluded because body state was not retained.

- id: H2
  hypothesis: The pnpm/filter/tsx/module-import chain or an imported timer/worker keeps the runner alive after it returns.
  prediction: Importing the exact runner module through the same package-filter/tsx path without calling it fails to exit.
  test: P8a exact package-filtered import-only lifecycle; source-wide timer/worker/server/child search.
  observation: Import-only completed and exited 0 in 2.4 seconds. Runner source has no timer, server, Worker, listener, or async child; pre-Gateway children use spawnSync.
  conclusion: ELIMINATED for the visible source/import chain.

- id: H3
  hypothesis: The runner continues fixture/API/browser work after persisting the Gateway checkpoint.
  prediction: Control flow after preIngestCheckpoint contains further awaits reachable from the auth failure branch.
  test: Complete runDataChainSmoke, preIngestCheckpoint, and CLI trace through GitNexus and source.
  observation: Both auth-failure branches directly return preIngestCheckpoint; CLI only logs and assigns process.exitCode.
  conclusion: ELIMINATED.

- id: H4
  hypothesis: Most of the 300 seconds occurred before checkpoint persistence: global fetch waited for response headers from a listening-but-non-serving Gateway until Undici's 300000 ms headers timeout, then the catch wrote the pair while the outer 300-second host limit raced completion.
  prediction: Gateway accepts/listens but returns no headers; runtime default is 300000 ms; immutable pair is timestamped at the timeout boundary rather than before the wait.
  test: P1/P2/P4/P6 readiness probes, P9 file timestamps, and P10 embedded runtime default inspection.
  observation: All three predictions match. Node v24.0.1 embeds Undici 7.8.0 with client kHeadersTimeout default 3e5; pair writes are 21:23:53Z; sole runner duration is 304 seconds.
  conclusion: STRONGLY SUPPORTED and explains the timing without a post-checkpoint leak. The exact historical exception remains unproven because p13-12 did not retain it, and the precise outer runner start/end timestamps are not preserved in the inspected artifacts.

## Eliminated

- hypothesis: H3 - after persisting gateway_auth_unavailable the runner continued into fixture/API/browser work and therefore awaited later work until timeout.
  evidence: scripts/data-chain-smoke.ts:869-876 returns preIngestCheckpoint from both auth exception and invalid-response branches; preIngestCheckpoint writes the pair and returns. CLI lines 944-957 only log and assign process.exitCode. Fixture begins only after line 879 and cannot be reached from either return.
  timestamp: 2026-07-19T06:22:04+08:00

- hypothesis: G1b - the Auth application accepts the direct connection but does not answer /auth/.
  evidence: Both direct diagnostic GET variants returned the same valid HTTP 302 /auth/login response with a complete 97-byte body; 127.0.0.1 completed in 18 ms.
  timestamp: 2026-07-19T06:36:12+08:00

- hypothesis: G1d - Gateway workerd is an orphan whose Wrangler supervisor exited.
  evidence: workerd PID 31856 has a live node parent PID 1776 and live node grandparent PID 19844. Parent PID 1776 also owns workerd PID 42928 and esbuild PID 47712.
  timestamp: 2026-07-19T06:44:55+08:00

- hypothesis: H2a - the pnpm/filter/tsx import chain retains a timer, worker, or loader handle even without executing the runner.
  evidence: The exact package-filtered import-only process loaded scripts/data-chain-smoke.ts and exited 0 naturally in 2.4 seconds.
  timestamp: 2026-07-19T06:47:03+08:00

- hypothesis: H1a (ordinary complete response) - returning status/location without consuming a normal complete 302 body is sufficient to retain Node until the 300-second timeout.
  evidence: A standalone manual-redirect GET to the responsive Auth route printed status 302, location /auth/login, bodyState untouched after 56 ms, then the Node process exited 0 naturally in 0.9 seconds.
  timestamp: 2026-07-19T06:48:24+08:00

## Evidence

- timestamp: 2026-07-19T06:09:02+08:00
  checked: Canonical Phase 13 verifier and Plan 13-12 Summary
  found: p13-12 is an immutable pre-ingest Gateway-auth checkpoint; the only runner host timed out after the pair was written, and no browser or provider operation occurred.
  implication: The existing run cannot be replayed, and a repair must be planned only after a separate read-only diagnosis isolates both the auth observation and host-liveness failure boundaries.

- timestamp: 2026-07-19T06:14:38+08:00
  checked: Debug knowledge base against actual/error keywords gateway_auth_unavailable, auth, timeout, runner, and host
  found: No entry has the required two-keyword overlap. The only auth-related entry concerns GitHub OAuth invalid_code and outbound GitHub reachability, not this Gateway checkpoint or host lifetime.
  implication: There is no known-pattern candidate to prioritize; hypotheses must be tested from current source and observations.

- timestamp: 2026-07-19T06:14:38+08:00
  checked: Phase 13 verifier, Plan 13-12 plan/summary, and common bug-pattern map
  found: Existing evidence deliberately collapses fetch exceptions and invalid auth responses into one checkpoint; the pair was persisted before the outer 300-second timeout. Async/timing leaked handles, environment/readiness, and response-contract mismatch are applicable candidate categories.
  implication: Gateway and host lifetime require separate falsifiable hypotheses. The already-confirmed outer pnpm verifier exit normalization is out of scope for both trees.

- timestamp: 2026-07-19T06:17:12+08:00
  checked: GitNexus query/context for gateway_auth_unavailable, observeGatewayAuthDefault, and runDataChainSmoke
  found: observeGatewayAuthDefault performs fetch(http://localhost:8080/auth/) with redirect manual and returns only status/location. runDataChainSmoke catches fetch rejection and maps it to gateway_auth_unavailable; it maps validGatewayAuth=false to the same checkpoint. Both paths directly return preIngestCheckpoint before fixture/API/browser work.
  implication: The retained checkpoint is structurally ambiguous by design. Host hypothesis H3 predicts later runner work after the checkpoint, but the mapped source instead returns immediately; complete CLI/import inspection must now test whether a referenced pre-Gateway handle prevents process exit.

- timestamp: 2026-07-19T06:22:04+08:00
  checked: Complete scripts/data-chain-smoke.ts local control flow and process-creation search
  found: Local mode uses five synchronous spawnSync Wrangler calls for D1 readiness and one synchronous spawnSync service check, all completed before Gateway fetch. On Gateway failure, preIngestCheckpoint awaits two file writes, returns exit 2, runDataChainSmokeCli logs once, and the entrypoint only assigns process.exitCode. No post-checkpoint fixture/API/browser await, timer, listener, server, Worker, or async child spawn exists in this file. observeGatewayAuthDefault neither reads nor cancels response.body.
  implication: H3 (continued runner workflow) is eliminated by source. Ordinary spawnSync descendants should already be reaped before auth, weakening H1b. The only visible pre-return async resource acquired at the failing boundary is the fetch response/body/connection, making unconsumed-body H1a the next falsifiable host hypothesis.

- timestamp: 2026-07-19T06:27:20+08:00
  checked: Plan 13-12 Task 1 command, package scripts, check-services.ps1, package-manager helper, imported fixture/API-client modules, and local runner tests
  found: The authorized runner command is only pnpm smoke:data-chain with local args; its verification wrapper is a later separate command. The root script delegates to node --import tsx. check-services.ps1 only synchronously reads netstat. Windows packageManagerInvocation runs pnpm.cjs through the current Node executable. Direct imports have no top-level server/timer/child creation. The 573-line local test suite injects observeGatewayAuth in every exercised runner path and has no default-fetch/resource-lifetime assertion.
  implication: There is no source-level owner for a post-checkpoint wait other than the default fetch resource. Existing tests can pass while the real CLI leaks or waits on that resource. Outer verifier exit normalization remains separate and occurs only after the runner call ends/times out.

- timestamp: 2026-07-19T06:28:23+08:00
  checked: P1 current local service readiness via the repository read-only check
  found: Gateway, API, Dashboard, Blog, Auth, Comic, and Movie listeners all report present; Gateway listener PID 31856 and Auth listener PID 39388. No process command line or environment was inspected.
  implication: A simple current missing-listener explanation is eliminated. This does not prove the request/response contract or reconstruct p13-12 historical state.

- timestamp: 2026-07-19T06:30:41+08:00
  checked: P2 bounded consumed-body Node GET to canonical http://localhost:8080/auth/ with manual redirect
  found: No response status or location arrived. The probe ended only when its 8-second diagnostic AbortController fired, reporting outcome exception, name AbortError, and elapsed 8025 ms; no underlying error code was exposed.
  implication: Current failure is fetch/no-response-header behavior, not a currently observed HTTP status or redirect-location contract mismatch. Since production observeGatewayAuthDefault has no timeout, current conditions would hang before checkpoint persistence; p13-12 must either have observed a different transient condition or its fetch later rejected/resolved before writing the pair.

- timestamp: 2026-07-19T06:34:06+08:00
  checked: GitNexus Gateway auth flow, complete apps/gateway/src/index.ts, Gateway/Auth package config, and listener address ownership
  found: /auth/ selects local target http://localhost:3003 and proxy awaits fetch(newRequest) with no timeout or AbortSignal. Only a thrown fetch becomes HTTP 502; otherwise the upstream body is streamed. Current Gateway workerd PID 31856 listens only 127.0.0.1:8080 and Auth node PID 39388 listens only 127.0.0.1:3003. Auth is Nuxt dev on port 3003.
  implication: A listening-port check is insufficient readiness proof. The canonical no-header hang can arise while both PIDs listen because Gateway awaits an unbounded localhost upstream connection. Address-family/localhost resolution versus Auth application response are the next distinguishable causes.

- timestamp: 2026-07-19T06:36:12+08:00
  checked: P3 direct Auth readiness host-resolution comparison with body consumption
  found: GET http://localhost:3003/auth/ returned HTTP 302 with location /auth/login and 97 body bytes after 5738 ms. The identical GET using 127.0.0.1 returned the same status/location/body size after 18 ms.
  implication: Auth route G1b is eliminated: it produces a valid response. The only changed host form causes a roughly 300x latency difference while the service listens IPv4-only, supporting a localhost/address-family connection penalty. These direct-port observations are diagnostic, not canonical pass evidence.

- timestamp: 2026-07-19T06:38:29+08:00
  checked: P4 warmed 20-second body-consuming canonical GET to http://localhost:8080/auth/
  found: No HTTP response or redirect location arrived; diagnostic abort fired at 20006 ms with AbortError.
  implication: The canonical proxy remains stuck after Auth has already returned valid direct responses. This rules out a mere Nuxt cold-start delay and localizes current failure to Gateway/workerd's /auth/ upstream path rather than the Auth route contract.

- timestamp: 2026-07-19T06:40:44+08:00
  checked: P5 canonical http://localhost:8080/auth direct-redirect branch
  found: No response arrived within 5 seconds; diagnostic abort fired at 5010 ms. Source would return a 301 before calling cachedProxy for this exact path.
  implication: Current failure is broader than only the /auth/ upstream fetch branch. The Gateway TCP listener is present but its worker is not serving even an auth redirect it constructs locally. Gateway PID 31856 started 2026-07-18 22:45:40 +08:00, before the p13-12 2026-07-19 05:15-05:24 +08:00 execution window, and has not restarted.

- timestamp: 2026-07-19T06:42:06+08:00
  checked: P6 Gateway direct-response branch at http://localhost:8080/robots.txt
  found: No response arrived within 5 seconds; diagnostic abort fired at 5005 ms. Source returns robots.txt directly before all proxy branches.
  implication: The same Gateway process is generally non-serving while retaining its TCP listener. Current G2 status and G3 redirect hypotheses are eliminated because no HTTP response exists. Repository check-services reports this broken state as OK because it checks only LISTENING.

- timestamp: 2026-07-19T06:44:55+08:00
  checked: P7 non-secret Gateway process ancestry
  found: Gateway listener workerd PID 31856 is not orphaned. Its live node parent PID 1776 started at 22:45:35 and live node grandparent PID 19844 started at the same time. Parent 1776 also has workerd PID 42928 (started 01:08:19) and esbuild PID 47712.
  implication: Current failure is a supervised but non-serving worker/runtime, not simply an orphaned listener. No runner-owned descendant is identified by this Gateway service tree.

- timestamp: 2026-07-19T06:46:07+08:00
  checked: P8a initial import-only probe setup
  found: Running node --import tsx from repository root failed immediately with ERR_MODULE_NOT_FOUND before importing data-chain-smoke.ts because tsx resolves only in the crawler package context used by the real root script.
  implication: This setup result neither supports nor eliminates H2a. The probe must use the package-filter cwd/resolution contract without invoking the runner.

- timestamp: 2026-07-19T06:47:03+08:00
  checked: Corrected P8a exact package-filter/tsx import-only lifecycle
  found: pnpm --filter @starye/crawler exec node --import tsx imported scripts/data-chain-smoke.ts, printed loaded true, and exited 0 naturally after 2.4 seconds without invoking runDataChainSmoke.
  implication: tsx loader, module imports, and the outer package-filter chain do not by themselves explain a 300-second live host.

- timestamp: 2026-07-19T06:48:24+08:00
  checked: P8b unconsumed complete-response lifecycle
  found: Direct Auth returned status 302 and location /auth/login after 56 ms; response.bodyUsed remained false. The standalone Node process nevertheless exited 0 naturally after 0.9 seconds.
  implication: A normal complete small redirect response left untouched does not reproduce the host timeout. An unknown historical incomplete/streaming response is still possible because p13-12 retained neither headers nor body state, but it cannot be called proven.

- timestamp: 2026-07-19T06:50:10+08:00
  checked: P9 exact immutable p13-12 pair time metadata
  found: local.json and local.md were both created and last-written at 2026-07-18T21:23:53Z; the artifact timestamp is also 21:23:53Z. Plan 13-12 documents the overall session ending at approximately 21:24Z and the sole runner host duration as 304 seconds.
  implication: The evidence pair appears at the timeout boundary, not 300 seconds before it. Existing artifacts do not prove a post-persistence 300-second live handle. The tighter timing model is an approximately 300-second wait before checkpoint creation followed by an outer-timeout race.

- timestamp: 2026-07-19T06:54:30+08:00
  checked: P10 exact current Node global-fetch implementation
  found: Runtime is Node v24.0.1 with embedded Undici 7.8.0. Its embedded client source assigns kHeadersTimeout to headersTimeout when supplied, otherwise 3e5 (300000 ms); body timeout has the same default.
  implication: A TCP-listening Gateway that never emits response headers naturally occupies observeGatewayAuthDefault for approximately the same 300 seconds as p13-12. This corroborates H4 but does not recover the discarded historical exception code.

## Diagnosis Boundary

proven:
  - Current canonical Gateway application readiness is broken even though check-services reports all listeners OK; /auth/, /auth, and /robots.txt return no headers within bounded probes.
  - Direct Auth readiness returns a valid 302 /auth/login; canonical proof still fails because Gateway does not serve it.
  - observeGatewayAuthDefault has no request timeout and collapses exceptions plus invalid response contracts into gateway_auth_unavailable.
  - Node/Undici's 300000 ms headers timeout matches pair creation at the documented runner-timeout boundary; a 300-second post-checkpoint handle leak is not evidenced.

uncertain:
  - Whether p13-12 observed an Undici headers-timeout/fetch exception, an HTTP status, or a redirect mismatch. The immutable artifact intentionally retained none of those values.
  - Whether the same current workerd was already generally non-serving at the exact p13 request instant or became more wedged later; process continuity alone cannot reconstruct internal state.
  - The exact outer runner start/end timestamps and process-handle snapshot. Without them, the final few seconds of the outer-timeout race and any transient descendant cannot be assigned with certainty.

repair_boundary:
  - scripts/check-services.ps1 and scripts/data-chain-smoke.ts:checkServicesDefault must stop equating LISTENING with application readiness and require a bounded canonical Gateway health contract.
  - scripts/data-chain-smoke.ts:observeGatewayAuthDefault, validGatewayAuth, and runDataChainSmoke must use a timeout shorter than the outer host budget, consume/cancel any response, and persist a closed non-secret classification that distinguishes fetch/timeout, HTTP status class, and redirect-location contract.
  - apps/gateway/src/index.ts:gatewayHandler.fetch and proxy are the Gateway-side investigation/repair boundary. Local Auth origin/address-family alignment and worker response health require verification; changing only the auth proxy is insufficient until /robots.txt also responds.
  - packages/config/src/deployment-target/data-chain-evidence.ts is involved only if new closed checkpoint codes are added. Any future symbol edit above requires GitNexus upstream impact analysis first; HIGH/CRITICAL results must be reported before editing.

minimal_regression_tests:
  - A service-readiness test where port 8080 is LISTENING but canonical /auth/ emits no headers must fail before any run allocation; a valid 2xx or accepted same-origin /auth/ redirect must pass.
  - Default observeGatewayAuth behavior must classify a no-header timeout before the outer runner deadline, write exactly one checkpoint through an injected in-memory writer, and let a subprocess exit promptly with no fixture/API/browser calls.
  - Separate cases must retain distinct closed classifications for fetch exception/timeout, disallowed HTTP status, missing/external/direct-port redirect, and valid same-origin /auth/ redirect.
  - Gateway integration must assert direct /robots.txt responsiveness, /auth -> canonical /auth/ redirect, and /auth/ -> accepted Auth response while the Auth service uses its actual local bind address.
  - Process-level acceptance must assert checkpoint persistence occurs before the bounded command exits and that the outer command does not race the same timeout value. No test may replay p13-12 or write under any prior evidence directory.

## Resolution

root_cause: "INCONCLUSIVE for the exact historical p13-12 classification. Proven current cause: the pre-p13, still-supervised Gateway workerd owns 127.0.0.1:8080 but serves neither /auth/, /auth, nor /robots.txt; checkServicesDefault/check-services.ps1 treats LISTENING as healthy. Proven timing mechanism: observeGatewayAuthDefault has no timeout, Node/Undici waits 300000 ms for headers, and the immutable pair was created at the timeout boundary. Therefore no 300-second post-checkpoint handle leak is proven. The exact historical fetch exception versus HTTP status versus redirect remains unknowable from retained evidence."
fix: not applied (diagnose-only)
verification: "Read-only probes reproduced current Gateway no-header behavior at 8/20 seconds, proved direct Auth 302 readiness, proved Gateway direct branches also hang, traced complete runner/Gateway control flow, eliminated normal unconsumed-body/import/continued-workflow hypotheses, and matched Node's 300000 ms header timeout to artifact timestamps. No smoke run, browser, provider action, service/process mutation, or evidence write occurred."
files_changed: [.planning/debug/phase13-gateway-auth-timeout.md]
