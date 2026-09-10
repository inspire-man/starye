## Purpose

为 Cloudflare Worker 提供一个独立运行的 AkShare 数据桥，把 Python DataFrame 转换成稳定、可审计的 Quant 证据 contract。

## ADDED Requirements

### Requirement: Versioned bridge contract

bridge MUST expose `POST /v1/evidence` and return `schema_version`, `provider`, `request_id`, `ts_code`, `observed_at`, `status`, `source`, `evidence` and `errors` fields. Worker MUST consume the normalized JSON contract and MUST NOT depend on pandas or AkShare-specific field names.

#### Scenario: Valid evidence request

- **WHEN** bridge receives an authenticated request for a valid `SH`, `SZ` or `BJ` stock code
- **THEN** it returns `schema_version: quant-akshare-v1`, normalized dates and numeric fields, a non-empty request id, source metadata and bounded evidence rows

#### Scenario: Unknown upstream field

- **WHEN** an AkShare response omits an optional field or changes its label
- **THEN** the bridge keeps the field `null`, records a classified error or partial status, and does not copy the raw DataFrame into the response

### Requirement: Operational boundaries

bridge MUST require its configured service token for `/v1/evidence`, MUST bound request date ranges and output rows, and MUST return one of `ready`, `partial`, `unavailable` or `invalid` without exposing stack traces or secrets.

#### Scenario: AkShare unavailable

- **WHEN** the Python dependency is missing, upstream request fails, or a timeout occurs
- **THEN** bridge returns `status: unavailable` or `partial`, a stable error code, and an empty or partial normalized payload

#### Scenario: Health check

- **WHEN** a deployment probe requests `GET /health`
- **THEN** bridge returns service status, contract version and whether AkShare is importable without returning a token
