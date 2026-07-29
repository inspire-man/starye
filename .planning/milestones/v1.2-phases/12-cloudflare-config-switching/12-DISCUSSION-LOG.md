# Phase 12: Cloudflare Config Switching - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-15
**Phase:** 12-cloudflare-config-switching
**Areas discussed:** target-aware deploy configuration, browser public runtime contract, CI target and secret selection, remote mutation and rollback boundaries

---

## Target-Aware Deploy Configuration

| Option | Description | Selected |
|--------|-------------|----------|
| Per-command target projection | Resolve the explicit profile, then materialize the non-secret config and command arguments only for that operation. | ✓ |
| Permanent Wrangler environment blocks | Duplicate each target in checked-in `[env.<target>]` config sections. | |
| Hybrid target sources | Retain fixed target fragments and generate the rest. | |

**User's choice:** Auto-selected recommended default.
**Notes:** A single `TargetProfile` remains the source of truth; duplicated static target identity creates an avoidable drift path.

---

## Browser Public Runtime Contract

| Option | Description | Selected |
|--------|-------------|----------|
| Typed allowlisted public contract | Project only target id, canonical gateway/API bases and app paths; validate all public keys. | ✓ |
| Per-app ad hoc public env parsing | Let each Vite/Nuxt app retain its own fallback chain. | |
| Public config service discovery | Expose individual Worker/Pages origins to browsers. | |

**User's choice:** Auto-selected recommended default.
**Notes:** Browser values are public, so safe handling requires a small allowlist and canonical gateway/API routing rather than obscurity.

---

## CI Target And Secret Selection

| Option | Description | Selected |
|--------|-------------|----------|
| Explicit target mapped to GitHub Environment | Workflows resolve target first, bind its one Environment, then consume standard secret names. | ✓ |
| Target-suffixed repository secrets | Workflows compose secret names from target input. | |
| Implicit repository-wide target | Keep current unqualified secrets and infer the target. | |

**User's choice:** Auto-selected recommended default.
**Notes:** Environment mapping preserves the Phase 11 local-vs-CI identity split and prevents dispatch inputs from selecting arbitrary secret bundles.

---

## Remote Mutation And Rollback Boundaries

| Option | Description | Selected |
|--------|-------------|----------|
| Preflight plus read-only live checks | Block every remote mutation until target, Environment, credentials, account and resources agree. | ✓ |
| Static config validation only | Skip remote resource checks before mutation. | |
| Warning-only mismatch handling | Record mismatches but allow operation continuation. | |

**User's choice:** Auto-selected recommended default.
**Notes:** Worker rollback must prove target ownership; Pages rollback remains explicitly manual and fail-closed.

---

## the agent's Discretion

- The concrete projection/module layout, workflow helper composition and public-config adapter implementation may follow existing TypeScript and GitHub Actions patterns while preserving the locked contracts.

## Deferred Ideas

- Phase 13 owns end-to-end selected-target data smoke and verification evidence.
- Phase 14 owns broad old-domain cleanup, RUNBOOK finalization and final requirement traceability.
