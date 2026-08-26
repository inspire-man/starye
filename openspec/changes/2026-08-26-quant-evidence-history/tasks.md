## 1. Comparison logic

- [x] 1.1 Add a pure research evidence comparison module keyed by evidence key, with status/value direction labels and bounded output; verify missing and non-comparable values remain honest.
- [x] 1.2 Add focused unit tests for improvement, weakening, restored, newly missing, persistent missing and unchanged evidence.

## 2. Quant surface

- [x] 2.1 Connect the comparison to the existing research run history and render latest/previous timestamps plus bounded change rows in the detail drawer.
- [x] 2.2 Add responsive styles and an insufficient-history state while keeping the latest report and AI summary visible.

## 3. Verification and delivery

- [x] 3.1 Run Quant tests, type-check, lint and build; run OpenSpec strict validation.
- [x] 3.2 Run GitNexus detect_changes and Gateway/browser regression for two-run and one-run states.
- [ ] 3.3 Commit, push, review PR Actions, merge after checks pass and verify post-merge deployment Actions.
