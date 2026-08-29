## 1. API contract

- [x] 1.1 Add a scope-bound candidate question domain and strict request/response schemas; completion: bounded prompt, server-owned facts, allowlisted response, citation validation and typed provider errors pass.
- [x] 1.2 Add the authenticated candidate briefing question route and integration coverage; completion: valid scope, omitted/empty/unknown/pending/foreign/oversized inputs and client-owned facts have expected no-provider-call behavior.

## 2. Quant client and surface

- [x] 2.1 Extend Quant types/client and add the briefing question form; completion: request body contains only `ts_codes` and `question`, and idle/loading/success/error states render correctly.
- [x] 2.2 Add citation navigation and request-race protection; completion: cited codes open the existing candidate detail flow and stale scope results are discarded.
- [x] 2.3 Add client/component/domain tests for question validation, scope labels, disabled pending/empty states and deterministic fact preservation.

## 3. Verification

- [x] 3.1 Run API/Quant tests, type-check, lint and build; completion: all affected checks pass.
- [x] 3.2 Run strict OpenSpec validation, GitNexus staged change detection and `git diff --check`; completion: only expected candidate-question/API/Quant flows are reported.
- [x] 3.3 Verify Gateway candidate filter and idle states through `http://localhost:8080/quant/#candidates` without sending candidate data to the external provider; completion: no browser console errors and deterministic table fields remain unchanged.
