# Quant AI 历史会话导出

## ADDED Requirements

### Requirement: Selected historical sessions can be exported as Markdown

Quant MUST expose an export action in the selected historical session detail. The resulting Markdown MUST include the historical session metadata, candidate codes, saved briefing content, and saved questions using an explicit field allowlist.

#### Scenario: Export a complete historical session

- **GIVEN** a historical session is selected and contains a briefing and questions
- **WHEN** the user activates the export action
- **THEN** the browser downloads a Markdown file for that session
- **AND** the file includes the snapshot date, date range, scope key, candidate codes, briefing, questions, and citations
- **AND** the file excludes fields outside the session export allowlist

#### Scenario: Export a session with no saved AI content

- **GIVEN** a historical session is selected without a briefing or questions
- **WHEN** the user activates the export action
- **THEN** the browser downloads a Markdown file containing the session metadata
- **AND** the file explicitly records that no briefing or questions were saved

### Requirement: Selected historical sessions can be copied with explicit result states

Quant MUST expose a copy action in the selected historical session detail and MUST distinguish copied, unavailable clipboard, and failed clipboard-write states.

#### Scenario: Clipboard write succeeds

- **GIVEN** a selected historical session and a working browser clipboard
- **WHEN** the user activates copy
- **THEN** the serialized historical session is written to the clipboard
- **AND** the detail shows a success status

#### Scenario: Clipboard is unavailable or rejects the write

- **GIVEN** a selected historical session
- **AND** the browser has no usable clipboard or the write rejects
- **WHEN** the user activates copy
- **THEN** the detail shows a specific unavailable or failed status
- **AND** the historical session remains visible and can be retried

### Requirement: History export remains read-only and race-safe

Export and copy actions MUST NOT mutate the selected historical session or current deterministic candidate state. A stale asynchronous copy result MUST NOT update a newly selected session.

#### Scenario: Session changes while copying

- **GIVEN** copy is pending for historical session A
- **WHEN** the user selects historical session B or the scope resets
- **THEN** the pending result from session A is ignored
- **AND** session B's detail and status remain authoritative
