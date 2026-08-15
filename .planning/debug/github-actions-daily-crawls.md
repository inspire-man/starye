---
status: awaiting_human_verify
trigger: "GitHub Actions Daily Actor Crawl, Daily Manga Crawl, Daily Movie Crawl, and Daily Publisher Crawl fail on scheduled runs"
created: 2026-08-14
updated: 2026-08-15
---

# Debug: GitHub Actions Daily Crawls

## Symptoms

- Expected behavior: the four scheduled crawl workflows complete successfully and emit valid production control-plane/provider evidence.
- Actual behavior: Actor and Publisher fail during prepared-entry execution; Manga and Movie fail during schedule registration and target resolution, so crawl is skipped.
- Error messages: `target-crawl-mutation requires the registry-owned smoke operation.` and `Missing Actions callback environment: ACTIONS_APPLICATION_ATTEMPT`.
- Timeline: the latest runs on 2026-08-13/14 fail, with preceding scheduled runs also failing.
- Reproduction: inspect the latest scheduled runs for `Daily Actor Crawl`, `Daily Manga Crawl`, `Daily Movie Crawl`, and `Daily Publisher Crawl` in `inspire-man/starye`.

## Current Focus

- hypothesis: `runCli` eagerly loads application run/attempt bindings for `schedule-register`, although schedule registration needs only immutable provider credentials; independent stale Actor/Publisher workflows still invoke entries excluded from the closed production registry.
- hypothesis: confirmed. The CLI's eager full-binding client construction caused Manga/Movie schedule registration to require unavailable application bindings; independently, stale Actor/Publisher schedules invoked entries outside the closed production registry. A follow-up inspection found the remaining 400s were caused by a missing signed envelope and an hour-truncated `scheduled_at` value.
- test: focused client, workflow contract, API callback route, and crawler type-check verification has passed; verify fresh Manga/Movie scheduled or manually dispatched production workflows after this repair is delivered.
- expecting: Manga/Movie complete their register/resolve/crawl path with a schema-valid, fresh schedule callback, while Actor/Publisher produce no scheduled mutation run and remain explicit retired manual entries.
- next_action: obtain human confirmation from a fresh GitHub Actions run after the repair is delivered.

reasoning_checkpoint:
  hypothesis: "`runCli` causes schedule registration to fail because it constructs a fully bound Actions client before dispatching the command; the same stale workflow inventory causes Actor/Publisher to invoke unsupported prepared entries."
  confirming_evidence:
    - "The failing Manga/Movie logs stop at `Missing Actions callback environment: ACTIONS_APPLICATION_ATTEMPT`; their register-schedule jobs deliberately have no application run/attempt outputs yet."
    - "`actions-event-client.ts` constructs the client before its command switch and `createActionsEventClientFromEnvironment` requires `ACTIONS_APPLICATION_ATTEMPT`; `mutation-entry.ts` exposes production crawler entries only for Manga/Movie while Actor/Publisher workflows invoke other entries."
  falsification_test: "A schedule-only client constructed without application run/attempt variables succeeds, and the retired Actor/Publisher workflow sources contain neither a schedule trigger nor a prepared-entry invocation; any remaining requirement or invocation falsifies the repair."
  fix_rationale: "A command-specific schedule-registration client preserves strict application binding for dispatch/lifecycle commands while allowing registration to create that binding. Retiring legacy workflows removes unsupported operations instead of redirecting them to a different crawler."
  blind_spots: "Fresh GitHub Actions dispatch cannot be observed until the repair is pushed; tests validate source and client construction only."
  candidate_causes:
    - "code: eager full-environment client construction before command dispatch"
    - "config: scheduled jobs intentionally omit application run/attempt values until schedule registration returns them"
    - "code: Actor/Publisher workflow definitions retained entries outside the closed production registry"
  and_gate: "yes - fulfilling the reported four-workflow failure requires both independent corrections, although each individual workflow failure has one direct cause."

## Evidence

- timestamp: 2026-08-14
  source: `gh run view 31759096176 --log-failed`
  finding: Daily Actor Crawl fails in `Run selected actor entry` with the registry-owned smoke-operation error.
- timestamp: 2026-08-14
  source: `gh run view 31734009299 --job 94561130724 --log`
  finding: Daily Manga Crawl registration fails because `ACTIONS_APPLICATION_ATTEMPT` is missing.
- timestamp: 2026-08-14
  source: `gh run view 31723079477 --job 94524615178 --log`
  finding: Daily Movie Crawl registration fails because `ACTIONS_APPLICATION_ATTEMPT` is missing.
- timestamp: 2026-08-14
  source: `gh run view 31671112192 --log-failed`
  finding: Daily Publisher Crawl fails in `Run selected publisher entry` with the registry-owned smoke-operation error.
- timestamp: 2026-08-14
  source: local source inspection
  finding: provider association currently binds only Manga/Movie workflows; the target mutation child maps production operations only for `crawler-comic` and `crawler-optimized`.
- timestamp: 2026-08-14
  source: focused Vitest run
  finding: existing Actions client, production workflow, and workflow contract tests pass, but no test exercises CLI schedule registration without application run/attempt variables.
- timestamp: 2026-08-14
  source: source inspection and GitNexus impact analysis
  finding: `runCli` builds `createActionsEventClientFromEnvironment` before reading its command, so schedule registration requires unavailable application bindings; impact for the Actions-client and workflow-contract target symbols is LOW. Actor/Publisher workflow entries are absent from the closed production crawler registry.
- timestamp: 2026-08-14
  source: focused Vitest RED run
  finding: schedule environment regression fails because `createScheduleRegisterActionsEventClientFromEnvironment` does not exist; workflow contract fails because `daily-actor-crawl.yml` still contains `schedule:` and `run-prepared-entry`.
- timestamp: 2026-08-14
  source: focused post-fix verification
  finding: Actions-client and workflow-contract regressions pass (12 tests); adjacent production workflow/mutation contracts pass (17 tests); direct `schedule-register` CLI with no application run/attempt variables reaches the callback request and fails only at the deliberately unreachable endpoint.
- timestamp: 2026-08-14
  source: fix-acceptance prechecks
  finding: `pnpm --filter @starye/crawler type-check` and `git diff --check` pass. No Stryker configuration exists. The 138 deleted workflow lines remove unsupported Actor/Publisher mutation paths and are guarded by new retired-workflow assertions; the repair does not alter existing Phase 26 files.
- timestamp: 2026-08-14
  source: scoped revert-and-reconfirm
  finding: reversing only `actions-event-client.ts` and the two legacy workflows makes exactly the two new regressions fail (10 passing, 2 failing); reapplying the exact repair makes all 12 focused tests pass again.
- timestamp: 2026-08-15
  source: `gh run view 31831004428 --log-failed` and `gh run view 31821218389 --log-failed`
  finding: both scheduled jobs reach `schedule-register` and receive HTTP 400; their workflows start about 50–56 minutes after the cron hour while generating `scheduled_at` at the hour boundary.
- timestamp: 2026-08-15
  source: API schema and client source inspection
  finding: `CrawlerScheduleRegisterEventSchema` requires `event_id`, `key_id`, `nonce`, and `timestamp`, but `ActionsEventClient.scheduleRegister()` sent only provider fields; the API also rejects `scheduled_at` older than five minutes.
- timestamp: 2026-08-15
  source: focused post-fix verification
  finding: actions client/workflow contract tests pass (12 tests), crawler callback route tests pass (18 tests), crawler type-check passes, and `git diff --check` passes.

## Resolution

root_cause: `runCli` eagerly constructed a fully application-bound Actions client before selecting `schedule-register`, although schedule registration runs before an application run/attempt exists; independently, the stale Actor/Publisher schedules invoked prepared entries excluded from the closed production registry. The remaining Manga/Movie 400s came from an incomplete schedule callback envelope and an hour-truncated `scheduled_at` that violated the API's five-minute freshness bound.
fix: Added a schedule-registration-specific Actions client factory that loads only callback and immutable provider environment values, preserves the required signed event envelope, and uses the actual workflow execution time for `scheduled_at` while retaining the hour bucket for idempotency. Replaced stale Actor/Publisher scheduled mutation workflows with explicit manual retirement notices and added contract coverage.
oracle_type: specified
verification:
  target_test: { result: pass, suites_run: ["actions-event-client.test.ts", "workflow-contract.test.ts"], tests: 12 }
  mutation_check: { result: skipped, reason_if_skipped: "No Stryker configuration or package dependency exists in the repository." }
  no_op_deletion: { result: pass, deletion_justified_by_rca: true, rationale: "Removed Actor/Publisher prepared mutation paths are unsupported by the closed production registry; replacement workflows report explicit retirement and tests prohibit remapping." }
  adjacent_tests: { result: pass, suites_run: ["production-workflow.integration.test.ts (crawler)", "production-workflow.integration.test.ts (config)", "mutation-entry.test.ts", "crawler-runs.route.test.ts", "production-events.integration.test.ts"], tests: 35, type_check: "pnpm --filter @starye/crawler type-check" }
  revert_and_reconfirm: { result: pass, bug_returned_on_revert: true, fixed_on_reapply: true }
  guardrail_verdict: accepted
  manual_cli: "schedule-register without ACTIONS_APPLICATION_RUN_ID/ACTIONS_APPLICATION_ATTEMPT reached the callback request and failed only at the deliberately unreachable endpoint"
files_changed:
  - .github/workflows/daily-actor-crawl.yml
  - .github/workflows/daily-publisher-crawl.yml
  - packages/config/src/deployment-target/__tests__/workflow-contract.test.ts
  - packages/crawler/src/task-runner/__tests__/actions-event-client.test.ts
  - packages/crawler/src/task-runner/actions-event-client.ts
follow_up_files_changed:
  - .github/workflows/daily-manga-crawl.yml
  - .github/workflows/daily-movie-crawl.yml
  - packages/config/src/deployment-target/__tests__/workflow-contract.test.ts
  - packages/crawler/src/task-runner/__tests__/actions-event-client.test.ts
  - packages/crawler/src/task-runner/actions-event-client.ts

## Eliminated

- hypothesis: transient GitHub runner or network outage
  reason: identical deterministic application errors recur across multiple scheduled runs and jobs reach the failing project command.
