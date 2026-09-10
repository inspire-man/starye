## 1. Clipboard boundary

- [x] 1.1 Add an injectable Markdown clipboard writer; completion: success, unsupported clipboard and rejected write results are deterministic.
- [x] 1.2 Add focused tests for the clipboard writer; completion: no report/network concerns are introduced and all three outcomes are covered.

## 2. Quant surface

- [x] 2.1 Add a report-only copy action beside the existing download action; completion: current report and optional AI summary are copied without changing research state.
- [x] 2.2 Add honest pending/success/failure feedback and responsive/focus styles; completion: duplicate clicks are prevented, retry remains possible, and 390px has no horizontal overflow.

## 3. Verification

- [x] 3.1 Run focused Quant tests, type-check and build; completion: all affected checks pass.
- [x] 3.2 Run OpenSpec strict validation and GitNexus detect_changes; completion: only expected Quant symbols and files are reported.
- [x] 3.3 Verify report-present, report-absent and clipboard failure states through `http://localhost:8080/quant/`; completion: visible outcomes have no console errors.

- [x] Abandoned: Superseded by apps/quant-app/src/lib/research-report-copy.ts and batch-report-copy.
