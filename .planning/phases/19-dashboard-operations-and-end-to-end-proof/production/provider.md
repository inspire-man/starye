# Phase 19 Production Provider Evidence

Status: `checkpoint`

The selected server-owned tuple remains `starye-org` / `movie` / `.github/workflows/daily-movie-crawl.yml` / `inspire-man/starye@main` / Environment `starye-org`.

Metadata-only preflight is now complete: the GitHub App is installed for only `inspire-man/starye`, with `Actions: write` and `Metadata: read`; the six Worker App/provider binding names and the existing `starye-org` Environment secret names are present. A local App-JWT health check returned `200` for App metadata, `201` for the installation token, and `200` for both the fixed repository and movie workflow. The Worker private key was converted from PKCS#1 to PKCS#8 before it was written; no key, token, JWT, cookie, authentication header, or raw callback is recorded here.

The prior frozen movie attempt 2 is task `ad4c5c92-e8ea-4ea2-905a-27732e6534f4`, D1 run `003b988b-2c20-4536-b50c-ab8d539b109e`, and provider run `30828849370`. GitHub reports that provider run as `completed` with conclusion `failure`, but the D1 run is still `cancel_requested` and its provider association remains `in_progress`; its reconciliation window elapsed before the newly configured App binding could be used. The Worker log tail connection timed out and the prior diagnostic endpoint now returns `404`, so no current Worker-side reconciliation observation was recorded.

This checkpoint deliberately does not create or reuse a task. Wait for the existing scheduled reconciliation to move the frozen attempt to a D1 terminal state, then create exactly one new movie task and replace this checkpoint only after its provider association, signed callbacks, validated receipt, and existing-editor CRUD readback/restore are observed.

Required sign-off fields:

- GitHub App metadata, installation permissions, and existing secret-name presence.
- D1 task/run/attempt plus provider run/attempt/SHA/URL.
- Signed callback event IDs and nonces, validated `primaryContentId` receipt.
- Existing editor mutation, readback, and restore results.

The checkpoint is intentionally not a provider success and does not authorize a retry of the same attempt.
