# Data Chain Smoke Evidence

- Target: starye-org
- Run: p13-08-13fe3c66290d40eeaf294b4259afe411
- Mode: local
- Timestamp: 2026-07-18T07:59:04.304Z
- Item code: p13-smoke-starye-org-b96f927b
- Item id: 545b4ace-7f97-423c-bfa2-5d0338539c73
- State: resolved_pending_observation
- Aggregate: pending

| Surface | Status | Count | Checkpoint | Path | Origin | Receipt source | Capture | Result | Captured at | Integrity |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| local_projection | passed |  |  |  |  | local_runner | local_projection | passed | 2026-07-18T07:59:04.304Z | e9a8c8e9 |
| local_d1_readiness | passed |  |  |  |  | local_runner | local_d1_readiness | passed | 2026-07-18T07:59:04.304Z | a6a7e353 |
| service_readiness | passed |  |  |  |  | local_runner | service_probe | passed | 2026-07-18T07:59:04.304Z | c56af335 |
| gateway_auth | passed |  |  | /auth/ | http://localhost:8080 | local_runner | gateway_auth | passed | 2026-07-18T07:59:04.304Z | 1fc62051 |
| d1 | passed | 1 |  |  |  | local_runner | local_fixture_snapshot | passed | 2026-07-18T07:59:04.304Z | bc8237d4 |
| api | passed |  |  | /api/public/movies/p13-smoke-starye-org-b96f927b | http://localhost:8080 | local_runner | canonical_api | passed | 2026-07-18T07:59:04.304Z | 63a96186 |
