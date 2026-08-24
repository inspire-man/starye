## 1. Contract and persistence

- [x] 1.1 Extend Quant schema/types with research marker status and add migration `0039_quant_research_marker.sql`; completion: schema and migration tests prove unique `ts_code` and repeatable application.
- [x] 1.2 Add repository list/upsert/delete integration and route schemas; completion: non-watchlist and invalid status requests fail without writes, valid upsert returns authoritative readback.
- [x] 1.3 Add Quant API client types/parsers and focused route/client tests; completion: marker payloads normalize missing records to `unreviewed`.

## 2. Decision and comparison workflow

- [x] 2.1 Add the candidate decision card to the analysis drawer; completion: candidate and non-candidate states render distinctly with no fabricated values.
- [x] 2.2 Add capped candidate selection and comparison drawer; completion: 2-3 candidates compare technical, valuation and financial fields, fourth selection is rejected, provider failure is isolated.
- [x] 2.3 Add research marker editor to the analysis drawer and list status affordance; completion: save updates local state, refresh reads persisted state, failed save preserves input.

## 3. Verification and closeout

- [x] 3.1 Run Quant/API/DB focused tests, lint, type-check and production builds; completion: all commands pass.
- [x] 3.2 Run OpenSpec strict validation and GitNexus change detection; completion: change scope is low/expected and tasks reflect actual implementation.
- [x] 3.3 Verify through Gateway at `http://localhost:8080/quant/` on desktop and 390px; completion: decision, compare and marker flows are readable with no console errors or page-level horizontal overflow.
