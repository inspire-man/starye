---
phase: 28-chapter-image-availability-gateway-acceptance
mode: standard
---

# Phase 28 Context

## Goal

Make chapter page availability an authoritative, revision-bound fact and prove that the Dashboard, D1 readback, crawler result and Reader consume the same fresh tuple.

## Constraints

- Reuse crawler task/run/attempt/lease/provider and signed callback boundaries from Phases 25-27.
- Keep chapter image URLs external; persist only bounded, redacted evidence and projections.
- HTTP 200 is not sufficient: content type, redirect, HTML/challenge and bounded body sniffing must participate in the result.
- Canonical local acceptance uses `http://localhost:8080/...`.

## Out of scope

- Copying chapter images into R2.
- Introducing a second scheduler or changing the public Reader URL contract.
- Reworking video availability semantics.
