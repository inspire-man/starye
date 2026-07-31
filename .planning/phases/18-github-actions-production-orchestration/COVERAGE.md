# API Coverage — GitHub Actions Production Orchestration

> Full coverage by default. Opt-outs are explicit and reasoned.

| capability | decision | reason |
|---|---|---|
| GitHub App JWT creation | INTEGRATE | Required to mint request-scoped installation tokens. |
| installation-token exchange | INTEGRATE | Required for least-privilege provider calls. |
| fixed movie workflow dispatch | INTEGRATE | PROD-01 production execution surface. |
| fixed manga workflow dispatch | INTEGRATE | PROD-01 production execution surface. |
| schedule registration | INTEGRATE | Schedule runs must enter the D1 control plane. |
| dispatch input snapshot binding | INTEGRATE | Binds run_id, attempt, template, and target before crawler startup. |
| provider_started callback | INTEGRATE | Binds GITHUB_RUN_ID and GITHUB_RUN_ATTEMPT to the application attempt. |
| progress and log callbacks | INTEGRATE | Preserves signed operational evidence for the provider run. |
| terminal receipt callback | INTEGRATE | Required for validated content handoff. |
| provider status polling | INTEGRATE | Supplies bounded compensation when callbacks are late or missing. |
| provider cancellation | INTEGRATE | Implements cooperative cancel_requested semantics. |
| business retry with new attempt | INTEGRATE | Keeps retry history and provider runs distinct. |
| credentialed remote production proof | OPT-OUT | Target App metadata and Environment secrets are configured during execution/Phase 19 sign-off. |

