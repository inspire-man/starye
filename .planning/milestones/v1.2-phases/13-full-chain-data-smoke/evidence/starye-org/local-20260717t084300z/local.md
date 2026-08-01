# Data Chain Smoke Evidence

- Target: starye-org
- Run: local-20260717t084300z
- Mode: local
- Timestamp: 2026-07-17T08:49:14.143Z
- Item code: p13-smoke-starye-org-6f6f56fb
- Item id: 093dce77-272d-45dd-857f-cd40747295e7
- State: resolved
- Aggregate: passed

| Surface | Status | Count | Checkpoint | Path | Origin |
| --- | --- | --- | --- | --- | --- |
| local_projection | passed |  |  |  |  |
| local_d1_readiness | passed |  |  |  |  |
| service_readiness | passed |  |  |  |  |
| gateway_auth | passed |  |  | /auth/ | http://localhost:8080 |
| d1 | passed | 10 |  |  |  |
| api | passed |  |  | /api/public/movies/p13-smoke-starye-org-6f6f56fb | http://localhost:8080 |
| dashboard | passed |  |  | /dashboard/movies | http://localhost:8080 |
| viewer | passed |  |  | /movie/p13-smoke-starye-org-6f6f56fb | http://localhost:8080 |
