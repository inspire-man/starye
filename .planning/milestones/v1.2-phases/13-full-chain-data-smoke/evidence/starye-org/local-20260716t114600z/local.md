# Data Chain Smoke Evidence

- Target: starye-org
- Run: local-20260716t114600z
- Mode: local
- Timestamp: 2026-07-16T03:45:39.072Z
- Item code: p13-smoke-starye-org-0fe9ab97
- Item id: e2a25cf3-0a78-4af9-8437-2e94b4fe6ffa
- State: resolved_pending_observation
- Aggregate: checkpoint

| Surface | Status | Checkpoint | Path | Origin |
| --- | --- | --- | --- | --- |
| local_projection | passed |  |  |  |
| local_d1_readiness | passed |  |  |  |
| service_readiness | passed |  |  |  |
| gateway_auth | passed |  | /auth/ | http://localhost:8080 |
| d1 | passed |  |  |  |
| api | passed |  | /api/public/movies/p13-smoke-starye-org-0fe9ab97 | http://localhost:8080 |
| dashboard | checkpoint | dashboard_auth_unavailable | /dashboard/movies | http://localhost:8080 |
