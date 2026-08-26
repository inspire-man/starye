## 1. Timeline model

- [x] 1.1 Add a pure research-run timeline module with stable sorting, bounded output, status/action change counts and finite-only score deltas.
- [x] 1.2 Add focused tests for newest-first ordering, score up/down/flat, missing scores, missing timestamps and display limits.

## 2. Quant surface

- [x] 2.1 Connect the timeline to the existing selected-stock research history without changing the API contract.
- [x] 2.2 Render current score, adjacent delta, status/action change counts and compact history points with a history-insufficient state.
- [x] 2.3 Add responsive styles and tooltip/context wording that keeps the timeline separate from trading instructions.

## 3. Verification and delivery

- [x] 3.1 Run Quant tests, type-check, lint and build; run OpenSpec strict validation.
- [x] 3.2 Run GitNexus detect_changes and Gateway/browser regression for one-run and multi-run states; missing-score behavior is covered by focused unit tests.
- [ ] 3.3 Commit, push, review PR Actions, merge after checks pass and verify post-merge workflow results.
