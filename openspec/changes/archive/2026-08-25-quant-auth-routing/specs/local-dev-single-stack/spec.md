# local-dev-single-stack Specification

## ADDED Requirements

### Requirement: Fixed-port preflight

The local development supervisor MUST check every fixed application port before starting any child service. If one or more fixed ports are already listening, the supervisor MUST fail before starting a new service and MUST report the occupied ports so the operator can clean the old stack. The supervisor MUST NOT report `ready` merely because an unrelated process is listening on the expected ports.

#### Scenario: Start with a clean port set

- **WHEN** all fixed application ports are available
- **THEN** the supervisor starts all eight application services and can return `ready`

#### Scenario: Reject an occupied fixed port

- **WHEN** a fixed application port is already listening before startup
- **THEN** the supervisor returns `failed`, reports the occupied service and port, and does not call `startService`

### Requirement: Cleanup on preflight failure

When fixed-port preflight fails after temporary deployment inputs have been materialized, the supervisor MUST clean those temporary inputs and return a failed result. The supervisor MUST NOT terminate a process that was not started by the current supervisor invocation.

#### Scenario: Preserve the existing listener

- **WHEN** preflight detects an existing listener
- **THEN** the supervisor cleans its own temporary inputs and leaves the existing listener untouched
