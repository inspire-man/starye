---
status: diagnosed
trigger: Deploy API After PR Merge fails during target-profile prepare-mutation with remote-resource-check-failed after a previously successful run.
created: 2026-07-18
updated: 2026-07-18T23:15:00+08:00
---

# Debug: Deploy API Remote Resource Check

## Symptoms

- Expected behavior: `Deploy API After PR Merge` passes the selected-target read-only preflight and deploys the API Worker.
- Actual behavior: `prepare-mutation --scope ci --target starye-org --ci-environment starye-org --command worker-deploy` exits 1 before deployment.
- Error message: `Target mutation preflight failed: remote-resource-check-failed` followed by an unhelpful `undefined` line.
- Timeline: Run 29571385986 succeeded on 2026-07-17; run 29648602083 failed on 2026-07-18.
- Reproduction: Push a matching API/DB/workflow change to `main`, causing `.github/workflows/deploy-api-after-pr.yml` to run.

## Current Focus

- hypothesis: The failed deploy is caused by the selected target's R2 bucket `starye-media` becoming unreadable to the CI preflight after the successful run; this is external Cloudflare resource/credential state drift, not a repository contract or Wrangler-version regression.
- test: Correlate the unchanged successful/failed code path with the Phase 13 official live-preflight failures and the `worker-deploy -> deploy -> includeWorkers=false` check set.
- expecting: Of the current failed checks, only R2 belongs to worker-deploy's live-check set, isolating the failed command to `wrangler r2 bucket info starye-media`.
- next_action: Return the diagnose-only root cause and recommend restoring/verifying R2 read access, then improving diagnostic propagation in a separate fix.

## Evidence

- timestamp: 2026-07-18
  observation: Successful run 29571385986 passed `prepare-mutation` and deployed the API Worker using generated config `.target-wrangler.ci-2335.toml`.
- timestamp: 2026-07-18
  observation: Current project state independently records selected-target live preflight blockers for R2 `starye-media` and Worker `starye-gateway` read checks.
- timestamp: 2026-07-18T23:03:45+08:00
  observation: The debug knowledge base has no entry sharing two or more symptom keywords with `remote-resource-check-failed` / `prepare-mutation`; there is no known-pattern shortcut to assume.
- timestamp: 2026-07-18T23:03:45+08:00
  observation: Project-defined skills cover crawler, D1 migration, Hono RPC, and UI work only; none adds deployment-diagnosis rules beyond the repository guardrails.
- timestamp: 2026-07-18T23:05:00+08:00
  observation: GitNexus query maps the failing path to `prepareTargetMutation` (`mutation-entry.ts`), `validateRemoteLiveCheck` (`preflight.ts`), and `runLiveResourceChecks` / `describeCheck` (`live-checks.ts`); the indexed cross-community process is `PrepareTargetMutation -> resolveTargetProfile -> TargetResolutionError`.
- timestamp: 2026-07-18T23:07:00+08:00
  observation: `prepareTargetMutation` calls `runTargetPreflight` with `live: true` and throws an error containing only `preflight.issues[].code`; it does not include `preflight.issues[].message`.
- timestamp: 2026-07-18T23:07:00+08:00
  observation: `validateRemoteLiveCheck` invokes `runLiveResourceChecks` for CI `worker-deploy` with workers included; `runLiveResourceChecks` maps any non-zero Wrangler exit to `remote-resource-check-failed` but does create a descriptive message via `describeCheck`, which is lost at `prepareTargetMutation`.
- timestamp: 2026-07-18T23:09:00+08:00
  observation: Initial retrieval of successful job 87855859264 failed before returning log content with `TLS handshake timeout` against `api.github.com`; this is a transient evidence-collection failure and does not describe the workflow failure itself.
- timestamp: 2026-07-18T23:15:00+08:00
  observation: Successful run 29571385986 used deploy job 87855859264 at SHA `0a57e5c`; its prepare step passed at 09:51:34-40Z and Worker deployment followed. Failed run 29648602083 used deploy job 88091008763 at SHA `1148196e`; its prepare step failed at 14:45:18-25Z with the generic code and trailing `undefined`.
- timestamp: 2026-07-18T23:15:00+08:00
  observation: Diff `0a57e5c..1148196e` has no relevant changes to `live-checks.ts`, `preflight.ts`, the selected target profile, or `.github/workflows/deploy-api-after-pr.yml`; both runs resolve `starye-org` and use Wrangler 4.90.1. The only `target-profile.ts` change adds an api-types build for Pages and cannot affect worker prepare.
- timestamp: 2026-07-18T23:15:00+08:00
  observation: Phase 13 official standalone live preflight reports exactly two inaccessible selected-target resources: R2 bucket `starye-media` and gateway Worker `starye-gateway` (`.planning/phases/13-full-chain-data-smoke/13-VERIFICATION.md`, lines 120-122).
- timestamp: 2026-07-18T23:15:00+08:00
  observation: Correction to the earlier worker-inclusion observation: `worker-deploy` maps to preflight command `deploy`; `validateRemoteLiveCheck` sets `includeWorkers = false` for `deploy`, excluding the gateway Worker check. Therefore the current failed item that can explain this Actions prepare failure is `wrangler r2 bucket info starye-media`.
- timestamp: 2026-07-18T23:15:00+08:00
  observation: The executor/preflight path reduces any non-zero Wrangler result to `remote-resource-check-failed` and does not preserve stderr in the thrown error. Existing evidence therefore cannot distinguish whether `starye-media` is absent/deleted from the selected account or the GitHub Environment token lost R2 read permission; both are external selected-target access drift.

## Eliminated

- hypothesis: The workflow has never had valid target profile or GitHub Environment configuration.
  evidence: Run 29571385986 completed the same prepare command and Worker deployment successfully.
- hypothesis: A repository change between `0a57e5c` and `1148196e` changed the worker-deploy preflight contract, selected target identity, workflow inputs, or Wrangler behavior.
  evidence: Relevant workflow/profile/preflight/live-check sources are unchanged, both runs use `starye-org`, and both install Wrangler 4.90.1; the only nearby CLI change is Pages-only.
- hypothesis: The `starye-gateway` Worker read failure caused the Deploy API prepare step to fail.
  evidence: `worker-deploy` maps to `deploy`, whose live preflight explicitly sets `includeWorkers=false`; gateway is not checked in this path.

## Resolution

- root_cause: The `starye-org` CI live preflight can no longer read the selected R2 bucket `starye-media` (`wrangler r2 bucket info starye-media` returns non-zero). The successful and failed SHAs use the same target, workflow, live-check contract, and Wrangler version, so the regression is external Cloudflare resource/credential state drift after the successful run. Because the check path discards Wrangler stderr, retained evidence cannot further distinguish bucket absence/deletion from loss of R2 read permission. The trailing `undefined` and generic code are a separate diagnostic-propagation defect: `runLiveResourceChecks` creates a resource-specific message, but `prepareTargetMutation` throws only issue codes and the executor does not preserve stderr.
- fix: No fix applied in diagnose-only mode. Operational remediation is to verify the `starye-org` GitHub Environment account/token, restore R2 read permission, and confirm `starye-media` exists in that account; recreate or restore the bucket only if absence is confirmed. A separate code change should preserve a redacted Wrangler diagnostic and include issue message/resource identity in the prepare-mutation error.
- verification: Root-cause boundary established by successful-vs-failed run comparison, unchanged relevant commit range and Wrangler version, and the current official standalone preflight. Re-run `prepare-mutation` after external remediation to verify; no repository fix was applied or self-verified.
- files_changed: [.planning/debug/deploy-api-remote-resource-check.md]
