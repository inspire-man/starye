# Data Chain Smoke Evidence

- Target: starye-org
- Run: p13-66-4c29f617725a4de19a2eb48738631ce6
- Mode: remote
- Timestamp: 2026-07-28T13:01:23.498Z
- Item code: p13-smoke-starye-org-7ed63aa1
- Item id: e9d9ea93-8f4f-4052-ab88-632785e2b805
- State: resolved_pending_observation
- Aggregate: checkpoint

| Surface | Status | Count | Checkpoint | Path | Origin | Receipt source | Capture | Result | Captured at | Integrity |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| remote_preflight | passed |  |  |  |  | remote_provider | remote_preflight | passed | 2026-07-28T13:01:23.498Z | 3b15f60f |
| d1 | passed | 1 |  |  |  | remote_provider | remote_fixture_snapshot | passed | 2026-07-28T13:01:23.498Z | bdd2bddf |
| api | passed |  |  | /api/public/movies/p13-smoke-starye-org-7ed63aa1 |  | remote_provider | canonical_api | passed | 2026-07-28T13:01:23.498Z | 68f03d93 |
| dashboard | passed |  |  | /dashboard/movies |  | browser_observer | browser_navigation | passed | 2026-07-28T13:14:27.420Z | 02fc2649 |
| viewer | checkpoint |  | canonical_viewer_unavailable | /movie/p13-smoke-starye-org-7ed63aa1 |  |  |  |  |  |  |
