# quant-auth-routing Specification

## ADDED Requirements

### Requirement: Quant canonical entry

Gateway MUST normalize `/quant` to `/quant/` with a 301 response and MUST match `/quant/` and every `/quant/*` path before the Blog fallback.

#### Scenario: Normalize the Quant root

- **WHEN** a client requests `/quant`
- **THEN** Gateway returns 301 with `Location: /quant/`

#### Scenario: Route a Quant child path before Blog

- **WHEN** a client requests `/quant/` or `/quant/*`
- **THEN** Gateway evaluates the Quant route before the Blog fallback

### Requirement: Anonymous Quant access

For an anonymous request to `/quant/` or `/quant/*`, Gateway MUST return a 302 response whose `Location` path is `/auth/login` and whose `next` value contains the original Quant pathname and query string. The anonymous Quant route MUST NOT proxy the request to Blog or return a `/blog/quant/` redirect.

#### Scenario: Redirect an anonymous Quant root request

- **WHEN** an anonymous client requests `/quant/`
- **THEN** Gateway returns 302 to `/auth/login?next=%2Fquant%2F` and does not call the Quant or Blog upstream

#### Scenario: Preserve a Quant query string

- **WHEN** an anonymous client requests `/quant/?view=overview`
- **THEN** Gateway returns 302 to `/auth/login?next=%2Fquant%2F%3Fview%3Doverview`

### Requirement: OAuth return path

The Auth GitHub start route MUST normalize a same-origin `next` or `redirect` value into a relative pathname, query string, and hash before constructing the OAuth callback URL. The normalized callback URL for an authentication flow started from Quant MUST return to `/auth/login?next=%2Fquant%2F...`, so the authenticated login page can return the browser to Quant. External origins and malformed redirect values MUST normalize to `/`.

#### Scenario: Preserve the Quant OAuth return path

- **WHEN** the Auth GitHub start route receives `next=/quant/?view=overview` from the Gateway origin
- **THEN** it uses `/quant/?view=overview` as the normalized return path

#### Scenario: Reject an external OAuth return path

- **WHEN** the Auth GitHub start route receives `next=https://example.com/quant/`
- **THEN** it normalizes the return path to `/`

### Requirement: Authenticated Quant access

After a valid administrator session is present, Gateway MUST proxy `/quant/*` to the configured Quant service and MUST preserve the Quant path contract for local development.

#### Scenario: Proxy an authenticated local Quant request

- **WHEN** an administrator requests `/quant/watchlist` in local development
- **THEN** Gateway proxies the request to the local Quant service with the `/quant/watchlist` path preserved
