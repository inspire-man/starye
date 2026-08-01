# Data Chain Smoke Evidence

- Target: starye-org
- Run: p13-50-c7d3d017012d4f2186cede0d1bfb2341
- Mode: local
- Timestamp: 2026-07-25T04:13:52.895Z
- Item code: p13-smoke-starye-org-d706e4bb
- Item id: 426246bd-717c-41ad-ad70-9d1e11e25f4a
- State: resolved_pending_observation
- Aggregate: checkpoint

| Surface | Status | Count | Checkpoint | Path | Origin | Receipt source | Capture | Result | Captured at | Integrity |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| local_projection | passed |  |  |  |  | local_runner | local_projection | passed | 2026-07-25T04:13:52.895Z | a121e4e5 |
| local_d1_readiness | passed |  |  |  |  | local_runner | local_d1_readiness | passed | 2026-07-25T04:13:52.895Z | 4436bb87 |
| service_readiness | passed |  |  |  |  | local_runner | service_probe | passed | 2026-07-25T04:13:52.895Z | f8e0a6db |
| gateway_auth | passed |  |  | /auth/ | http://localhost:8080 | local_runner | gateway_auth | passed | 2026-07-25T04:13:52.895Z | 7703e925 |
| d1 | passed | 1 |  |  |  | local_runner | local_fixture_snapshot | passed | 2026-07-25T04:13:52.895Z | 7ffa1c64 |
| api | passed |  |  | /api/public/movies/p13-smoke-starye-org-d706e4bb | http://localhost:8080 | local_runner | canonical_api | passed | 2026-07-25T04:13:52.895Z | fa8b7825 |
| dashboard | checkpoint |  | dashboard_auth_unavailable | /dashboard/movies | http://localhost:8080 |  |  |  |  |  |
