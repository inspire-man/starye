---
phase: 12-cloudflare-config-switching
plan: "02"
subsystem: runtime-config
tags: [cloudflare, vite, nuxt, public-runtime, sentry, gateway, vitest]
requires:
  - phase: 12-01
    provides: Typed selected-target public/deploy projections and generated Pages dotenv input.
provides:
  - API, Gateway, Nuxt, dashboard, movie, and comic consumers bound to the audited selected-target public runtime contract.
  - Movie and comic Vite runtime injection with typed telemetry and feature overlays.
  - Fixture and source-inventory coverage that blocks raw or credential-shaped browser environment input.
affects: [12-03-workflow-target-resolution, 12-04-direct-entry-audit, 13-full-chain-data-smoke]
tech-stack:
  added: []
  patterns: [generated-dotenv-only-build-input, typed-vite-runtime-global, raw-env-source-inventory, Vite-runner-config-loading]
key-files:
  created:
    - apps/movie-app/src/config/public-runtime.ts
    - apps/comic-app/src/config/public-runtime.ts
  modified:
    - apps/api/src/config.ts
    - apps/api/src/lib/auth.ts
    - apps/gateway/src/index.ts
    - apps/dashboard/vite.config.ts
    - apps/movie-app/vite.config.ts
    - apps/comic-app/vite.config.ts
    - packages/config/src/deployment-target/__tests__/public-runtime-consumers.test.ts
key-decisions:
  - "Browser consumers receive only typed canonical target, gateway/API, app-path, Sentry, and named movie feature fields; deploy identities remain absent."
  - "Movie and comic relative Hono/native clients remain unchanged while audited consumers use the selected API base without direct-port fallback."
  - "Vite builds load the generated TypeScript workspace contract through runner mode and explicit TypeScript config selection."
patterns-established:
  - "Framework entry config parses Plan 12-01 generated dotenv before serializing a typed browser runtime global."
  - "Source inventory tests enumerate every permitted raw environment reader and reject all other browser reads."
requirements-completed: [ENV-03, ENV-04, ENV-05, ENV-06, DEPL-02, TEST-03]
coverage:
  - id: D1
    description: Selected target drives API CORS/auth and Gateway origin/proxy configuration together.
    requirement: DEPL-02
    verification:
      - kind: unit
        ref: pnpm --filter api test --run
        status: pass
      - kind: unit
        ref: pnpm --filter gateway test
        status: pass
    human_judgment: false
  - id: D2
    description: Nuxt and Vite public runtime adapters reject raw, cross-framework, unknown, and credential-shaped browser input.
    requirement: ENV-04
    verification:
      - kind: unit
        ref: packages/config/src/deployment-target/__tests__/public-runtime-consumers.test.ts
        status: pass
      - kind: unit
        ref: pnpm --filter dashboard test --run
        status: pass
    human_judgment: false
  - id: D3
    description: Movie and comic fixtures resolve selected local/production target bases with typed app paths and feature overlays.
    requirement: ENV-06
    verification:
      - kind: unit
        ref: packages/config/src/deployment-target/__tests__/public-runtime-consumers.test.ts
        status: pass
      - kind: other
        ref: Vite runner builds with generated movie/comic Pages dotenv
        status: pass
    human_judgment: false
  - id: D4
    description: Dashboard, auth, and blog build against the generated selected-target public runtime projection.
    requirement: TEST-03
    verification:
      - kind: other
        ref: pnpm --filter dashboard build; pnpm --filter starye-auth build; pnpm --filter blog build
        status: pass
    human_judgment: false
metrics:
  duration: 11h 16m
  completed: 2026-07-15
status: complete
---

# Phase 12 Plan 02: Cloudflare Config Switching Summary

**Selected Cloudflare target projection now controls API/Gateway trust and every current Nuxt/Vite browser runtime consumer through a typed, credential-free public allowlist.**

## Performance

- **Duration:** 11h 16m
- **Started:** 2026-07-15T11:26:10+08:00
- **Completed:** 2026-07-15T22:42:21+08:00
- **Tasks:** 3 completed
- **Files modified:** 57

## Accomplishments

- Routed API allowed/trusted origins and Gateway upstreams through the same selected target projection, preserving canonical local Gateway behavior and production path rewrite rules.
- Added declared `@starye/config` dependencies and audited Nuxt/dashboard adapters; the source inventory now blocks non-adapter public environment reads and deploy-identity leakage.
- Added movie/comic Vite runtime globals for selected bases, Sentry metadata, monitoring, and the five named feature flags; relative API clients remain unchanged.
- Made dashboard/movie/comic Vite build loading work with the workspace TypeScript contract under Node 24 runner mode.

## Task Commits

1. **Task 1: Route API auth/CORS and Gateway origins through selected target configuration** - `b20a55d`
2. **Task 2: Declare the shared package and close Nuxt/dashboard public-env reads behind audited adapters** - `4379c8c`, `e5ed730`
3. **Task 3: Move every movie/comic boot, telemetry, and feature consumer behind the same public adapter** - `f49a597`, `c3f8c0b`, `ff26cd2`

## Files Created/Modified

- `apps/api/src/config.ts`, `apps/api/src/lib/auth.ts`, `apps/gateway/src/index.ts` - selected-target CORS, auth, and upstream runtime adoption.
- `apps/auth/nuxt.config.ts`, `apps/blog/nuxt.config.ts`, `apps/dashboard/vite.config.ts` - audited framework-entry projection and browser serialization.
- `apps/movie-app/src/config/public-runtime.ts`, `apps/comic-app/src/config/public-runtime.ts` - typed browser runtime globals with no raw environment reader outside entry adapters.
- `apps/movie-app/vite.config.ts`, `apps/comic-app/vite.config.ts` - generated dotenv parser, closed serializer, and typed build injection.
- `packages/config/src/deployment-target/__tests__/public-runtime-consumers.test.ts` - cross-surface fixture, source inventory, local canonical URL, and secret-leak rejection coverage.

## Decisions Made

- Browser config exposes only selected target ID, canonical gateway/API bases, fixed app paths, Sentry metadata, and the named movie telemetry/feature overlay fields.
- Existing relative movie/comic Hono/native clients remain at their Gateway-relative contract; only legacy `VITE_API_URL || '/api'` consumers receive the typed API base.
- Vite build scripts explicitly select TypeScript config under runner loading so generated JavaScript config artifacts cannot become a second source.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Build compatibility] Stabilized Vite loading of the workspace TypeScript contract.**
- **Found during:** Task 3
- **Issue:** Node 24 could not load the source-exported `@starye/config` contract through Vite's default bundle path; runner mode then exposed dashboard's CommonJS-only `__dirname` alias.
- **Fix:** Used Vite runner mode with explicit `vite.config.ts` selection for dashboard/movie/comic, and converted dashboard's alias root to `fileURLToPath(import.meta.url)`.
- **Files modified:** `apps/dashboard/vite.config.ts`, `apps/dashboard/package.json`, `apps/movie-app/package.json`, `apps/comic-app/package.json`
- **Verification:** dashboard typecheck/build and direct movie/comic runner builds passed with generated Pages dotenv.
- **Committed in:** `ff26cd2`

**2. [Rule 3 - Commit recovery] Preserved an actual Task 3 commit despite a stale GSD hook result.**
- **Found during:** Task 3 closeout
- **Issue:** the GSD commit wrapper returned `commit_failed` while Husky/lint-staged had already created `f49a597`; lint ordering left one uncommitted import-only change.
- **Fix:** verified the commit exists, ran ESLint directly, ran GitNexus detect on the one-file follow-up, and committed only the import ordering.
- **Files modified:** `apps/movie-app/src/composables/useRating.ts`
- **Verification:** ESLint and GitNexus detect reported no affected symbols or execution flows.
- **Committed in:** `c3f8c0b`

**Total deviations:** 2 auto-fixed. **Impact:** Both fixes are confined to configuration/build reliability; no remote execution, UI change, or browser service-discovery path was introduced.

## Issues Encountered

- Standard movie/comic `pnpm build` still stops in pre-existing cross-project `vue-tsc -b` errors: `target-resolver.ts` violates `erasableSyntaxOnly`, and API imports `storage-purpose-policy.ts` outside its configured `rootDir`. Direct `vue-tsc --noEmit` and generated-dotenv Vite runner builds both pass. These unrelated project-build issues were left for their owning scope.
- Auth/blog production builds passed with existing Sentry no-auth-token, sourcemap, and chunk-size warnings only; no token or remote deploy was attempted.

## Known Stubs

| File | Line | Stub | Reason |
|---|---:|---|---|
| `apps/movie-app/src/composables/useRating.ts` | 82 | `fileSizeGB = null` TODO | Pre-existing rating-algorithm input gap; unrelated to public runtime configuration and does not block this plan. |

## User Setup Required

None - all verification used selected-target fixtures and generated non-secret dotenv files. No Cloudflare credentials, crawler, D1, admin, or browser E2E operation ran.

## Next Phase Readiness

- Plan 12-03 can consume the closed selected-target public/deploy projection in GitHub workflow resolution and mutation ordering.
- Resolve the existing movie/comic project-build TypeScript errors in their owning build/API scope before treating their package `pnpm build` commands as a full monorepo health gate.

## Self-Check: PASSED

- Key files and `12-02-SUMMARY.md` exist on disk.
- Production commits `b20a55d`, `4379c8c`, `e5ed730`, `f49a597`, `c3f8c0b`, and `ff26cd2` exist in Git history.
- Generated build dotenv and output directories were removed; only the three protected user files remain dirty.

---
*Phase: 12-cloudflare-config-switching*
*Completed: 2026-07-15*
