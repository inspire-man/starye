# API Coverage — GitHub Actions Production Orchestration

> Full coverage by default. Opt-outs are explicit and reasoned.

| capability | decision | reason |
|---|---|---|
| github_app_jwt | INTEGRATE | Required to mint request-scoped installation tokens. |
| installation_token_exchange | INTEGRATE | Required for least-privilege provider calls. |
| movie_workflow_dispatch | INTEGRATE | PROD-01 production execution surface. |
| manga_workflow_dispatch | INTEGRATE | PROD-01 production execution surface. |
| schedule_registration | INTEGRATE | Schedule runs must enter the D1 control plane. |
| dispatch_snapshot_binding | INTEGRATE | Binds run_id, attempt, template, and target before crawler startup. |
| provider_started_callback | INTEGRATE | Binds GITHUB_RUN_ID and GITHUB_RUN_ATTEMPT to the application attempt. |
| progress_log_callbacks | INTEGRATE | Preserves signed operational evidence for the provider run. |
| terminal_receipt_callback | INTEGRATE | Required for validated content handoff. |
| provider_status_polling | INTEGRATE | Supplies bounded compensation when callbacks are late or missing. |
| provider_cancellation | INTEGRATE | Implements cooperative cancel_requested semantics. |
| business_retry_new_attempt | INTEGRATE | Keeps retry history and provider runs distinct. |
| credentialed_remote_production_proof | OPT-OUT | Target App metadata and Environment secrets are configured during execution and Phase 19 sign-off. |

## Phase 18-06 Local Contract Evidence

The following evidence is local, deterministic, and bounded to the Gateway/control-plane contract. It does not assert a credentialed GitHub Actions provider run.

- `local_gateway_api_d1_fixture`: `pnpm --filter api exec vitest run src/domain/crawler-tasks/__tests__/production-orchestration.integration.test.ts src/routes/internal/crawler-runs/__tests__/production-events.integration.test.ts` — PASS. In-memory LibSQL/D1, signed callbacks, provider poll compensation, cancellation/retry, and receipt validation.
- `local_gateway_actions_adapter`: `pnpm --filter crawler exec vitest run src/task-runner/__tests__/production-workflow.integration.test.ts` — PASS. Static workflow contract plus ActionsEventClient signed sequence against the `http://localhost:8080` fixture boundary.
- `local_target_profile_boundary`: `pnpm --filter @starye/config exec vitest run src/deployment-target/__tests__/production-workflow.integration.test.ts` — PASS. Explicit `starye-org` profile, GitHub Environment mapping, prepared production child, and secret allowlist.
- `api_coverage_gate`: `node C:/Users/11407/.codex/gsd-core/bin/gsd-tools.cjs query check api-coverage.verify-pre .planning/phases/18-github-actions-production-orchestration` — PASS: 13 capabilities, 12 integrate, 1 opt-out.

## Phase 19 Provider-Proof Handoff

Credentialed provider proof remains a separate target-environment operation. Phase 19 must bind one exact tuple and retain the signed terminal receipt before describing the run as provider-backed success.

Required tuple fields:

- `target`: `starye-org`
- `template`: `movie` or `manga`
- `workflow`: the matching fixed workflow path
- `repository`: `inspire-man/starye`
- `ref`: `main`
- `environment`: `starye-org`
- application `run_id` and business `attempt` from D1
- provider `GITHUB_RUN_ID`, provider attempt, and commit SHA
- API callback event IDs/nonces and the validated receipt summary
- provider run URL and the target-environment observation timestamp

Phase 19 setup owns GitHub App metadata, installation permissions, Environment secrets, and the real Actions dispatch. Local fixture results above remain contract evidence only; they are not a remote provider receipt.
