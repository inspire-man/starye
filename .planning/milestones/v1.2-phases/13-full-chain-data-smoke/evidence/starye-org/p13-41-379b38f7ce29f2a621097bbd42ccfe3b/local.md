# Data Chain Smoke Evidence

- Target: starye-org
- Run: p13-41-379b38f7ce29f2a621097bbd42ccfe3b
- Mode: local
- Timestamp: 2026-07-23T06:28:37.210Z
- Item code: p13-smoke-starye-org-c656ccd0
- Item id: 0fb330bf-f3bf-4785-a5d9-088b6c1ac392
- State: resolved
- Aggregate: passed

| Surface | Status | Count | Checkpoint | Path | Origin | Receipt source | Capture | Result | Captured at | Integrity |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| local_projection | passed |  |  |  |  | local_runner | local_projection | passed | 2026-07-23T06:28:37.210Z | 318e0a26 |
| local_d1_readiness | passed |  |  |  |  | local_runner | local_d1_readiness | passed | 2026-07-23T06:28:37.210Z | 0084b7b0 |
| service_readiness | passed |  |  |  |  | local_runner | service_probe | passed | 2026-07-23T06:28:37.210Z | 66f7ca8e |
| gateway_auth | passed |  |  | /auth/ | http://localhost:8080 | local_runner | gateway_auth | passed | 2026-07-23T06:28:37.210Z | bec3d4b6 |
| d1 | passed | 1 |  |  |  | local_runner | local_fixture_snapshot | passed | 2026-07-23T06:28:37.210Z | 58b08b5f |
| api | passed |  |  | /api/public/movies/p13-smoke-starye-org-c656ccd0 | http://localhost:8080 | local_runner | canonical_api | passed | 2026-07-23T06:28:37.210Z | b18c486a |
| dashboard | passed |  |  | /dashboard/movies | http://localhost:8080 | browser_observer | browser_navigation | passed | 2026-07-23T06:32:04.486Z | 6c39f9b7 |
| viewer | passed |  |  | /movie/p13-smoke-starye-org-c656ccd0 | http://localhost:8080 | browser_observer | browser_navigation | passed | 2026-07-23T06:32:14.945Z | 7588a052 |
