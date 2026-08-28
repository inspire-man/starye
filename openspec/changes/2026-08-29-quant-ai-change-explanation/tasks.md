## 1. API contract and domain

- [x] 1.1 Add the versioned change-explanation domain request/response types, bounded prompt and provider error classification.
- [x] 1.2 Add authenticated route validation for owned, distinct, same-stock research runs and deterministic comparison inputs.
- [x] 1.3 Add API schema and focused domain/route tests for success, isolation, invalid output, prohibited claims, timeout, and upstream failure.

## 2. Quant client and surface

- [x] 2.1 Add client types/parser/request and request-race-safe detail state for change explanations.
- [x] 2.2 Add the evidence-change explanation panel with idle/loading/success/error/retry/configuration and citation focus behavior.
- [x] 2.3 Add responsive and focus-visible styles and focused component/client tests for 390px-safe layout.

## 3. Verification

- [x] 3.1 Run API/Quant tests, type-check, lint and build.
- [x] 3.2 Run strict OpenSpec validation, GitNexus staged change detection and `git diff --check`.
- [ ] 3.3 Verify the report-present, one-run empty, success, failure/retry and citation navigation states through `http://localhost:8080/quant/` without console errors or deterministic-data mutation.
