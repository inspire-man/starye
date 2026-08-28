## 1. History state boundary

- [x] 1.1 Add a pure history hydration merge helper; completion: existing batch state wins, prior history can refresh, no-history stays idle, and read failure preserves current state.
- [x] 1.2 Add focused tests for all hydration outcomes; completion: stale and failure inputs are deterministic.

## 2. Quant comparison surface

- [x] 2.1 Load the latest history for selected candidates when opening the comparison drawer; completion: restored reports expose the existing view/export/copy paths without generating new reports.
- [x] 2.2 Add independent per-candidate history errors, retry action, request race protection and narrow-screen/focus styles; completion: batch state is preserved and 390px has no horizontal overflow.

## 3. Verification

- [x] 3.1 Run focused Quant tests, type-check, lint and build; completion: all affected checks pass.
- [x] 3.2 Run OpenSpec strict validation and GitNexus detect_changes; completion: only expected Quant symbols and flows are reported.
- [ ] 3.3 Verify restored, empty-history and history-failure states through `http://localhost:8080/quant/`; completion: visible outcomes have no console errors.
