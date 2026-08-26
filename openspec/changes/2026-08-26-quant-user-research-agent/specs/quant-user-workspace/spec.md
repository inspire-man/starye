# quant-user-workspace Specification

## ADDED Requirements

### Requirement: User-owned Quant workspace

Quant MUST associate each watchlist item, research marker, scan snapshot, and sync state with the authenticated Better Auth `user.id`. A Quant request MUST query and mutate only rows owned by the current user. Daily bars MUST remain shared market facts keyed by `ts_code` and `trade_date`, and MUST NOT be duplicated per user.

#### Scenario: Two users see isolated watchlists

- **WHEN** user A adds `000001.SZ` and user B adds `600000.SH`
- **THEN** user A's watchlist and candidates contain only `000001.SZ`, and user B's contain only `600000.SH`

#### Scenario: User cannot mutate another user's marker

- **WHEN** a logged-in user updates a code that is absent from that user's watchlist
- **THEN** the API returns a structured not-found response and writes no marker

### Requirement: Shared market facts

Quant MUST use the shared daily-bar table as the single market fact store. A sync initiated by one user MAY upsert a bar already fetched for another user, while each user's snapshot and sync state MUST remain separate.

#### Scenario: Same daily bar is shared

- **WHEN** two users sync the same stock and date
- **THEN** the daily-bar table contains one identity row for that stock/date, while each user has an independent snapshot state

### Requirement: Starter workspace

When a user has no owned watchlist rows, Quant MUST create the configured starter set idempotently before returning the user workspace. Repeated reads MUST NOT duplicate rows or overwrite a user's later name edit.

#### Scenario: First Quant read provisions starters

- **WHEN** a new authenticated user opens Quant
- **THEN** the response contains the starter watchlist and a second read returns the same identities without additional rows
