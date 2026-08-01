# Data Chain Smoke Evidence

- Target: starye-org
- Run: p13-55-7de1edf355a408c3e9394f66b7d97520
- Mode: local
- Timestamp: 2026-07-25T08:16:14.014Z
- Item code: p13-smoke-starye-org-df024c75
- Item id: 3c7c80bf-bf91-4662-a730-306da89e97c6
- State: resolved
- Aggregate: passed

| Surface | Status | Count | Checkpoint | Path | Origin | Receipt source | Capture | Result | Captured at | Integrity |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| local_projection | passed |  |  |  |  | local_runner | local_projection | passed | 2026-07-25T08:16:14.014Z | a5e43902 |
| local_d1_readiness | passed |  |  |  |  | local_runner | local_d1_readiness | passed | 2026-07-25T08:16:14.014Z | 1ccaf458 |
| service_readiness | passed |  |  |  |  | local_runner | service_probe | passed | 2026-07-25T08:16:14.014Z | 5dc410fa |
| gateway_auth | passed |  |  | /auth/ | http://localhost:8080 | local_runner | gateway_auth | passed | 2026-07-25T08:16:14.014Z | 839ea27a |
| d1 | passed | 1 |  |  |  | local_runner | local_fixture_snapshot | passed | 2026-07-25T08:16:14.014Z | b97e955b |
| api | passed |  |  | /api/public/movies/p13-smoke-starye-org-df024c75 | http://localhost:8080 | local_runner | canonical_api | passed | 2026-07-25T08:16:14.014Z | b7add4d7 |
| dashboard | passed |  |  | /dashboard/movies | http://localhost:8080 | browser_observer | browser_navigation | passed | 2026-07-25T08:25:29.519Z | bcbfd237 |
| viewer | passed |  |  | /movie/p13-smoke-starye-org-df024c75 | http://localhost:8080 | browser_observer | browser_navigation | passed | 2026-07-25T08:26:13.546Z | 1dd7a3de |
