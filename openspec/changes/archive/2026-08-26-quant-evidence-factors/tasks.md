## 1. Specification and bridge factors

- [x] 1.1 Extend the contract-compatible bridge evidence builder with bounded 20-day return and six normalized financial factor evidence items; verify missing fields remain `null` with `missing` status.
- [x] 1.2 Add bridge tests for metric aliases, date selection, threshold status, insufficient daily windows and partial upstream responses.

## 2. Worker report and AI grounding

- [x] 2.1 Map granular AkShare evidence into the deterministic report and add transparent same-metric cross-source agreement/caution details without changing score or action; verify with report tests.
- [x] 2.2 Strengthen the AI summary prompt with source/date/formula semantics and verify granular evidence keys are included while invented keys and unsupported conclusions remain rejected.

## 3. Quant evidence surface

- [x] 3.1 Group and format granular evidence in the existing research detail drawer, including missing/unavailable states and source metadata; verify with client/component tests and responsive build.
- [x] 3.2 Keep the report summary, deterministic action and AI summary states visible in every bridge state; verify through the Gateway Quant route with browser/network evidence.

## 4. Verification and delivery

- [x] 4.1 Run focused bridge/API/Quant tests, type-checks, lint and builds; run OpenSpec strict validation.
- [x] 4.2 Run GitNexus detect_changes and inspect the changed execution flows before commit.
- [x] 4.3 Commit and push the branch, start code review, then inspect Actions and report any external deployment failures separately from code failures.
