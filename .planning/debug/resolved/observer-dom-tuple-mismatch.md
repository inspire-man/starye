---
status: resolved
trigger: Phase 13 Attempt C reached resolved_pending_observation, but the real Dashboard and viewer cannot satisfy the repository observer's code-and-id DOM predicate.
created: 2026-07-18
updated: 2026-07-18
---

# Debug: Observer DOM Tuple Mismatch

## Symptoms

- Expected behavior: the exact Phase 13 observer captures Dashboard then viewer receipts for the pending Attempt C tuple after each SPA surface settles.
- Actual behavior: authenticated Codex in-app browser observation finds `codeMatches=true` and `idMatches=false` on both settled surfaces; the viewer initially reports both false before SPA content renders.
- Current error: no thrown application error. The default observer would classify a real visible tuple as `unavailable`, producing a false checkpoint.
- Reproduction: run local smoke to pending, open `/dashboard/movies` and `/movie/<item-code>` through `http://localhost:8080`, then apply the same body/outerHTML predicate used by `observeSurfaceDefault`.
- Timeline: discovered during Phase 13 Plan 13-08 Attempt C on 2026-07-18 after OAuth/network recovery.

## Current Focus

- hypothesis: confirmed and human-verified; the missing UUID DOM serialization caused the exact observer tuple mismatch.
- test: completed read-only human DOM verification through the canonical Gateway without running the repository observer or modifying frozen evidence.
- expecting: satisfied; Dashboard and viewer each expose exactly one UUID marker and the settled observer-equivalent viewer predicate matches both code and ID.
- next_action: commit this resolved debug artifact only; leave all unrelated dirty-worktree paths unstaged.
- reasoning_checkpoint:
    hypothesis: Dashboard and MovieDetail cause false `unavailable` checkpoints because their rendered code elements omit the already-loaded item UUID, so the observer's committed exact code+id wait never settles.
    confirming_evidence:
      - Authenticated real DOM observations contain the exact item code but not the UUID on both settled surfaces.
      - `Movies.vue` receives `item.id` and `MovieDetail.vue` receives `movie.id`, but their code elements currently render only the code.
      - The committed observer waits with mutation polling for both values and then re-evaluates them; relevant source diff is empty.
    falsification_test: If either component's runtime DOM already contains `data-phase13-item-id` with the API UUID before the edit, or the observer predicate still fails after the exact code+UUID marker renders, this hypothesis is wrong.
    fix_rationale: Binding the existing UUID to a stable non-visual attribute on the same code element makes the producer DOM satisfy the unchanged exact tuple consumer without weakening the predicate or synthesizing identity.
    blind_spots: The frozen real Attempt C workflow cannot be rerun in this session; verification is limited to runtime component DOM tests, observer callback tests, type checks, and static diff inspection.

## Evidence

- timestamp: 2026-07-18
  checked: `.planning/debug/knowledge-base.md`
  found: the only resolved entry concerns local GitHub OAuth network routing; it has no two-keyword overlap with DOM tuple, item UUID, or SPA settlement symptoms.
  implication: no known-pattern candidate applies; continue testing the current data-contract and async-settlement hypotheses independently.
- timestamp: 2026-07-18
  checked: project-local skills under `.agents/skills/`
  found: only `starye-ui-components` applies to the Vue templates; it imposes component/style boundaries but no restriction on non-visual `data-*` contract attributes. Crawler, DB migration, and Hono RPC rules are out of scope.
  implication: the fix can remain data-only in existing Vue templates and observer tests without API, schema, styling, or shared UI component changes.
- timestamp: 2026-07-18
  checked: GitNexus queries for observer, Dashboard Movies, and MovieDetail tuple rendering
  found: `observeSurfaceDefault` is defined in `scripts/data-chain-surface-observation.ts`; `observeDataChainSurfaces` is its indexed flow owner; MovieDetail is `apps/movie-app/src/views/MovieDetail.vue`. Dashboard search surfaced `useBatchSelect` but did not resolve the route template.
  implication: the observer and viewer owners are bounded; the Dashboard template still needs constrained source discovery before forming an edit plan.
- timestamp: 2026-07-18
  checked: constrained test-file discovery under `scripts`, `test`, and `apps`
  found: Dashboard has `apps/dashboard/src/views/__test__/Movies.test.ts`; MovieDetail has no colocated unit test in the file-name results. The combined command also referenced a nonexistent top-level `tests/` directory and exited nonzero.
  implication: reuse the real Dashboard test and locate observer/MovieDetail contract coverage by content search in directories that actually exist.
- timestamp: 2026-07-18
  checked: GitNexus context for `observeSurfaceDefault` and `observeDataChainSurfaces`
  found: the current observer implementation navigates with `domcontentloaded`, then calls `page.waitForFunction` with mutation polling until both code and ID exist, validates the settled URL, and only then evaluates the tuple. `observeDataChainSurfaces` injects this default dynamically and is called only by the CLI in the indexed graph.
  implication: the earlier timing hypothesis is contradicted by current source unless this wait is a concurrent/uncommitted change; provenance must be checked before fixing.
- timestamp: 2026-07-18
  checked: constrained source search for Dashboard Movies and observer references
  found: the Dashboard owner is `apps/dashboard/src/views/Movies.vue`, with unit coverage in `apps/dashboard/src/views/__test__/Movies.test.ts`; `movie.id` is referenced in the component logic. No additional source test imported the observer by its exact path/name in searched directories.
  implication: Dashboard already has UUID data available, and observer tests may use dynamic imports or be located by behavior rather than exact symbol text.
- timestamp: 2026-07-18
  checked: read-only git status/diff for observer, Dashboard Movies, Dashboard test, and MovieDetail
  found: all four relevant source paths have empty diffs; unrelated root docs/debug/evidence paths are dirty or untracked and remain untouched.
  implication: the observer's tuple wait is committed baseline behavior, not a concurrent partial fix; preserve unrelated dirty-worktree state and focus on missing DOM serialization plus contract coverage.
- timestamp: 2026-07-18
  checked: source-test search for `waitForFunction`, tuple booleans, and MovieDetail coverage
  found: the default browser contract is mocked in `packages/config/src/deployment-target/__tests__/data-chain-smoke-local.test.ts`; it asserts `waitForFunction` but hard-codes a successful `evaluate` tuple. No MovieDetail component unit test exists.
  implication: strengthen the observer mock around actual tuple settlement and add focused MovieDetail DOM contract coverage rather than relying on unrelated player/e2e tests.
- timestamp: 2026-07-18
  checked: exact Dashboard and MovieDetail template bindings plus data-loading paths
  found: Dashboard loads API rows directly into `movies` and its code column currently has no custom slot/UUID attribute; MovieDetail assigns `response.data` to `movie` and renders `movie.code` at the detail code badge without `movie.id` in DOM.
  implication: both surfaces already own the correct UUID at render time; adding the same non-visual UUID marker to each code element addresses the data-shape contract directly without synthesizing IDs or changing APIs.
- timestamp: 2026-07-18
  checked: existing default observer test in `data-chain-smoke-local.test.ts`
  found: it asserts mutation-polling `waitForFunction` and call order, but the mock never executes the passed predicate and `evaluate` hard-codes both matches true.
  implication: the test can pass even if real DOM lacks UUID; execute the observer callbacks against controlled code-only and code+marker DOM to cover actual settlement behavior.
- timestamp: 2026-07-18
  checked: GitNexus upstream impact for `Movies.vue` and `MovieDetail.vue` by exact File UID
  found: both reports are LOW risk with zero direct dependents, affected execution flows, or affected modules.
  implication: the planned template-only bindings have bounded blast radius; no HIGH/CRITICAL warning or manager decision is required.
- timestamp: 2026-07-18
  checked: Dashboard focused Vitest `src/views/__test__/Movies.test.ts`
  found: 1 test file passed, 10 tests passed; runtime DOM assertions locate each item's UUID marker on the element displaying its code.
  implication: the Dashboard producer now satisfies the exact code+id DOM contract without changing visible content.
- timestamp: 2026-07-18
  checked: MovieDetail focused Vitest `src/views/__tests__/MovieDetail.dom-contract.test.ts`
  found: 1 test file passed, 1 test passed; after API state settles, the code element carries the exact loaded item UUID marker.
  implication: the canonical viewer producer now satisfies the same runtime code+id DOM contract as Dashboard.
- timestamp: 2026-07-18
  checked: config focused Vitest `src/deployment-target/__tests__/data-chain-smoke-local.test.ts`
  found: 1 test file passed, 11 tests passed; the mock executes the committed observer callback and observes false for code-only DOM, then true after the exact UUID marker is added, while preserving navigation/wait/evaluate/close order.
  implication: the observer consumer is covered against the actual SPA tuple settlement contract without changing its implementation or weakening code+id correlation.
- timestamp: 2026-07-18
  checked: Dashboard `pnpm --filter dashboard type-check`
  found: `vue-tsc --noEmit` passed with exit code 0 in 51.8 seconds.
  implication: the Dashboard template binding and test changes preserve Vue/TypeScript contracts.
- timestamp: 2026-07-18
  checked: movie-app package script invocation `pnpm --filter @starye/movie-app type-check`
  found: command exited with `ERR_PNPM_RECURSIVE_RUN_NO_SCRIPT` because movie-app defines no `type-check` script.
  implication: use the installed package-local `vue-tsc --noEmit` executable directly; no repository metadata change is needed.
- timestamp: 2026-07-18
  checked: movie-app `pnpm --filter @starye/movie-app exec vue-tsc --noEmit`
  found: direct `vue-tsc --noEmit` passed with exit code 0 in 3.5 seconds.
  implication: the MovieDetail template and new runtime DOM test preserve Vue/TypeScript contracts.
- timestamp: 2026-07-18
  checked: exact relevant git diff and `git diff --check`
  found: tracked diff contains only the two UUID marker bindings and Dashboard/config test changes; the new MovieDetail DOM test is the sole untracked fix file. Whitespace check passed.
  implication: no unrelated source or frozen evidence changes entered the fix.
- timestamp: 2026-07-18
  checked: GitNexus `detect_changes` with unstaged scope
  found: LOW risk, 0 affected execution flows; it reported this fix's Dashboard test symbol plus unrelated pre-existing `AGENTS.md` and `CLAUDE.md` changes.
  implication: execution-flow blast radius remains bounded, and unrelated root-document changes must stay unstaged/untouched.
- timestamp: 2026-07-18
  checked: config `pnpm --filter @starye/config type-check`
  found: `tsc --noEmit` passed with exit code 0 in 6.5 seconds.
  implication: the enhanced observer callback test is type-compatible with the committed observer interfaces.
- timestamp: 2026-07-18
  checked: focused ESLint across the five fix files
  found: after 76.7 seconds, the only error was `test/prefer-lowercase-title` on the new MovieDetail test suite title; all implementation files and other test changes passed lint.
  implication: fix the isolated test-description style violation and rerun; no implementation change is required.
- timestamp: 2026-07-18
  checked: focused ESLint after lowercasing the new test suite title
  found: all five implementation/test files passed with exit code 0 in 18.7 seconds.
  implication: the final scoped changes satisfy repository lint rules.
- timestamp: 2026-07-18
  checked: final rerun of `MovieDetail.dom-contract.test.ts`
  found: 1 test file passed, 1 test passed in 2.65 seconds after the lint-only suite-title change.
  implication: the final on-disk MovieDetail test still proves the runtime code+UUID DOM contract.

- timestamp: 2026-07-18
  checked: Codex in-app browser on authenticated `/dashboard/movies`
  found: settled DOM contains Attempt C code but not its item UUID.
  implication: the default code-and-id predicate cannot pass the real Dashboard markup.
- timestamp: 2026-07-18
  checked: Codex in-app browser on `/movie/p13-smoke-starye-org-b96f927b`
  found: initial evaluation before SPA settlement contains neither tuple value; settled DOM contains code but not item UUID.
  implication: the observer needs a concrete SPA settlement condition and a real DOM UUID marker.
- timestamp: 2026-07-18
  checked: GitNexus impact for `observeSurfaceDefault`
  found: LOW risk, zero indexed direct callers or affected flows; dynamic-import observer tests remain an explicit manual coverage requirement.
  implication: a narrow observer/template/test fix has bounded blast radius.
- timestamp: 2026-07-18
  checked: existing local/remote observer tests
  found: mocks hard-code `{ codeMatches: true, idMatches: true }` and do not exercise real Dashboard/viewer HTML.
  implication: current tests mask the production DOM contract mismatch.
- timestamp: 2026-07-18
  checked: human verification through the authenticated Codex in-app browser using the canonical Gateway
  found: Dashboard `/dashboard/movies` contains exactly one `data-phase13-item-id="545b4ace-7f97-423c-bfa2-5d0338539c73"` marker whose text includes the Attempt C code; viewer `/movie/p13-smoke-starye-org-b96f927b` contains exactly one matching marker and its settled observer-equivalent predicate reports `codeMatches=true` and `idMatches=true`.
  implication: the fixed producer DOM satisfies the unchanged exact code-and-id observer contract on both real SPA surfaces; human verification passed without running the repository observer or modifying frozen evidence.
- timestamp: 2026-07-18
  checked: final pre-commit GitNexus `detect_changes` with unstaged scope
  found: LOW risk, 0 affected execution flows, and one owned changed symbol (`mockMovies`); the report also listed unrelated pre-existing `AGENTS.md` and `CLAUDE.md` changes.
  implication: the final blast radius remains bounded; stage only the five owned code/test files and this resolved debug artifact, leaving unrelated root-document and evidence changes untouched.
- timestamp: 2026-07-18
  checked: final GitNexus `detect_changes` on the exact five-file staged code scope
  found: LOW risk, 5 changed files, one changed symbol (`mockMovies`), and 0 affected execution flows; no unrelated files appeared in staged scope.
  implication: code commit `7f797bc` contains only the intended producer DOM and regression-test changes.

## Eliminated

- hypothesis: `observeSurfaceDefault` only waits for `domcontentloaded` and evaluates the tuple before Vue SPA settlement.
  evidence: the committed baseline (relevant-file git diff is empty) calls `page.waitForFunction` with mutation polling until the exact code+id tuple appears, then revalidates the settled URL before evaluation.
  timestamp: 2026-07-18

- hypothesis: the OAuth session is still unavailable.
  evidence: a fresh Codex in-app OAuth flow reaches the authenticated Dashboard Movies UI.
  timestamp: 2026-07-18
- hypothesis: the Attempt C item is absent from the rendered surfaces.
  evidence: both settled surfaces visibly contain the exact Attempt C code and fixture title.
  timestamp: 2026-07-18

## Resolution

- root_cause: Dashboard Movies and MovieDetail render the observed item code but omit the already-loaded internal item UUID from DOM, so the committed mutation-polling observer's exact code-and-id predicate never settles. Tests masked the producer/consumer mismatch by not asserting real component markers and by hard-coding successful observer evaluation.
- fix: Bound `data-phase13-item-id` to the existing item UUID on each surface's code element; added Dashboard and MovieDetail runtime DOM assertions; changed the default observer unit mock to execute the real predicate against code-only and then code+UUID-marker DOM states. The observer implementation and code+id predicate remain unchanged.
- verification: Dashboard Vitest 10/10 passed; MovieDetail DOM Vitest 1/1 passed twice (final 2.65s); config observer Vitest 11/11 passed; Dashboard vue-tsc passed; movie-app direct vue-tsc passed; config tsc passed; focused ESLint passed; git diff whitespace check passed; GitNexus detect-changes reported LOW risk and zero affected execution flows. Human read-only DOM verification through the canonical Gateway passed: Dashboard and viewer each exposed exactly one marker for UUID `545b4ace-7f97-423c-bfa2-5d0338539c73`, and the settled viewer predicate matched both code and ID.
- files_changed:
    - apps/dashboard/src/views/Movies.vue
    - apps/dashboard/src/views/__test__/Movies.test.ts
    - apps/movie-app/src/views/MovieDetail.vue
    - apps/movie-app/src/views/__tests__/MovieDetail.dom-contract.test.ts
    - packages/config/src/deployment-target/__tests__/data-chain-smoke-local.test.ts
