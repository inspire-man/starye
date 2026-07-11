# Phase 06: User Setup Required

**Generated:** 2026-07-12
**Phase:** 06-storage-policy-audit
**Status:** Incomplete

Complete these items for the credentialed Phase 6 R2/D1 dry-run to function. The agent automated all repo-side work; the remaining steps require Cloudflare dashboard access.

## Environment Variables

| Status | Variable | Source | Add to |
|--------|----------|--------|--------|
| [ ] | `CLOUDFLARE_ACCOUNT_ID` | Cloudflare Dashboard → R2 / Account overview | local shell or ignored env file |
| [ ] | `R2_ACCESS_KEY_ID` | Cloudflare Dashboard → R2 → API Tokens | local shell or ignored env file |
| [ ] | `R2_SECRET_ACCESS_KEY` | Cloudflare Dashboard → R2 → API Tokens | local shell or ignored env file |
| [ ] | `R2_BUCKET_NAME` | Cloudflare Dashboard → R2 → Buckets | local shell or ignored env file |
| [ ] | `CLOUDFLARE_DATABASE_ID` | Cloudflare Dashboard → D1 → Database details | local shell or ignored env file |
| [ ] | `CLOUDFLARE_D1_TOKEN` | Cloudflare Dashboard → My Profile → API Tokens | local shell or ignored env file |
| [ ] | `R2_PUBLIC_URL` | Existing repo/env setting for the bucket's public base URL | local shell or ignored env file |

## Dashboard Configuration

- [ ] **Create or confirm an R2 API token with read-only inventory scope**
  - Location: Cloudflare Dashboard → R2 → API Tokens
  - Notes: The Phase 6 audit is read-only. Do not use a token that is intended for object deletion or lifecycle changes if a narrower token can be created.

- [ ] **Create or confirm a D1 token that can execute read-only queries**
  - Location: Cloudflare Dashboard → My Profile → API Tokens
  - Notes: The audit only needs query access so it can resolve DB reference counts for known fields.

## Verification

After completing setup, run:

```powershell
pnpm --filter @starye/crawler exec tsx scripts/audit-r2-storage.ts `
  --dry-run `
  --strict-env `
  --md-out .planning/phases/06-storage-policy-audit/06-R2-AUDIT-DRY-RUN.md `
  --json-out .planning/phases/06-storage-policy-audit/06-r2-audit-details.json `
  --csv-out .planning/phases/06-storage-policy-audit/06-r2-audit-details.csv
```

Expected results:

- The command exits successfully.
- `06-R2-AUDIT-DRY-RUN.md`, `06-r2-audit-details.json`, and `06-r2-audit-details.csv` are rewritten with live values.
- Rows for `comics/<slug>` and `comics/<slug>/<chapter>` remain separate.

---

**Once all items complete:** Mark status as "Complete" at top of file.
