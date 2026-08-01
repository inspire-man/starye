# Data Chain Smoke Evidence

- Target: starye-org
- Run: p13-52-c7bae75d9db28b240150a31181839e09
- Mode: local
- Timestamp: 2026-07-25T07:55:10.298Z
- Item code: p13-smoke-starye-org-41fdd34e
- Item id: 39331e37-27ba-431b-9527-2117682f5996
- State: resolved_pending_observation
- Aggregate: checkpoint

| Surface | Status | Count | Checkpoint | Path | Origin | Receipt source | Capture | Result | Captured at | Integrity |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| local_projection | passed |  |  |  |  | local_runner | local_projection | passed | 2026-07-25T07:55:10.298Z | 96913b40 |
| local_d1_readiness | passed |  |  |  |  | local_runner | local_d1_readiness | passed | 2026-07-25T07:55:10.298Z | 4cc90b1a |
| service_readiness | passed |  |  |  |  | local_runner | service_probe | passed | 2026-07-25T07:55:10.298Z | 5567c188 |
| gateway_auth | passed |  |  | /auth/ | http://localhost:8080 | local_runner | gateway_auth | passed | 2026-07-25T07:55:10.298Z | a97487e0 |
| d1 | passed | 1 |  |  |  | local_runner | local_fixture_snapshot | passed | 2026-07-25T07:55:10.298Z | 6ee9e23d |
| api | passed |  |  | /api/public/movies/p13-smoke-starye-org-41fdd34e | http://localhost:8080 | local_runner | canonical_api | passed | 2026-07-25T07:55:10.298Z | 088250a3 |
| dashboard | checkpoint |  | dashboard_auth_unavailable | /dashboard/movies | http://localhost:8080 |  |  |  |  |  |
