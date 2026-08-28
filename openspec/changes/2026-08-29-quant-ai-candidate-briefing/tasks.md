## 1. API contract and domain

- [x] 1.1 Add the versioned candidate-briefing domain types, bounded prompt and provider error classification.
- [x] 1.2 Add the authenticated route that reads server-side candidate data and deterministic priority facts.
- [x] 1.3 Add schema and focused domain/route tests for empty data, isolation, valid output, invalid claims, timeout, and upstream failure.

## 2. Quant client and surface

- [x] 2.1 Add client types/parser/request and request-race-safe briefing state.
- [x] 2.2 Add the candidate-page briefing panel and existing detail-drawer navigation.
- [x] 2.3 Add responsive/focus-visible styles and focused client/component tests.

## 3. Verification

- [x] 3.1 Run API/Quant tests, type-check, lint and build.
- [x] 3.2 Run strict OpenSpec validation, GitNexus staged change detection and `git diff --check`.
- [x] 3.3 Verify candidate briefing idle through `http://localhost:8080/quant/` without console errors or deterministic-data mutation; success/error/retry and focus navigation are covered by API, client and component tests.
