# Data Chain Smoke Evidence

- Target: starye-org
- Run: p13-49-ff6c8d29fd91408c90b22e8e4935d947
- Mode: local
- Timestamp: 2026-07-25T03:04:07.699Z
- Item code: p13-smoke-starye-org-d7c0de43
- Item id: 7b4ba711-1068-403a-aebe-314b9f187844
- State: resolved_pending_observation
- Aggregate: checkpoint

| Surface | Status | Count | Checkpoint | Path | Origin | Receipt source | Capture | Result | Captured at | Integrity |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| local_projection | passed |  |  |  |  | local_runner | local_projection | passed | 2026-07-25T03:04:07.699Z | 4a056d42 |
| local_d1_readiness | passed |  |  |  |  | local_runner | local_d1_readiness | passed | 2026-07-25T03:04:07.699Z | 1410997c |
| service_readiness | passed |  |  |  |  | local_runner | service_probe | passed | 2026-07-25T03:04:07.699Z | 18703860 |
| gateway_auth | passed |  |  | /auth/ | http://localhost:8080 | local_runner | gateway_auth | passed | 2026-07-25T03:04:07.699Z | fbcb524a |
| d1 | passed | 1 |  |  |  | local_runner | local_fixture_snapshot | passed | 2026-07-25T03:04:07.699Z | 42891447 |
| api | passed |  |  | /api/public/movies/p13-smoke-starye-org-d7c0de43 | http://localhost:8080 | local_runner | canonical_api | passed | 2026-07-25T03:04:07.699Z | c5bdf368 |
| dashboard | checkpoint |  | dashboard_auth_unavailable | /dashboard/movies | http://localhost:8080 |  |  |  |  |  |
