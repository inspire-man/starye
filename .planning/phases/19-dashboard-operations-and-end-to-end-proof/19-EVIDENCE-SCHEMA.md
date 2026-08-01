# Phase 19 Evidence Schema

Phase 19 evidence is a run-bound JSON/Markdown pair. The pair is generated from one typed record and validated before either projection is written. The tuple is `(mode, target, template, taskId, runId, attempt)`; a new attempt receives a new evidence record.

## Mode Contract

| Field | `local_contract` | `credentialed_provider` |
| --- | --- | --- |
| `target` | `local-gateway` | `starye-org` |
| `workflow` | `local-contract` | server-owned `.github/workflows/daily-{movie,manga}-crawl.yml` matching `template` |
| `repository` | `local-contract` | `inspire-man/starye` |
| `ref` | `fixture` | `main` |
| `environment` | `local` | `starye-org` |
| `gatewayUrl` | `http://localhost:8080` | HTTPS origin without a direct port |
| `provider` | omitted | required for `status: passed`; numeric run ID, attempt, SHA and derived GitHub URL |
| callback facts | empty arrays | matching `callbackEventIds` and `callbackNonces`; required for `status: passed` |
| receipt source | `local_runner` | `remote_provider` |
| command | `phase19-local-proof` | `phase19-provider-signoff` |

The local contract proves the Gateway/task/runner/receipt/CRUD contract. It is never serialized as provider-backed production success. Production sign-off requires the server-owned target/workflow/repository/ref/Environment tuple, provider run facts, signed callback event ID/nonce facts and the validated provider receipt. A missing provider fact remains `checkpoint` or `failed`.

## Required Fields

Every record contains:

- `version`, `mode`, `status`, `target`, `template`, `workflow`, `repository`, `ref`, `environment`;
- D1 `taskId`, `runId`, and positive `attempt`;
- `callbackEventIds` and `callbackNonces` arrays;
- `gatewayUrl`, an allowlisted command label, and a UTC millisecond timestamp;
- `crud.mutation`, `crud.readback`, and `crud.restore` statuses;
- `validatedReceipt` for passed records, with the literal `validated: true` marker, template, primary content ID, created count, updated count and mode-bound source;
- `provider.runId`, `provider.attempt`, `provider.sha`, and the derived `provider.url` for passed credentialed provider records.

`status: checkpoint` and `status: failed` preserve the incomplete outcome. They omit validated receipts and may omit provider/callback facts when the prerequisite stopped before provider execution.

## Redaction and Ownership

The schema accepts only the fields above. Raw argv/commands, secrets, tokens, cookies, authorization or other headers, private keys, callback payloads, raw responses and arbitrary provider URLs are rejected. Provider URL is derived from the fixed repository and numeric run ID. Evidence scripts perform a second sensitive-field scan before writing.

The active pair belongs under the Phase 19 planning evidence root. Stable credential-name metadata, retention, rollback and recovery procedures belong in `RUNBOOK.md`; secret values remain in the managed secret store. JSON and Markdown are sibling projections of the same validated record and must carry the same tuple and status.
