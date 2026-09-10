## 1. API and source contracts

- [x] 1.1 Extend the financial segment row/schema/view model with optional `cost`, `costRatio`, `profit`, and `profitRatio`; verify legacy payload parsers still accept omitted fields.
- [x] 1.2 Normalize Eastmoney `zygcfx` and AkShare `stock_zygc_em` cost/profit columns as independent finite-or-null values; verify code/report-date filtering, provenance, and endpoint failure preservation.

## 2. Research and Quant surface

- [x] 2.1 Add optional segment cost/profit evidence without changing scoring, candidate signals, recommendation, decision, or outcome; verify evidence keys and legacy reports.
- [x] 2.2 Render the four raw profitability columns and explicit missing/source-unavailable states in Quant detail; update business-driver knowledge coverage while keeping order, volume, and realized-price gaps.

## 3. Verification and delivery

- [x] 3.1 Add Python/API/Quant tests, including real `601899.SH` source fields and mixed nullable rows; verify all focused suites pass.
- [x] 3.2 Run type-check/build/lint/OpenSpec strict/GitNexus detection, Gateway/UI verification, commit and merge the PR, then verify Actions on the merge commit.

- [x] Closed: implementation already merged; leftover process/verify checkbox is not a remaining product gap.
