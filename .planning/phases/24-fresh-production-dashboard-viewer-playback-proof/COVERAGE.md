# API Coverage - Phase 24 Production Evidence

> Full coverage by default. Each capability has an explicit decision for the Phase 24 proof boundary.

| capability | decision | reason |
|---|---|---|
| GitHub Actions provider dispatch and workflow-run readback | INTEGRATE | Consume the registry-bound provider tuple and validate provider lifecycle facts as one stage of EVID-01. |
| Authenticated Gateway Dashboard/task-detail API | INTEGRATE | Start the fresh repair command and read the current task, tuple, receipt, source, playback, and bounded history through the canonical Gateway session. |
| Cloudflare D1/Drizzle playback summary and CAS persistence | INTEGRATE | Persist bounded tuple-bound summary/reference and rejection history behind the API-owned write boundary. |
| Playwright Chromium and HTMLMediaElement observation | INTEGRATE | Observe the visible Play click, allowlisted media events, currentTime progress, and canonical Dashboard -> Viewer path. |
| Controlled TorrServer/Aria2 fallback path | INTEGRATE | Exercise the existing controlled fallback only when no eligible direct source exists and record the selected source type. |
| Public R2 evidence storage or public artifact endpoint | OPT-OUT | D-19 and the phase boundary keep artifacts in the explicitly supplied phase/CI evidence root; no new R2/public storage boundary is introduced. |
| Ordinary playback telemetry | OPT-OUT | D-16 limits this phase to one tuple-bound terminal proof summary; ordinary user playback remains outside the proof write path. |

## Automated Closure

| check | result | evidence |
|---|---|---|
| Artifact builder and redaction pair | PASSED | `scripts/phase24-evidence.test.ts`: 6 tests |
| Gateway verifier fail-closed matrix | PASSED | `scripts/phase24-production-proof.test.ts`: 12 tests covering preconditions, visible Play, media error, sub-second delta, fresh tuple, rejection outcomes, and Phase 13 carrier exclusion |
| Focused TypeScript contract check | PASSED | `pnpm exec tsc --noEmit --ignoreConfig --target esnext --lib "esnext,dom" --module esnext --moduleResolution bundler --strict --skipLibCheck --types node --allowImportingTsExtensions scripts/phase24-evidence.ts scripts/phase24-production-proof.ts` |
| Focused lint and whitespace check | PASSED | `pnpm exec eslint scripts/phase24-evidence.ts scripts/phase24-production-proof.ts`; `git diff --check` |

## Human Checkpoint

The automated verifier preserves `checkpoint` and `failed` outcomes and writes a machine-readable matrix when an evidence root is available. A production `passed` result remains pending the selected target, authenticated Dashboard session, repairable movie, fresh provider tuple, and explicit evidence root described in `24-05-PLAN.md`; no local fixture result is counted as production proof.
