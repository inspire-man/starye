## 1. Formatter

- [x] 1.1 Add an allowlisted candidate briefing Markdown formatter and stable filename builder; completion: metadata, scope, focus facts, checks, citations, missing values and newline normalization are deterministic.
- [x] 1.2 Add formatter tests; completion: complete, empty, multiline and sensitive-field fixtures pass without serializing unknown fields.

## 2. Quant surface

- [x] 2.1 Add briefing export and clipboard actions to the success state; completion: actions appear only with a briefing, export is local, copy uses the existing clipboard helper, and no API request is added.
- [x] 2.2 Add copy loading/success/unavailable/failure states plus responsive/focus-visible styles; completion: buttons remain usable at narrow width and stale state resets after candidate refresh.
- [x] 2.3 Add component and app-state tests; completion: success/error/idle rendering, emitted actions, disabled copy state and message semantics pass.

## 3. Verification

- [x] 3.1 Run Quant tests, type-check, lint and build; completion: all affected checks pass.
- [x] 3.2 Run OpenSpec strict validation, GitNexus staged change detection and `git diff --check`; completion: only expected Quant symbols and files are reported.
- [x] 3.3 Verify Gateway idle state through `http://localhost:8080/quant/#candidates` without console errors; success-state export/copy controls and deterministic-field preservation are covered by formatter/component tests.
