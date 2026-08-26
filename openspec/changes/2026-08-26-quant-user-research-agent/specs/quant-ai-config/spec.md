# quant-ai-config Specification

## ADDED Requirements

### Requirement: User-scoped AI configuration

The system MUST store at most one active Quant AI configuration per authenticated user. The configuration MUST include provider, model, optional base URL, and an API key state. Reads and writes MUST be scoped by the current user's `user.id` and MUST NOT accept a user id from the request body.

#### Scenario: User reads only their configuration

- **WHEN** a user requests the Quant AI configuration
- **THEN** the API returns that user's metadata or `null`, without returning another user's configuration

#### Scenario: Updating metadata preserves an existing key

- **WHEN** a user updates provider/model/base URL without sending a new API key
- **THEN** the existing encrypted key remains active and the response reports `hasApiKey: true`

### Requirement: Secret handling

The system MUST encrypt a user API key with Web Crypto AES-GCM before persistence and MUST never return the encrypted value or plaintext in an API response. A save request containing a new API key MUST fail with a structured configuration error when `QUANT_AI_ENCRYPTION_KEY` is absent.

#### Scenario: API key is redacted

- **WHEN** a configured user reads or saves AI settings
- **THEN** the response contains only `hasApiKey` and an optional last-four-character hint, and contains no key field

#### Scenario: Missing encryption secret fails closed

- **WHEN** a user submits a new API key without the Worker encryption secret
- **THEN** the API returns a 503 configuration error and does not create a plaintext configuration row

### Requirement: User-facing settings

Quant MUST expose an accessible header settings control that opens a drawer for provider, model, base URL, API key replacement, and API key removal. Loading, saving, validation, and error states MUST be visible without exposing the secret.

#### Scenario: Replace or clear a key

- **WHEN** a user submits a replacement key or explicitly selects clear key
- **THEN** the drawer reflects the persisted `hasApiKey` state after the API response
