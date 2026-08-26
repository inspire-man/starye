# quant-authenticated-entry Specification

## ADDED Requirements

### Requirement: Logged-in Quant entry

Gateway MUST allow any valid logged-in session to reach `/quant/` and `/quant/*`, while anonymous requests MUST still redirect to `/auth/login` with the original Quant path in `next`. The existing Dashboard administrator check MUST remain unchanged.

#### Scenario: Ordinary user opens Quant

- **WHEN** a valid non-admin session requests `/quant/`
- **THEN** Gateway proxies the request to the configured Quant origin and does not redirect to Blog or `/blog/quant/`

#### Scenario: Anonymous user preserves return path

- **WHEN** an anonymous client requests `/quant/?view=candidates`
- **THEN** Gateway returns 302 to `/auth/login?next=%2Fquant%2F%3Fview%3Dcandidates`

### Requirement: API route user context

The Quant API MUST require an authenticated session, MUST make the resolved user available to the route context, and MUST not require an administrator role for Quant workspace operations.

#### Scenario: Ordinary user calls Quant API

- **WHEN** a logged-in user calls `/api/quant/watchlist`
- **THEN** the route returns only that user's workspace with status 200
