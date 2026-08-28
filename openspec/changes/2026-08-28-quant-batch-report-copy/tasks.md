## 1. Batch clipboard payload

- [x] 1.1 Reuse the existing batch Markdown formatter for clipboard payloads; completion: selection order, partial failure summary and empty input remain deterministic.
- [x] 1.2 Add focused payload coverage; completion: copied content is exactly the formatter output and no API/network path is introduced.

## 2. Quant comparison surface

- [x] 2.1 Add a completed-results-only batch copy action beside download; completion: full and partial successful batches copy without changing research state.
- [x] 2.2 Add independent pending/success/failure feedback and responsive/focus styles; completion: duplicate clicks are prevented, retry remains possible, and 390px has no horizontal overflow.

## 3. Verification

- [x] 3.1 Run focused Quant tests, type-check, lint and build; completion: all affected checks pass.
- [x] 3.2 Run OpenSpec strict validation and GitNexus detect_changes; completion: only expected Quant symbols and files are reported.
- [ ] 3.3 Verify full-success, partial-success, empty and clipboard-failure states through `http://localhost:8080/quant/`; completion: visible outcomes have no console errors.
