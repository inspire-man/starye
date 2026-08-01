# Data Chain Smoke Evidence

- Target: starye-org
- Run: p13-17-b807d44deee04e1f85b42fd02ed8cf26
- Mode: local
- Timestamp: 2026-07-20T09:49:20.558Z
- Item code: p13-smoke-starye-org-491316fa
- Item id: 330fa2f6-a8a1-434d-be3a-da928a4fbb4b
- State: resolved
- Aggregate: passed

| Surface | Status | Count | Checkpoint | Path | Origin | Receipt source | Capture | Result | Captured at | Integrity |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| local_projection | passed |  |  |  |  | local_runner | local_projection | passed | 2026-07-20T09:49:20.558Z | 693cfbf0 |
| local_d1_readiness | passed |  |  |  |  | local_runner | local_d1_readiness | passed | 2026-07-20T09:49:20.558Z | ab63e25a |
| service_readiness | passed |  |  |  |  | local_runner | service_probe | passed | 2026-07-20T09:49:20.558Z | c3d6c94c |
| gateway_auth | passed |  |  | /auth/ | http://localhost:8080 | local_runner | gateway_auth | passed | 2026-07-20T09:49:20.558Z | aee2e9b8 |
| d1 | passed | 1 |  |  |  | local_runner | local_fixture_snapshot | passed | 2026-07-20T09:49:20.558Z | fe578729 |
| api | passed |  |  | /api/public/movies/p13-smoke-starye-org-491316fa | http://localhost:8080 | local_runner | canonical_api | passed | 2026-07-20T09:49:20.558Z | f50607f1 |
| dashboard | passed |  |  | /dashboard/movies | http://localhost:8080 | browser_observer | browser_navigation | passed | 2026-07-20T14:05:27.462Z | 4870fc36 |
| viewer | passed |  |  | /movie/p13-smoke-starye-org-491316fa | http://localhost:8080 | browser_observer | browser_navigation | passed | 2026-07-20T14:05:30.460Z | ddce8edf |
