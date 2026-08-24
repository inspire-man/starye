## ADDED Requirements

### Requirement: Independent research marker storage

Quant research markers MUST be stored in an independent `quant_research_marker` table with a unique `ts_code`, status, nullable note, nullable review date, and update timestamps. The table MUST NOT change the existing daily bar or candidate snapshot records.

#### Scenario: Migration creates marker storage

- **WHEN** migration `0039_quant_research_marker.sql` is applied
- **THEN** the marker table and its status/code indexes exist
- **AND** one `ts_code` cannot have two marker rows

#### Scenario: Repeated upsert

- **WHEN** the same stock marker is saved repeatedly
- **THEN** one row remains for that code with the latest status, note, review date, and updated timestamp
