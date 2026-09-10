# Quant 工作台导航

## ADDED Requirements

### Requirement: 统一 Quant Header

Quant MUST display a sticky application header with the Starye Quant brand, four view navigation entries, current data date, and a refresh control.

#### Scenario: desktop header

- **WHEN** the viewport is at desktop width
- **THEN** the brand, four navigation entries, data date, and refresh control are visible in one compact header
- **AND** the active view is exposed with `aria-current="page"`

#### Scenario: mobile header

- **WHEN** the viewport is below the mobile navigation breakpoint
- **THEN** the brand and refresh control remain visible
- **AND** the view entries are available from an accessible menu button

### Requirement: hash view state

The Quant app MUST support `overview`, `candidates`, `watchlist`, and `knowledge` as hash-backed views.

#### Scenario: direct view entry

- **WHEN** the user opens `/quant/#candidates`
- **THEN** the candidate research view is shown
- **AND** the other three primary view sections are hidden

#### Scenario: invalid view

- **WHEN** the URL hash is missing or unknown
- **THEN** the app shows the overview view
- **AND** the URL is normalized to the overview hash after the app mounts

### Requirement: overview guidance

The overview MUST focus on statistical status, today focus, risk prompts, and clear next-step links; detailed watchlist, candidate table, and factor cards MUST remain in their dedicated views.

#### Scenario: next-step navigation

- **WHEN** the user selects a next-step card from the overview
- **THEN** the corresponding view opens without a full page reload
- **AND** existing selected-stock drawers remain available when opened from candidate or watchlist rows
