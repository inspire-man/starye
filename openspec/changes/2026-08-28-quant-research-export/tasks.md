## 1. Markdown export model

- [x] 1.1 Add a pure report Markdown formatter and stable filename builder; completion: allowed report/summary fields, missing semantics, evidence provenance, and filename normalization are deterministic.
- [x] 1.2 Add focused formatter tests; completion: complete, partial, empty, optional-summary, and sensitive-field fixtures pass without leaking unapproved fields.

## 2. Quant detail surface

- [x] 2.1 Add a local browser download action to the existing report header; completion: export appears only with a report and uses a Blob without an API request or state mutation.
- [x] 2.2 Add responsive/focus styling for generate/export actions; completion: desktop and 390px layouts remain usable with no horizontal overflow.

## 3. Verification

- [x] 3.1 Run Quant tests, type-check, lint and build; completion: all affected checks pass.
- [x] 3.2 Run OpenSpec strict validation and GitNexus detect_changes; completion: only expected Quant symbols and files are reported.
- [ ] 3.3 Verify Gateway route and download-ready report states through `http://localhost:8080/quant/`; completion: report-present and report-absent behavior is observable without console errors.
