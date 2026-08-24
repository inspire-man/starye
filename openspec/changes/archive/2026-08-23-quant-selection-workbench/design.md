## Design

### Provider

- Define a provider-neutral daily contract in the existing Quant provider module.
- Keep Tushare request and error behavior unchanged for explicit `QUANT_DATA_PROVIDER=tushare` or a configured Tushare token.
- Add an Eastmoney history K-line adapter using `push2his.eastmoney.com`; map `SH`, `SZ`, and `BJ` codes to `secid`, validate response shape, normalize K-line fields, and keep request timeout bounded.
- Resolve provider as `QUANT_DATA_PROVIDER` when set; otherwise use Tushare when `TUSHARE_TOKEN` exists and Eastmoney when it does not. The API capability payload reports the selected source.

### Seed data

- Add `0038_quant_watchlist_seed.sql` with `INSERT OR IGNORE` rows and stable IDs for `601899.SH`/紫金矿业, `600089.SH`/特变电工, and `600938.SH`/中国海油.
- The seed is one-time migration data, so a user can later remove an item without it reappearing on every read.

### Selection cockpit

- Extend watchlist stats with latest close and latest percentage change from persisted daily bars.
- Add local candidate filters for all candidates, ready data, and signal-bearing candidates; keep the server snapshot authoritative.
- Add a selected-candidate explanation strip showing score, data quality, matched signals, and missing factors.
- Keep provider and capability metadata out of the selection UI. The data-source/operations surface owns provider, points tier, and capability diagnostics; the workbench only shows data freshness and coverage.
- Add a compact "today's focus" ranking and risk-note strip derived from the persisted candidate snapshot. Explain existing momentum factors in plain Chinese labels without presenting them as forecasts.

### Visual system

- Align Quant CSS variables with Dashboard's indigo operational token set and shared `DataTable` dimensions.
- Keep the single-page workflow, but use Dashboard-like compact surfaces, status states, table density, sticky headers, and responsive stacking.
- Treat the workbench as a selection cockpit: the first viewport prioritizes watchlist breadth, latest data date, signal count, top candidates, and data-based risk notes. Avoid operations-only status such as administrator session, points tier, provider badge, or Gateway session.
- Avoid custom hard-coded component colors; use local token variables and existing `@starye/ui` primitives.

## Verification

- Provider unit tests cover Eastmoney parsing, code-to-market mapping, empty/error responses, timeout, and Tushare compatibility.
- API integration tests cover seeded rows, latest watchlist stats, and provider selection.
- Quant app tests cover parsing the provider/candidate fields and the UI build/type-check.
- Run config, API, Quant app tests, lint, type-check, OpenSpec strict validation, and Gateway-based local browser smoke.
