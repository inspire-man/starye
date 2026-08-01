# Data Chain Smoke Evidence

- Target: starye-org
- Run: p13-73-05f31845c3f7471aa9870798bb15e3fa
- Mode: local
- Timestamp: 2026-07-29T03:14:40.910Z
- Item code: p13-smoke-starye-org-4aed34c5
- Item id: 838c8e0b-8057-4d2a-b413-bd4f7c0ab4c0
- State: resolved_pending_observation
- Aggregate: checkpoint

| Surface | Status | Count | Checkpoint | Path | Origin | Receipt source | Capture | Result | Captured at | Integrity |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| local_projection | passed |  |  |  |  | local_runner | local_projection | passed | 2026-07-29T03:14:40.910Z | d470c25f |
| local_d1_readiness | passed |  |  |  |  | local_runner | local_d1_readiness | passed | 2026-07-29T03:14:40.910Z | 8d832bf9 |
| service_readiness | passed |  |  |  |  | local_runner | service_probe | passed | 2026-07-29T03:14:40.910Z | c3327ea3 |
| gateway_auth | passed |  |  | /auth/ | http://localhost:8080 | local_runner | gateway_auth | passed | 2026-07-29T03:14:40.910Z | be67b007 |
| d1 | passed | 1 |  |  |  | local_runner | local_fixture_snapshot | passed | 2026-07-29T03:14:40.910Z | feb32482 |
| api | passed |  |  | /api/public/movies/p13-smoke-starye-org-4aed34c5 | http://localhost:8080 | local_runner | canonical_api | passed | 2026-07-29T03:14:40.910Z | af8a52e6 |
| dashboard | checkpoint |  | dashboard_auth_unavailable | /dashboard/movies | http://localhost:8080 |  |  |  |  |  |
