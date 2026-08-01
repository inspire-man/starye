# Data Chain Smoke Evidence

- Target: starye-org
- Run: p13-60-5b545aa10389b50cfa86e78319665398
- Mode: local
- Timestamp: 2026-07-28T08:14:18.934Z
- Item code: p13-smoke-starye-org-9f9b088c
- Item id: 3dafb33b-435e-48a7-873c-5695856d4d43
- State: resolved_pending_observation
- Aggregate: pending

| Surface | Status | Count | Checkpoint | Path | Origin | Receipt source | Capture | Result | Captured at | Integrity |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| local_projection | passed |  |  |  |  | local_runner | local_projection | passed | 2026-07-28T08:14:18.934Z | 40c74256 |
| local_d1_readiness | passed |  |  |  |  | local_runner | local_d1_readiness | passed | 2026-07-28T08:14:18.934Z | 3bd71f8c |
| service_readiness | passed |  |  |  |  | local_runner | service_probe | passed | 2026-07-28T08:14:18.934Z | 04d26e9e |
| gateway_auth | passed |  |  | /auth/ | http://localhost:8080 | local_runner | gateway_auth | passed | 2026-07-28T08:14:18.934Z | f2005bc6 |
| d1 | passed | 1 |  |  |  | local_runner | local_fixture_snapshot | passed | 2026-07-28T08:14:18.934Z | 0c051bab |
| api | passed |  |  | /api/public/movies/p13-smoke-starye-org-9f9b088c | http://localhost:8080 | local_runner | canonical_api | passed | 2026-07-28T08:14:18.934Z | c36e178f |
