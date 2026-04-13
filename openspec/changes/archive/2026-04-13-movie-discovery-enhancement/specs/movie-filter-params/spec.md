## ADDED Requirements

### Requirement: 影片列表接口支持年份范围过滤
`GET /public/movies` MUST 支持 `yearFrom` 和 `yearTo` 可选参数，按 `releaseDate` 字段的年份范围过滤影片。

- `yearFrom`（可选整数，如 `2024`）：MUST 仅返回 `releaseDate >= yearFrom 年 1 月 1 日 00:00:00 UTC` 的影片
- `yearTo`（可选整数，如 `2025`）：MUST 仅返回 `releaseDate <= yearTo 年 12 月 31 日 23:59:59 UTC` 的影片
- 两参数均为可选，单独传入时 MUST 各自独立生效
- `releaseDate` 为 null 的影片 MUST 在年份过滤激活时被排除
- 与现有 genre/actor/search 等参数 MUST 可自由组合，采用 AND 逻辑
- 参数类型 MUST 为整数字符串，范围 MUST 限制在 `2000` ~ `2099`；超出范围 MUST 返回 `400 Bad Request`

#### Scenario: 仅传 yearFrom
- **WHEN** 请求 `GET /public/movies?yearFrom=2024`
- **THEN** MUST 仅返回 `releaseDate` 在 2024-01-01 之后（含）的影片，releaseDate 为 null 的影片 MUST 不出现

#### Scenario: 仅传 yearTo
- **WHEN** 请求 `GET /public/movies?yearTo=2022`
- **THEN** MUST 仅返回 `releaseDate` 在 2022-12-31 之前（含）的影片

#### Scenario: yearFrom + yearTo 组合
- **WHEN** 请求 `GET /public/movies?yearFrom=2023&yearTo=2024`
- **THEN** MUST 仅返回 `releaseDate` 在 2023-01-01 至 2024-12-31 之间的影片

#### Scenario: 与 genre 组合
- **WHEN** 请求 `GET /public/movies?yearFrom=2024&genre=剧情`
- **THEN** MUST 返回同时满足年份和 genre 条件的影片（AND 逻辑）

#### Scenario: yearFrom 超出范围
- **WHEN** 请求 `GET /public/movies?yearFrom=1999`
- **THEN** MUST 返回 `400 Bad Request`

---

### Requirement: 影片列表接口支持时长范围过滤
`GET /public/movies` MUST 支持 `durationMin` 和 `durationMax` 可选参数，按 `duration` 字段（分钟数）过滤影片。

- `durationMin`（可选整数，分钟）：MUST 仅返回 `duration >= durationMin` 的影片
- `durationMax`（可选整数，分钟）：MUST 仅返回 `duration <= durationMax` 的影片
- `duration` 为 null 的影片 MUST 在时长过滤激活时被排除
- 两参数均为可选，可与年份过滤及其他参数自由组合

#### Scenario: 仅传 durationMin
- **WHEN** 请求 `GET /public/movies?durationMin=120`
- **THEN** MUST 仅返回 duration >= 120 分钟的影片，duration 为 null 的 MUST 不出现

#### Scenario: durationMin + durationMax 时长区间
- **WHEN** 请求 `GET /public/movies?durationMin=60&durationMax=120`
- **THEN** MUST 仅返回 duration 在 60 至 120 分钟之间（含）的影片

#### Scenario: 全部参数组合
- **WHEN** 请求 `GET /public/movies?yearFrom=2024&durationMin=60&durationMax=120&genre=剧情`
- **THEN** MUST 返回同时满足所有条件的影片（AND 逻辑）
