## Purpose

把投资分享中的可复用判断沉淀为带来源、带数据状态、可逐步实现的量化因子知识层，让中长线用户能理解当前评分、识别证据缺口，并持续扩展观察池。

## ADDED Requirements

### Requirement: Source-backed investment knowledge catalog

Quant knowledge API MUST return a versioned catalog of the supplied investment sources. Every source MUST include a stable id, title, URL, publication date when readable, and access status. A source whose full body is behind a paywall MUST be marked as preview-only and the system MUST expose only its public metadata and observed summary.

#### Scenario: Read the seven supplied sources

- **WHEN** an authenticated Quant user requests the knowledge catalog
- **THEN** the response includes seven source records with stable URLs, readable titles, and an access status that distinguishes full public text from preview-only content

#### Scenario: Source metadata is incomplete

- **WHEN** a source date or title cannot be read from the page
- **THEN** the response preserves the URL, uses a null field for the missing metadata, and keeps the source visible for later review

### Requirement: Explainable factor hypothesis library

The catalog MUST return factor hypotheses derived from the sources. Each factor MUST declare a category, plain-language interpretation, formula or measurement direction, required data fields, current implementation status, and linked source ids. Only factors with verified fields MUST be marked active and eligible for the current value-quality score; partial or planned factors MUST remain explanatory until their data contract is implemented.

#### Scenario: Show current and future factors

- **WHEN** a user opens the factor framework
- **THEN** the UI distinguishes active factors such as relative valuation, earnings quality, growth stability, and long-term trend from partial or planned factors such as capital-expenditure coverage, dividend quality, industry cycle sensitivity, and expectation gap

#### Scenario: Explain a data gap

- **WHEN** a factor requires order backlog, capex, dividend, industry, commodity, or consensus data that the current provider does not return
- **THEN** the factor shows the missing fields and a readable reason, and its status remains partial or planned instead of contributing an inferred score

### Requirement: Alias mapping and watchlist seed

The knowledge catalog MUST expose article aliases with a normalized A-share code when the mapping is sufficiently clear, a confidence level, and a mapping note. Ambiguous aliases, Hong Kong listings, and entities without a current A-share data path MUST be marked context-only. The database seed MUST add the explicitly selected A-share research samples idempotently and MUST preserve a later user rename or deletion.

#### Scenario: Resolve article nicknames

- **WHEN** the user reviews aliases such as “变变/便便”“海控/海狗”“油油/海油” and “赵姨”
- **THEN** the catalog shows the proposed mappings to 特变电工、中远海控、中国海油和兆易创新 with their confidence and rationale

#### Scenario: Preserve watchlist changes

- **WHEN** the migration is applied more than once before completion, or a user renames/deletes a seeded stock after the migration has completed
- **THEN** no duplicate row is created, the edited name remains authoritative, and runtime watchlist reads do not reseed the row

### Requirement: Knowledge endpoint and workbench presentation

Quant MUST expose the knowledge catalog through the existing authenticated route boundary, and the selection workbench MUST present source count, factor status counts, active factor descriptions, planned data fields, and alias mappings without exposing provider credentials or operations diagnostics.

#### Scenario: Load knowledge independently

- **WHEN** the workbench loads the knowledge area and the value-quality endpoint is slow or unavailable
- **THEN** the knowledge area can still render its static catalog or a retryable state, while watchlist, technical signals, valuation, and financial areas keep their own state

#### Scenario: Narrow viewport knowledge view

- **WHEN** the workbench is viewed at 390px wide
- **THEN** factor cards and source/alias rows stack or scroll within their own region, the page has no horizontal overflow, and long URLs remain clipped with an accessible title
