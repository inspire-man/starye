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
