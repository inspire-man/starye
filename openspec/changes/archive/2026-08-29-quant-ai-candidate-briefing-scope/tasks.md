## 1. API contract

- [x] 1.1 Add strict candidate-code scope request validation and server-side snapshot filtering; completion: omitted, selected, empty, unknown and oversized scopes have typed behavior and only server-owned facts reach AI.
- [x] 1.2 Add route/schema integration coverage; completion: authenticated scope filtering, isolation, malformed body and no-provider-call input errors pass.

## 2. Quant client and surface

- [x] 2.1 Send current filtered candidate codes from the client and track scope metadata; completion: request body contains only `ts_codes`, success shows the generated scope, and no candidate facts are sent.
- [x] 2.2 Discard stale scope results and reset briefing state on filter/snapshot changes; completion: request id plus scope key prevent old responses from rendering and empty scopes disable generation.
- [x] 2.3 Add client/component tests for scope labels, empty scope, request body and race-safe behavior.

## 3. Verification

- [x] 3.1 Run API/Quant tests, type-check, lint and build; completion: all affected checks pass.
- [x] 3.2 Run strict OpenSpec validation, GitNexus staged change detection and `git diff --check`; completion: only expected Quant route/client/filter flows are reported.
- [x] 3.3 Verify Gateway filter and idle states through `http://localhost:8080/quant/#candidates` without console errors; completion: displayed scope matches the selected candidate list and deterministic fields remain unchanged.
