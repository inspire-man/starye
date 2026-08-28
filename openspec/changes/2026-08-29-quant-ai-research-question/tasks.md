## 1. Question API

- [x] 1.1 Add a bounded report-grounded question domain with OpenAI-compatible request handling, timeout/error classification, response field allowlist, evidence-key validation and trading-language rejection; completion: unit tests cover valid output, missing configuration, timeout, upstream failure, invalid fields, unknown citations and no secret leakage.
- [x] 1.2 Add the authenticated question schema and route; completion: owned-run success, missing/foreign run, invalid question and no-persistence behavior are covered by integration tests.

## 2. Quant question surface

- [ ] 2.1 Extend Quant types/client and add the report question panel; completion: request/response normalization, idle/loading/success/failure/retry states and duplicate-submit prevention are covered by focused tests.
- [ ] 2.2 Add evidence citation navigation, request-race protection, focus states and narrow-screen styles; completion: citations scroll/highlight the authoritative report row and 390px has no horizontal overflow.

## 3. Verification

- [ ] 3.1 Run API/Quant focused tests, type-check, lint and build; completion: all affected checks pass.
- [ ] 3.2 Run OpenSpec strict validation, GitNexus detect_changes and `git diff --check`; completion: only expected API/Quant symbols and flows are reported.
- [ ] 3.3 Verify through `http://localhost:8080/quant/` with report-present, report-absent, success, failure/retry and citation navigation states; completion: no console error/warn and deterministic report data remains unchanged.
