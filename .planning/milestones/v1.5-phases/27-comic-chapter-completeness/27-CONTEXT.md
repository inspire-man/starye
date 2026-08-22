---
phase: 27-comic-chapter-completeness
mode: standard
---

# Phase 27 Context

## Goal

Make comic chapter completeness an authoritative, revision-bound fact that survives partial crawls and can drive a targeted repair.

## Constraints

- Reuse crawler task/run/attempt/lease/provider and signed callback boundaries.
- Keep source chapter rows and bounded findings auditable without storing unbounded provider responses.
- Preserve the existing public Reader URL contract and external image storage policy.
- Canonical local acceptance uses `http://localhost:8080/...`.

## Out of scope

- Replacing the comic crawler strategy or moving chapter images into R2.
- Reworking historical video task snapshots.
- Adding a second background scheduler.
