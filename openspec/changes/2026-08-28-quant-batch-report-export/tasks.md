## 1. Batch Markdown model

- [x] 1.1 Add a batch Markdown formatter and stable filename builder; completion: successful reports keep selection order, partial failures are explicit, and extra run fields stay excluded.
- [x] 1.2 Add focused formatter tests; completion: full success, partial success, empty input and allowlist behavior are covered.

## 2. Quant surface

- [x] 2.1 Add a completed-results-only export action to the comparison drawer; completion: it downloads successful reports locally without API or state mutation.
- [x] 2.2 Add success/failure feedback and responsive/focus styles; completion: running batches stay disabled, failures remain retryable, and 390px has no horizontal overflow.

## 3. Verification

- [x] 3.1 Run focused Quant tests, type-check and build; completion: all affected checks pass.
- [x] 3.2 Run OpenSpec strict validation and GitNexus detect_changes; completion: only expected Quant symbols and files are reported.
- [ ] 3.3 Verify full-success, partial-success and empty-result states through `http://localhost:8080/quant/`; completion: visible outcomes have no console errors.
