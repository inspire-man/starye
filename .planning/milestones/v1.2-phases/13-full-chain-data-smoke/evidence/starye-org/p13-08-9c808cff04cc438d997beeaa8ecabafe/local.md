# Data Chain Smoke Evidence

- Target: starye-org
- Run: p13-08-9c808cff04cc438d997beeaa8ecabafe
- Mode: local
- Timestamp: 2026-07-18T09:07:46.515Z
- Item code: p13-smoke-starye-org-aa106c3d
- Item id: 78ba8f4d-bbf6-4c8e-b9db-92ae1ba28d78
- State: resolved
- Aggregate: passed

| Surface | Status | Count | Checkpoint | Path | Origin | Receipt source | Capture | Result | Captured at | Integrity |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| local_projection | passed |  |  |  |  | local_runner | local_projection | passed | 2026-07-18T09:07:46.515Z | fa1a3b01 |
| local_d1_readiness | passed |  |  |  |  | local_runner | local_d1_readiness | passed | 2026-07-18T09:07:46.515Z | 25210f13 |
| service_readiness | passed |  |  |  |  | local_runner | service_probe | passed | 2026-07-18T09:07:46.515Z | 290fead7 |
| gateway_auth | passed |  |  | /auth/ | http://localhost:8080 | local_runner | gateway_auth | passed | 2026-07-18T09:07:46.515Z | 7b53a139 |
| d1 | passed | 1 |  |  |  | local_runner | local_fixture_snapshot | passed | 2026-07-18T09:07:46.515Z | ea1f25d0 |
| api | passed |  |  | /api/public/movies/p13-smoke-starye-org-aa106c3d | http://localhost:8080 | local_runner | canonical_api | passed | 2026-07-18T09:07:46.515Z | 095d1de0 |
| dashboard | passed |  |  | /dashboard/movies | http://localhost:8080 | browser_observer | browser_navigation | passed | 2026-07-18T09:09:36.763Z | bd1f9484 |
| viewer | passed |  |  | /movie/p13-smoke-starye-org-aa106c3d | http://localhost:8080 | browser_observer | browser_navigation | passed | 2026-07-18T09:09:37.825Z | 56c6342d |
