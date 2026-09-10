## Purpose

让 AI 将已经核验的研究证据翻译成面向初学者的解释性摘要，并把摘要与具体研究运行绑定。

## ADDED Requirements

### Requirement: Evidence-grounded summary

The AI summary MUST be generated from one persisted Quant research report, MUST cite only keys present in that report's `evidence[]`, and MUST preserve the report's score, status and deterministic action as authoritative fields. The summary MUST NOT create a price target, return forecast, or direct buy/sell instruction.

#### Scenario: Generate summary with configured AI

- **WHEN** an authenticated user requests a summary for one of their research runs and has a usable AI configuration
- **THEN** the API sends a bounded evidence payload to the configured model, validates the structured response, persists the summary with provider/model/time and cited evidence keys, and returns it

#### Scenario: AI invents an evidence key

- **WHEN** the model response cites a key absent from the report
- **THEN** the API rejects the response as invalid and does not persist a summary

### Requirement: User and run isolation

Summary reads and writes MUST be scoped by the current `user.id` and research run id. A user MUST NOT read or generate a summary for another user's run.

#### Scenario: Cross-user summary request

- **WHEN** user B submits a run id owned by user A
- **THEN** the API returns a structured not-found response and performs no AI request

### Requirement: Honest unavailable states

The summary API MUST distinguish missing AI configuration, missing API key, upstream timeout/failure and invalid model output. The UI MUST display these states without hiding the deterministic report.

#### Scenario: AI service unavailable

- **WHEN** the configured model endpoint times out or returns an invalid response
- **THEN** the API returns a classified error, stores no summary, and the report remains available for manual review
