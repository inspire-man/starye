## ADDED Requirements

### Requirement: Production Quant origin provisioning

Tracked deployment targets MUST declare a valid Quant frontend origin. Target-aware Gateway Wrangler configuration MUST emit `QUANT_ORIGIN` from that origin, and production `/quant/*` requests MUST proxy to it after stripping the `/quant` prefix.

#### Scenario: Configured production Quant origin

- **WHEN** the selected target has a deployed Quant origin
- **THEN** generated Gateway configuration contains `QUANT_ORIGIN` with that HTTPS origin
- **AND** `https://<gateway>/quant/` reaches the Quant frontend through the Gateway

#### Scenario: Missing production Quant origin

- **WHEN** a target profile does not declare a Quant origin
- **THEN** target-aware configuration generation fails closed before deployment
- **AND** Gateway does not silently fall back to another Pages application

