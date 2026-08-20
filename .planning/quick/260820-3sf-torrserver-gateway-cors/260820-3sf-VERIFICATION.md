---
quick: 260820-3sf-torrserver-gateway-cors
status: passed
verified: 2026-08-20
---

# Verification

## Automated

| Check | Result |
|---|---|
| Gateway focused routing suite | PASS, 62/62 |
| Movie App TorrServer/security/Player suites | PASS, 56/56 |
| API playback-evidence repository | PASS, 8/8 |
| API full suite | PASS, 81 files / 616 tests |
| Dashboard Crawlers suite | PASS, 25/25 |
| Related full suites | PASS, 228/228 |
| API/Gateway/Crawler/Dashboard/Movie App type-check | PASS |
| Target-file lint | PASS |
| `git diff --check` | PASS |

## Gateway evidence

- Canonical stream path: `http://localhost:8080/torrserver/stream/video`.
- Browser Range response: `206`, `video/mp4`, `Content-Range`, bounded CORS, and `Cache-Control: no-store`.
- The proxy preserves the streaming body, strips browser credentials, bypasses KV caching, and only selects the fixed server-side TorrServer target.

## Browser playback evidence

- Fresh tuple: `MUDR-392`, movieId `f6b4b329-1f14-46c1-ab78-cba2f7c84c12`, sourceRevision `2`.
- Task/run/attempt: `54f52d3d-99f1-423a-80e6-8a8d3b7df086` / `9ab96173-79af-45e2-a4eb-9cda7458cb81` / `1`.
- Provider: `local-proof`; `canplay=true`, `playing=true`, `error=false`, `currentTimeDelta=55.267709`.
- Accepted evidence status: `playback_verified`.
- Admin, Public and Dashboard read back the same tuple; Dashboard shows `Actual playback` and `播放已验证`.

## Scope review

- GitNexus index was refreshed before acceptance.
- Final detect-changes review is limited to the expected Gateway stream proxy, Movie App TorrServer/trust/player paths, playback-evidence acceptance, Dashboard projection, tests and GSD records.
- The only remaining environment note is the Vite build's missing `STARYE_PAGES_BUILD_ENV_PATH`; it does not affect the passing test, type-check, lint, Gateway or browser/readback evidence above.
