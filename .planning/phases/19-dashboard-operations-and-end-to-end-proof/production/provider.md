# Phase 19 Production Provider Evidence

Status: `passed`

## Server-owned provider tuple

The selected tuple is `starye-org` / `movie` / `.github/workflows/daily-movie-crawl.yml` / `inspire-man/starye@main` / GitHub Environment `starye-org`.

- Task: `4af1519d-f12b-4418-8bba-1c2536ee3e2b`
- D1 run / attempt: `9ef31b31-f66a-4e11-927e-c890edbdf209` / `1`
- Provider run / attempt: `30890327381` / `1`
- Provider SHA: `d57c0ed3bf4b9337a14fcb58c49465b9effa8ba6`
- Provider URL: <https://github.com/inspire-man/starye/actions/runs/30890327381>
- Provider result: `completed / success`
- D1 lifecycle: `succeeded`, state version `7`, last event sequence `7`, terminal reason `runner_succeeded`
- Evidence timestamp: `2026-08-04T09:46:38.674Z`

The metadata-only preflight facts remain secret-free: the GitHub App is scoped to `inspire-man/starye` with `Actions: write` and `Metadata: read`, and the configured Environment/binding names were present. No key, token, JWT, cookie, authentication header, or raw callback is recorded here.

## Signed callbacks and receipt

D1 contains seven accepted runner events, sequences `1` through `7`; the final event is the successful terminal event. Event IDs and nonces are recorded in the validated JSON pair in the same sequence order:

| Sequence | Event ID | Nonce |
| ---: | --- | --- |
| 1 | `e883a230-f7d3-43b5-b4f8-6b7782227593` | `f9ca2a04-3a25-4126-ba30-22bcde093987` |
| 2 | `3cacc620-7273-45f3-aec4-d844933fb3c6` | `afcfb0dc-4f1f-424c-a5af-8208df1ef857` |
| 3 | `6273e537-7184-49cf-9c95-2390b64912ed` | `13891472-1eaf-485c-a91e-738a64fa6b09` |
| 4 | `7b19a9ed-e29d-4725-b18f-bab40fd49126` | `a6c00234-9d7f-4221-a492-33cffc9243b5` |
| 5 | `fda4a105-8d72-48a3-95b1-01f02de866ae` | `1bc999bd-2c3e-4f2f-859a-4d14a06346c6` |
| 6 | `485c5c2a-df07-4258-a26e-ee58dd5226d5` | `1ab25a72-2475-4c2c-8db0-11c14de42921` |
| 7 | `44f514c3-f1c3-404e-b86d-e3e1102571fe` | `2e334a06-7f80-440c-8484-39495ced5b7d` |

The validated provider receipt is:

- Template: `movie`
- `primaryContentId`: `1cf4d537-324d-45f5-be96-9fe9bcf430a7` (`SUN-064`)
- `createdCount`: `6`
- `updatedCount`: `0`

## Existing editor CRUD proof

The receipt URL opened the production Dashboard editor for `SUN-064`. The original title was read from the editor and API. A temporary title suffix `[phase19-proof-20260804-v2]` was written through the authenticated production `PATCH /api/admin/movies/1cf4d537-324d-45f5-be96-9fe9bcf430a7`, then confirmed by:

- Dashboard receipt editor showing the suffix;
- API `GET /api/admin/movies/1cf4d537-324d-45f5-be96-9fe9bcf430a7` returning the suffixed title;
- remote D1 `movie` row returning the same suffixed title with `served_by_primary=true`.

The original title was restored through the same API path. API, remote D1, and the Dashboard receipt editor then all returned:

`SUN-064 潮吹き露出 指ズボ羞恥でセルフ潮をまき散らす金髪娘とビチャビチャ絶頂デート 乙アリス`

Therefore `mutation`, `readback`, and `restore` are all `passed`. The public client route `/movie/SUN-064` currently reports a detail-load failure because the receipt-backed row has zero players; this is recorded as an ingestion/player observation and does not change the metadata CRUD result.
