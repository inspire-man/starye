## 1. Target-aware configuration

- [x] 1.1 Add the Quant URL surface to the target profile schema and tracked `starye-org` profile.
- [x] 1.2 Emit `QUANT_ORIGIN` from Worker projections, generated Wrangler config, and local env projection.
- [x] 1.3 Add regression tests for profile validation, projection, materialized Gateway config, and local projection.

## 2. Cloudflare provisioning

- [x] 2.1 Create the `starye-quant` Pages project and deploy the production `main` build.
- [x] 2.2 Set the API Worker `TUSHARE_TOKEN` as a server-only secret.
- [x] 2.3 Deploy the Gateway with the generated target-aware config.

## 3. Verification

- [x] 3.1 Run focused tests, lint, type-check, and OpenSpec strict validation.
- [x] 3.2 Verify `https://starye.org/quant/` and the authenticated Quant API through the Gateway.
