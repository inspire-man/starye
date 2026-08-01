# Data Chain Smoke Evidence

- Target: starye-org
- Run: p13-37-1627bb2723604850a85e3ac9f805aab8
- Mode: local
- Timestamp: 2026-07-23T03:53:41.479Z
- Item code: p13-smoke-starye-org-9e297fd8
- Item id: 6250f50c-bc3e-4552-acd3-d359d0ad3f84
- State: resolved
- Aggregate: passed

| Surface | Status | Count | Checkpoint | Path | Origin | Receipt source | Capture | Result | Captured at | Integrity |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| local_projection | passed |  |  |  |  | local_runner | local_projection | passed | 2026-07-23T03:53:41.479Z | b32faab7 |
| local_d1_readiness | passed |  |  |  |  | local_runner | local_d1_readiness | passed | 2026-07-23T03:53:41.479Z | 192ec771 |
| service_readiness | passed |  |  |  |  | local_runner | service_probe | passed | 2026-07-23T03:53:41.479Z | f98981af |
| gateway_auth | passed |  |  | /auth/ | http://localhost:8080 | local_runner | gateway_auth | passed | 2026-07-23T03:53:41.479Z | c7542d2f |
| d1 | passed | 1 |  |  |  | local_runner | local_fixture_snapshot | passed | 2026-07-23T03:53:41.479Z | 43e41962 |
| api | passed |  |  | /api/public/movies/p13-smoke-starye-org-9e297fd8 | http://localhost:8080 | local_runner | canonical_api | passed | 2026-07-23T03:53:41.479Z | 1996c371 |
| dashboard | passed |  |  | /dashboard/movies | http://localhost:8080 | browser_observer | browser_navigation | passed | 2026-07-23T04:20:34.489Z | 54e0c734 |
| viewer | passed |  |  | /movie/p13-smoke-starye-org-9e297fd8 | http://localhost:8080 | browser_observer | browser_navigation | passed | 2026-07-23T04:20:40.771Z | f2bca961 |
