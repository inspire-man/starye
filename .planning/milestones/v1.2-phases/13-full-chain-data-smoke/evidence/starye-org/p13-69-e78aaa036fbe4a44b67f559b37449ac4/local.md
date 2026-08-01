# Data Chain Smoke Evidence

- Target: starye-org
- Run: p13-69-e78aaa036fbe4a44b67f559b37449ac4
- Mode: local
- Timestamp: 2026-07-28T14:00:56.250Z
- Item code: p13-smoke-starye-org-c6e90ad5
- Item id: e844fc4d-7846-4ba5-a852-11beac9437a0
- State: resolved_pending_observation
- Aggregate: checkpoint

| Surface | Status | Count | Checkpoint | Path | Origin | Receipt source | Capture | Result | Captured at | Integrity |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| local_projection | passed |  |  |  |  | local_runner | local_projection | passed | 2026-07-28T14:00:56.250Z | cea06ba1 |
| local_d1_readiness | passed |  |  |  |  | local_runner | local_d1_readiness | passed | 2026-07-28T14:00:56.250Z | b1b2ef57 |
| service_readiness | passed |  |  |  |  | local_runner | service_probe | passed | 2026-07-28T14:00:56.250Z | ebab70e5 |
| gateway_auth | passed |  |  | /auth/ | http://localhost:8080 | local_runner | gateway_auth | passed | 2026-07-28T14:00:56.250Z | 49ae30c1 |
| d1 | passed | 1 |  |  |  | local_runner | local_fixture_snapshot | passed | 2026-07-28T14:00:56.250Z | b4354e64 |
| api | passed |  |  | /api/public/movies/p13-smoke-starye-org-c6e90ad5 | http://localhost:8080 | local_runner | canonical_api | passed | 2026-07-28T14:00:56.250Z | dfff30ae |
| dashboard | checkpoint |  | dashboard_auth_unavailable | /dashboard/movies | http://localhost:8080 |  |  |  |  |  |
