# Phase 13: Full Chain Data Smoke - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-16
**Phase:** 13-full-chain-data-smoke
**Areas discussed:** Smoke item and ingest boundary, local-first execution order, cross-surface proof, remote checkpoint and evidence

---

## Smoke Item And Ingest Boundary

| Option | Description | Selected |
|--------|-------------|----------|
| Deterministic namespaced smoke item | Use one target/run-scoped fixture identity and record its resulting business/DB ID. | ✓ |
| Random existing content | Select whatever content is already available at run time. | |
| Full crawler corpus | Use the complete crawler collection as the smoke source. | |

**User's choice:** Recommended option auto-selected under explicit authorization: deterministic namespaced item plus targeted crawler/fixture only.
**Notes:** A full crawler corpus is outside the release gate; the item must remain minimal, repeatable and traceable through every surface.

---

## Local-First Execution Order

| Option | Description | Selected |
|--------|-------------|----------|
| Local D1 then Gateway smoke | Verify local schema/minimal data, then use `http://localhost:8080/...` before production. | ✓ |
| Production first | Attempt provider-side smoke before local readiness is proven. | |
| Direct service ports as evidence | Treat development app ports as canonical browser evidence. | |

**User's choice:** Recommended option auto-selected under explicit authorization: local-first and Gateway-only canonical local evidence.
**Notes:** Direct ports remain diagnostics only; they cannot replace Gateway proof.

---

## Cross-Surface Proof

| Option | Description | Selected |
|--------|-------------|----------|
| Same item across all surfaces | Prove one item through D1/API, Dashboard management state and public viewer. | ✓ |
| API-only proof | Stop after ingest response and a database/API lookup. | |
| Independent sample per surface | Use unrelated items for admin and public checks. | |

**User's choice:** Recommended option auto-selected under explicit authorization: one item must remain identifiable across D1/API, Dashboard and viewer.
**Notes:** Production public verification uses only the selected target canonical domain.

---

## Remote Checkpoint And Evidence

| Option | Description | Selected |
|--------|-------------|----------|
| Fail closed with evidence | Require explicit target, preflight and ownership checks; record a checkpoint when credentials/provider access is absent. | ✓ |
| Simulated production pass | Use local output or placeholders as a production-success claim. | |
| Secret-rich logs | Capture raw credentials, endpoints or prepared context for debugging. | |

**User's choice:** Recommended option auto-selected under explicit authorization: fail closed, never simulate production success, and write non-secret repeatable evidence.
**Notes:** Real provider/data-chain execution belongs in Phase 13; final source-literal cleanup and RUNBOOK consolidation remain Phase 14.

---

## the agent's Discretion

- Choose the concrete artifact schema, minimal fixture payload and plan/wave split while preserving the locked selected-target, Gateway and fail-closed contracts.

## Deferred Ideas

- Phase 14 owns stable RUNBOOK finalization, old-domain/source-literal cleanup and final v1.2 evidence mapping.
