# Data Chain Smoke Evidence

- Target: starye-org
- Run: p13-41-379b38f7ce29f2a621097bbd42ccfe3b
- Mode: remote
- Timestamp: 2026-07-23T08:13:33.333Z
- Item code: p13-smoke-starye-org-c656ccd0
- Item id: 03a9a090-c747-421e-b40b-fda7b8c378b2
- State: resolved_pending_observation
- Aggregate: checkpoint

| Surface | Status | Count | Checkpoint | Path | Origin | Receipt source | Capture | Result | Captured at | Integrity |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| remote_preflight | passed |  |  |  |  | remote_provider | remote_preflight | passed | 2026-07-23T08:13:33.333Z | 8f8d7b7a |
| d1 | passed | 1 |  |  |  | remote_provider | remote_fixture_snapshot | passed | 2026-07-23T08:13:33.333Z | 4562a062 |
| api | passed |  |  | /api/public/movies/p13-smoke-starye-org-c656ccd0 |  | remote_provider | canonical_api | passed | 2026-07-23T08:13:33.333Z | 97792272 |
| dashboard | checkpoint |  | dashboard_auth_unavailable | /dashboard/movies |  |  |  |  |  |  |
