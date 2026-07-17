---
status: investigating
trigger: Local GitHub login redirects the Phase 13 Dashboard observation to an Auth-internal 404 page.
created: 2026-07-17
updated: 2026-07-17
---

# Debug: Local GitHub Login Redirect

## Symptoms

- Expected behavior: from `http://localhost:8080/auth/login?next=%2Fdashboard%2Fmovies`, GitHub login returns to `http://localhost:8080/dashboard/movies` so the ordered Phase 13 Dashboard observation can be appended.
- Actual behavior: selecting `Login with GitHub` reaches an Auth application 404 for `/dashboard/movies`; the rendered request URL is `http://localhost:8080/auth/dashboard/movies` and its upstream host is `localhost:3003`.
- Error: `Page not found: /dashboard/movies` in the Auth application after the OAuth start link.
- Timeline: first observed after restarting local services and recreating the local D1 schema for the Phase 13 smoke retry.
- Reproduction: open the Gateway login URL above and select the sole `Login with GitHub` link.

## Current Focus

- hypothesis: Gateway/Auth OAuth callback preserves the Dashboard next path without removing the Auth route prefix.
- next_action: Trace the GitHub OAuth start/callback redirect path and identify the owner of next-path normalization.

## Evidence

- timestamp: 2026-07-17
  observation: Login page exposes `/auth/start/github?next=%2Fdashboard%2Fmovies`; post-login request reaches Auth as `/auth/dashboard/movies` and returns 404.
- timestamp: 2026-07-17
  observation: Phase 13 local smoke is `resolved_pending_observation` with the Dashboard surface intentionally unappended.

## Eliminated

- hypothesis: The local D1 schema is the immediate cause of the 404.
  evidence: All 28 local D1 migrations applied and the failure occurs in Auth route resolution after login start.

## Resolution

- root_cause:
- fix:
- verification:
- files_changed:
