## 1. Provider and API

- [x] 1.1 Add provider-neutral daily types, Eastmoney history provider, selection rules, and capability source metadata.
- [x] 1.2 Extend watchlist stats with latest close and percentage change.
- [x] 1.3 Add provider, sync, repository, route, and API-client regression coverage.

## 2. Starter data

- [x] 2.1 Add idempotent D1 seed migration for the three requested stocks.
- [x] 2.2 Include the seed migration in database integration/migration tests.

## 3. Selection cockpit and visual polish

- [x] 3.1 Align Quant styling with Dashboard tokens and shared table density.
- [x] 3.2 Add candidate filters and selected-candidate signal explanation.
- [x] 3.3 Show latest watchlist price/change and active data source.

## 4. Verification

- [x] 4.1 Run focused tests, lint, type-check, and OpenSpec strict validation.
- [x] 4.2 Verify the local Quant route through Gateway at `http://localhost:8080/quant/`.
