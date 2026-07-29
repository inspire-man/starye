# Data Chain Smoke Evidence

- Target: starye-org
- Run: p13-08-7a67b849805e47938e6af160f81cc07a
- Mode: local
- Timestamp: 2026-07-18T09:48:41.382Z
- Item code: p13-smoke-starye-org-e3851bf2
- Item id: 7725fb74-0219-4e21-ad8c-2cc5c1b7cba0
- State: resolved
- Aggregate: passed

| Surface | Status | Count | Checkpoint | Path | Origin | Receipt source | Capture | Result | Captured at | Integrity |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| local_projection | passed |  |  |  |  | local_runner | local_projection | passed | 2026-07-18T09:48:41.382Z | c25cf532 |
| local_d1_readiness | passed |  |  |  |  | local_runner | local_d1_readiness | passed | 2026-07-18T09:48:41.382Z | 70fb6090 |
| service_readiness | passed |  |  |  |  | local_runner | service_probe | passed | 2026-07-18T09:48:41.382Z | 13bbaed2 |
| gateway_auth | passed |  |  | /auth/ | http://localhost:8080 | local_runner | gateway_auth | passed | 2026-07-18T09:48:41.382Z | 3ff84c82 |
| d1 | passed | 1 |  |  |  | local_runner | local_fixture_snapshot | passed | 2026-07-18T09:48:41.382Z | 660cc67f |
| api | passed |  |  | /api/public/movies/p13-smoke-starye-org-e3851bf2 | http://localhost:8080 | local_runner | canonical_api | passed | 2026-07-18T09:48:41.382Z | 4890e64a |
| dashboard | passed |  |  | /dashboard/movies | http://localhost:8080 | browser_observer | browser_navigation | passed | 2026-07-18T09:49:16.704Z | af146f6a |
| viewer | passed |  |  | /movie/p13-smoke-starye-org-e3851bf2 | http://localhost:8080 | browser_observer | browser_navigation | passed | 2026-07-18T09:49:17.790Z | c4f470aa |
