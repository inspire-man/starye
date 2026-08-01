# Data Chain Smoke Evidence

- Target: starye-org
- Run: p13-66-4c29f617725a4de19a2eb48738631ce6
- Mode: local
- Timestamp: 2026-07-28T11:58:39.584Z
- Item code: p13-smoke-starye-org-7ed63aa1
- Item id: f15c44c5-471d-416c-9eaf-644a8d5f323e
- State: resolved
- Aggregate: passed

| Surface | Status | Count | Checkpoint | Path | Origin | Receipt source | Capture | Result | Captured at | Integrity |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| local_projection | passed |  |  |  |  | local_runner | local_projection | passed | 2026-07-28T11:58:39.584Z | f5192b30 |
| local_d1_readiness | passed |  |  |  |  | local_runner | local_d1_readiness | passed | 2026-07-28T11:58:39.584Z | 66bd9382 |
| service_readiness | passed |  |  |  |  | local_runner | service_probe | passed | 2026-07-28T11:58:39.584Z | ef890544 |
| gateway_auth | passed |  |  | /auth/ | http://localhost:8080 | local_runner | gateway_auth | passed | 2026-07-28T11:58:39.584Z | 435f43b8 |
| d1 | passed | 1 |  |  |  | local_runner | local_fixture_snapshot | passed | 2026-07-28T11:58:39.584Z | 3ef4c75d |
| api | passed |  |  | /api/public/movies/p13-smoke-starye-org-7ed63aa1 | http://localhost:8080 | local_runner | canonical_api | passed | 2026-07-28T11:58:39.584Z | 4ee4a100 |
| dashboard | passed |  |  | /dashboard/movies | http://localhost:8080 | browser_observer | browser_navigation | passed | 2026-07-28T12:02:26.648Z | ad01b86e |
| viewer | passed |  |  | /movie/p13-smoke-starye-org-7ed63aa1 | http://localhost:8080 | browser_observer | browser_navigation | passed | 2026-07-28T12:02:31.193Z | 68264249 |
