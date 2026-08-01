# Data Chain Smoke Evidence

- Target: starye-org
- Run: p13-57-cba6a1790ceae9312cf3ece3042b5749
- Mode: local
- Timestamp: 2026-07-26T06:56:51.322Z
- Item code: p13-smoke-starye-org-3645530d
- Item id: 1310eec8-663a-49ed-9756-b61d449626fc
- State: resolved_pending_observation
- Aggregate: checkpoint

| Surface | Status | Count | Checkpoint | Path | Origin | Receipt source | Capture | Result | Captured at | Integrity |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| local_projection | passed |  |  |  |  | local_runner | local_projection | passed | 2026-07-26T06:56:51.322Z | cddddfa1 |
| local_d1_readiness | passed |  |  |  |  | local_runner | local_d1_readiness | passed | 2026-07-26T06:56:51.322Z | da351d0b |
| service_readiness | passed |  |  |  |  | local_runner | service_probe | passed | 2026-07-26T06:56:51.322Z | 7ebfaed7 |
| gateway_auth | passed |  |  | /auth/ | http://localhost:8080 | local_runner | gateway_auth | passed | 2026-07-26T06:56:51.322Z | 8005fca9 |
| d1 | passed | 1 |  |  |  | local_runner | local_fixture_snapshot | passed | 2026-07-26T06:56:51.322Z | 6cb9b3d4 |
| api | passed |  |  | /api/public/movies/p13-smoke-starye-org-3645530d | http://localhost:8080 | local_runner | canonical_api | passed | 2026-07-26T06:56:51.322Z | 46e1e711 |
| dashboard | checkpoint |  | dashboard_auth_unavailable | /dashboard/movies | http://localhost:8080 |  |  |  |  |  |
