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
