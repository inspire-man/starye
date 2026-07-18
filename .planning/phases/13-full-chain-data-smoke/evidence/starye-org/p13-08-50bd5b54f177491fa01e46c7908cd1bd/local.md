# Data Chain Smoke Evidence

- Target: starye-org
- Run: p13-08-50bd5b54f177491fa01e46c7908cd1bd
- Mode: local
- Timestamp: 2026-07-18T06:30:56.403Z
- Item code: p13-smoke-starye-org-4ca8455b
- Item id: 2e23b5a1-6ba0-484e-b444-b99a43a62abb
- State: resolved_pending_observation
- Aggregate: checkpoint

| Surface | Status | Count | Checkpoint | Path | Origin | Receipt source | Capture | Result | Captured at | Integrity |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| local_projection | passed |  |  |  |  | local_runner | local_projection | passed | 2026-07-18T06:30:56.403Z | 288f3dda |
| local_d1_readiness | passed |  |  |  |  | local_runner | local_d1_readiness | passed | 2026-07-18T06:30:56.403Z | 9d09a188 |
| service_readiness | passed |  |  |  |  | local_runner | service_probe | passed | 2026-07-18T06:30:56.403Z | 3a258f02 |
| gateway_auth | passed |  |  | /auth/ | http://localhost:8080 | local_runner | gateway_auth | passed | 2026-07-18T06:30:56.403Z | 99ab8612 |
| d1 | passed | 1 |  |  |  | local_runner | local_fixture_snapshot | passed | 2026-07-18T06:30:56.403Z | fcc11d93 |
| api | passed |  |  | /api/public/movies/p13-smoke-starye-org-4ca8455b | http://localhost:8080 | local_runner | canonical_api | passed | 2026-07-18T06:30:56.403Z | 7462eb3e |
| dashboard | checkpoint |  | dashboard_auth_unavailable | /dashboard/movies | http://localhost:8080 |  |  |  |  |  |
