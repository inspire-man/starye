# Phase 26: Video Source And Magnet Availability - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md; this log preserves the alternatives considered.

**Date:** 2026-08-12
**Phase:** 26-video-source-and-magnet-availability
**Areas discussed:** Availability status hierarchy, Direct source classification, Magnet and TorrServer classification, Recheck and repair experience

---

## Availability Status Hierarchy

| Decision | Selected | Alternatives considered |
|----------|----------|-------------------------|
| Layer presentation | Always display metadata, direct, magnet, and playback separately | Overall state with error expansion; worst state only |
| Multiple sources | Best result plus available/abnormal counts | Worst result; unaggregated full list |
| Expired observation | Preserve result and mark `stale` | Downgrade to unknown; weak time hint only |
| Overall status | Playback readiness is primary | Worst state across layers; no overall state |

**User's choice:** Recommended option 1 for all four questions.
**Notes:** Independent facts remain visible even when a compact overall summary exists.

---

## Direct Source Classification

| Decision | Selected | Alternatives considered |
|----------|----------|-------------------------|
| Probe chain | URL, bounded HTTP/redirect, Range, conditional browser | Browser every time; HTTP/Range only |
| Available evidence | Successful response plus media type or bounded byte evidence | Any 2xx; require 206 |
| Challenge handling | `blocked`, browser-confirmed upgrade | Generic uncertain; immediate failure |
| Infrastructure errors | `uncertain`, preserve last determinate result | Immediate failure; unbounded retry |

**User's choice:** Recommended option 1 for all four questions.
**Notes:** Browser probing is escalation evidence, not the default transport path.

---

## Magnet And TorrServer Classification

| Decision | Selected | Alternatives considered |
|----------|----------|-------------------------|
| Availability layers | Syntax, metadata, peer/download, stream, playback remain separate | Metadata means available; peer means available |
| No progress | `no_peer` or `stalled` | Failed; generic uncertain |
| Generated stream | `stream_ready`, separate from `playback_ready` | Immediately playback-ready; uncertain |
| Provider errors | Specific provider failure, not content failure | Magnet failed; generic uncertain |

**User's choice:** Recommended option 1 for all four questions.
**Notes:** Actual player consumption is required for playback readiness.

---

## Recheck And Repair Experience

| Decision | Selected | Alternatives considered |
|----------|----------|-------------------------|
| Primary action | One reason-specific recommended action | Always show both actions; recheck only |
| Task feedback | Inline receipt and queued/running/readback stages | Immediate success; separate task page |
| Old revision result | History only; do not update current | Update current; discard result |
| Evidence display | Summary first with bounded expandable detail | Fully expanded; state and time only |

**User's choice:** Recommended option 1 for all four questions.
**Notes:** Projection promotion requires same-revision authoritative readback.

## Agent Discretion

- Exact bounded probe-policy constants and internal component composition.

## Deferred Ideas

None.
