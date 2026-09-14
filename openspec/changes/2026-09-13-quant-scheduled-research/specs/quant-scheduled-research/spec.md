## ADDED Requirements

### Requirement: Background scheduled research continues without the page
The API Worker scheduled handler MUST run Quant research automation for authenticated workspace owners even when the Quant page is closed. Each tick MUST process a bounded batch per user, persist run/item status in D1, and skip paused or excluded markers.

#### Scenario: Overdue watchlist item is refreshed in the background
- **WHEN** a user has a watchlist item whose reviewDate is before the Asia/Shanghai today date
- **AND** the Worker scheduled handler runs
- **THEN** the system MUST sync that item's daily bars, generate a deterministic research report, and persist the item stage
- **AND** a ready or partial report MUST advance reviewDate by 7 days
- **AND** the page does not need to stay open

#### Scenario: Batch and cooldown stay bounded
- **WHEN** a user has more than 3 due items
- **THEN** one scheduled tick MUST process at most 3 items
- **AND** remaining due items MUST continue on a later tick of the same or next run
- **AND** a completed user run MUST wait the configured cooldown before starting a new run

### Requirement: Data gaps stay explicit and actionable
Scheduled automation MUST treat stale or missing daily data and non-ready research reports as due reasons. Sync or generation failure MUST remain visible as data/research/ai stage errors. Missing values MUST stay missing.

#### Scenario: Stale daily data is synced then researched
- **WHEN** a watchlist item has no daily bars or the latest trade date is older than 7 Asia/Shanghai days
- **THEN** the scheduled job MUST run the existing daily sync for that code before generating a report
- **AND** a rejected or partial sync MUST mark the item as a data-stage error without fabricating bars

#### Scenario: Insufficient research remains a gap
- **WHEN** the latest research run is missing or not ready
- **THEN** the job MUST attempt to generate a deterministic report
- **AND** an insufficient_data or partial report MUST NOT be converted into a bullish or bearish recommendation
- **AND** reviewDate MUST advance after a ready or partial report when the due reasons include overdue or today
- **AND** reviewDate MUST NOT advance when the new report status is insufficient_data

### Requirement: AI remains advisory in scheduled runs
If the user has a ready AI configuration, the scheduled job MAY generate an AI summary after a deterministic report. AI failure MUST keep the deterministic report and MUST NOT hide the error. Missing AI configuration MUST skip AI and still complete the deterministic path.

#### Scenario: AI is not configured
- **WHEN** scheduled research generates a ready report and the user has no AI API key (unless provider is ollama)
- **THEN** the item aiStatus MUST be skipped
- **AND** a ready report still advances reviewDate

#### Scenario: AI generation fails
- **WHEN** scheduled research generates a ready report and AI summary throws
- **THEN** the item MUST keep the research run id
- **AND** aiStatus MUST be error with an error code
- **AND** a ready report still advances reviewDate because overdue refresh is about the deterministic report

### Requirement: Users can read back the latest scheduled run
Authenticated Quant users MUST be able to GET their latest scheduled research run and items. The response MUST be user-scoped. Overview MUST show status, counts, and per-item stage without turning them into trading advice.

#### Scenario: Latest run is returned to the owner
- **WHEN** an authenticated user requests GET /api/quant/research/schedule
- **THEN** the API MUST return that user's latest run and items, or null when none exist
- **AND** another user MUST NOT receive those rows
