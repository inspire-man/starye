## 1. API contract and persistence

- [x] 1.1 Add a user-scoped candidate AI session delete repository operation with delete readback; completion: owned, foreign, missing and successful delete readback cases have focused coverage.
- [x] 1.2 Add the authenticated DELETE route, parameter/response schemas and error mapping; completion: AppType and integration tests prove ownership isolation and no provider call.

## 2. Quant client and history surface

- [x] 2.1 Add the client delete method with response validation and focused parser/request tests; completion: only the session endpoint receives the request and malformed success envelopes fail closed.
- [x] 2.2 Add accessible two-step deletion, loading/success/error/retry states, list refresh and selected-detail cleanup; completion: controlled and self-loaded history modes retain current deterministic state and handle stale responses.
- [x] 2.3 Add responsive/focus styles and component tests; completion: desktop and 390px history rows remain readable with no nested interactive controls or horizontal overflow.

## 3. Verification and delivery

- [x] 3.1 Run API/Quant tests, type-check, lint and build; completion: all affected checks pass.
- [x] 3.2 Run strict OpenSpec validation, GitNexus detect_changes and `git diff --check`; completion: only session-management API/client/component symbols and flows are reported.
- [x] 3.3 Verify through `http://localhost:8080/quant/` the idle, confirm, success, failure/retry and empty-history states without console errors or deterministic-data changes.
- [ ] 3.4 Commit, push, create PR, wait for Actions, merge to main, verify merge commit Actions, and clean branch refs; completion: merge commit Actions are green and the next development branch starts from current main.
