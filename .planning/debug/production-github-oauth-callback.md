---
status: resolved
trigger: Production GitHub login on starye.org is rejected because the OAuth App does not associate the redirect URI.
created: 2026-07-17
updated: 2026-07-17T17:09:00+08:00
---

# Debug: Production GitHub OAuth Callback

## Symptoms

- Expected behavior: selecting GitHub login from `https://starye.org` completes the OAuth round trip and returns to the requested Dashboard path.
- Actual behavior: GitHub displays `The redirect_uri is not associated with this application.` before authentication completes.
- Error: GitHub rejects the callback URI sent by production.
- Timeline: observed during Phase 13 production acceptance on 2026-07-17.
- Reproduction: open `https://starye.org/auth/start/github?next=%2Fdashboard%2Fmovies` and follow the GitHub authorization redirect.

## Current Focus

- hypothesis: confirmed — `starye-api` is running a GitHub credential pair for an OAuth App other than “Starye Prod”; GitHub validates the request against that other App's callback list and rejects the otherwise-correct production URI.
- test: after the production Worker receives the matching “Starye Prod” credential pair, rerun the exact `/auth/start/github?next=%2Fdashboard%2Fmovies` flow and compare the emitted Client ID with “Starye Prod”.
- expecting: the emitted authorization URL identifies “Starye Prod”, GitHub no longer returns `The redirect_uri is not associated with this application.`, and the completed flow returns to `/dashboard/movies`.
- next_action: have an authorized operator replace both `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` on the `starye-api` Worker with the matching “Starye Prod” values, without exposing either secret, then perform the production verification.

## Evidence

- timestamp: 2026-07-17
  observation: production `Location` header sends `redirect_uri=https://api.starye.org/api/auth/callback/github`.

- timestamp: 2026-07-17T14:24:26+08:00
  observation: GitNexus reports the `starye` index is seven commits behind HEAD; its OAuth-flow query returned no processes, so the index must be refreshed before treating graph results as evidence.

- timestamp: 2026-07-17T14:26:02+08:00
  observation: the OAuth App named “Starye Prod” has callback URL `https://api.starye.org/api/auth/callback/github`, exactly matching the production `redirect_uri`, but its Client ID differs from the `Ov23li85d45Mt6QfUaDe...` client ID in the failing production authorization URL.
  implication: GitHub selects the OAuth App by `client_id`, so the failing request is not using “Starye Prod”; the initially suspected stale callback setting is eliminated.

- timestamp: 2026-07-17T14:26:30+08:00
  observation: `npx gitnexus analyze` reports the index is already up to date, but the refreshed OAuth query still has no indexed process or symbol.
  implication: GitNexus cannot locate this configuration flow; direct source inspection is required and no source change is authorized by this result.

- timestamp: 2026-07-17T14:27:45+08:00
  observation: `apps/api/src/lib/auth.ts` declares `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` in the Worker environment and passes both unchanged to Better Auth's GitHub social provider. `apps/auth/server/routes/start/github.get.ts` only proxies the API-generated authorization URL. GitNexus context confirms the `createAuth` path is entered through `authMiddleware`.
  implication: the emitted `client_id` is controlled by the API Worker's runtime binding, not by the auth frontend route or a source constant. Updating the deployed GitHub credential pair is the minimal correction; no application-code change is indicated.

- timestamp: 2026-07-17T14:29:05+08:00
  observation: `apps/api/DEPLOYMENT.md` identifies `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` as Wrangler secrets. The API package delegates deployment to `target-deploy -- --app api`; repository CI deploys the API with a generated Wrangler config.
  implication: credential correction belongs in the deployed API Worker secret bindings. A normal source deploy cannot safely infer or replace the required secret pair.

- timestamp: 2026-07-17T14:30:15+08:00
  observation: the API deploy path materializes a target-specific Wrangler config before running `wrangler deploy`; the GitHub Actions workflow scopes that deployment to target `starye-org`.
  implication: the correction must be made against the production API Worker resolved from the `starye-org` target, then verified by re-reading the OAuth authorization URL. No repository file should be edited.

- timestamp: 2026-07-17T14:31:40+08:00
  observation: the tracked `starye-org` profile resolves `api.starye.org` to Worker `starye-api`. The profile intentionally contains no GitHub OAuth credentials; the source and deployment documentation classify `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` as Worker secret bindings.
  implication: the correct fix is an external `starye-api` configuration rotation of the matching GitHub credential pair. The source code, the auth Pages proxy, and the GitHub callback URL require no change.

## Eliminated

- hypothesis: the “Starye Prod” OAuth App callback URL is stale or mismatched.
  evidence: its configured callback URL exactly equals the live production `redirect_uri`; GitHub is instead receiving a different Client ID.
  timestamp: 2026-07-17T14:26:02+08:00


## Resolution

- root_cause: The production `starye-api` Worker is using a `GITHUB_CLIENT_ID` for an OAuth App other than “Starye Prod”. Better Auth forwards that binding unchanged to GitHub, so GitHub validates the callback URI against the other App and rejects it. “Starye Prod” itself is correctly configured but is not the App selected by the failing request.
- fix: Completed authorized external configuration update — `starye-api` now uses the matching “Starye Prod” OAuth credential pair. Repository code and the App callback URL were unchanged.
- verification: The production authorization flow now returns through the selected canonical callback without GitHub's `redirect_uri` rejection. A separate Dashboard authorization gap remained because the matching database user had role `user`; the unique GitHub account row was then promoted to `admin` after a selected-target D1 preflight and single-row confirmation. Production Dashboard and Viewer acceptance subsequently passed for the controlled Phase 13 batch.
- files_changed: []
