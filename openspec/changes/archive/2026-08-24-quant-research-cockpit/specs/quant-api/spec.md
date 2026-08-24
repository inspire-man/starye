## ADDED Requirements

### Requirement: Research marker API

Quant API MUST expose authenticated research marker read and upsert endpoints under `/api/quant`. The upsert endpoint MUST validate the four research statuses and MUST only accept codes currently present in the watchlist.

#### Scenario: Read watchlist markers

- **WHEN** an administrator requests `GET /api/quant/research`
- **THEN** the API returns one marker per watchlist code
- **AND** a code without a stored marker is returned as `unreviewed`

#### Scenario: Upsert a marker

- **WHEN** an administrator sends `PUT /api/quant/research/:tsCode` with a valid status, note, and optional review date
- **THEN** the API returns the persisted marker
- **AND** repeating the request updates the same marker instead of creating another row

#### Scenario: Reject an unknown code

- **WHEN** an administrator updates a code outside the watchlist
- **THEN** the API returns `404 QUANT_NOT_FOUND`
- **AND** no research marker row is written
