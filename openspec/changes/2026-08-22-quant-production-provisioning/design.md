## Design

- Model the production Quant origin as a required URL surface in the tracked target profile, while keeping Quant out of the existing Pages surface enum because it is deployed and served as an independent frontend behind Gateway.
- Extend the Gateway worker projection and Wrangler materializer with `QUANT_ORIGIN`; local projection metadata also includes the same managed key while `scripts/local-dev.ts` continues to override it with `http://localhost:3004`.
- Deploy `apps/quant-app/dist` directly to the Cloudflare Pages project `starye-quant` on production branch `main`. The app keeps its `/quant/` Vite base because production Gateway strips the prefix before forwarding asset requests.
- Store the existing Tushare token only as the API Worker secret `TUSHARE_TOKEN`; the capability registry remains server-side and defaults to the existing 120-point contract.

## Verification

- Run focused deployment-target/configuration tests and Gateway tests.
- Run `pnpm lint`, `pnpm type-check`, and relevant tests before the Gateway deployment.
- Verify Pages origin HTTP 200, Gateway `/quant/` HTML/static assets, and authenticated `/api/quant/capabilities` behavior without exposing secret values.
