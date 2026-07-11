# Phase 6: Storage Policy Audit - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-11
**Phase:** 6-Storage Policy Audit
**Areas discussed:** R2 allowed and forbidden boundaries, Current upload entry inventory scope, R2 dry-run audit report shape, Storage naming and documentation semantics

---

## R2 allowed and forbidden boundaries

| Question | Selected | Alternatives considered |
|----------|----------|-------------------------|
| How should `mappings/` crawler mapping files be classified? | Restricted allowed item | Normal allowed item; forbid new R2 mapping files; other |
| How should `tmp/`, `crawler-debug/`, and `import-staging/` be classified? | Short-term allowed with mandatory lifecycle | Forbidden by default; allowed with warnings only; other |
| How should historical generic `images/` be handled? | Historical risk pending classification | Temporarily continue as allowed; immediately forbidden prefix; other |
| How strict should the storage policy boundary be? | Explicit allowlist; unlisted means forbidden or separately approved | Category allowlist; audit vocabulary only; other |

**User's choice:** The user selected the recommended explicit-boundary option for all four questions.
**Notes:** `mappings/` is allowed only with backup/growth controls. Temporary/debug/import prefixes require retention and audit rules. `images/` is historical risk, not a future-purpose prefix.

---

## Current upload entry inventory scope

| Question | Selected | Alternatives considered |
|----------|----------|-------------------------|
| How deep should Phase 6 inventory R2 upload entries? | Entry plus direct callers plus produced prefixes | Full call-chain trace; entry files only; other |
| Should historical docs that declare R2 usage be included? | Include as documentation-declared entries | Code only; record document list only; other |
| How should one-off, verification, and backfill scripts be included? | Include all scripts with runnable-risk classification | Only real-R2 scripts; leave scripts for Phase 10; other |
| Should chapter body image paths that must not upload to R2 be listed? | Include as non-upload boundaries | Only actual R2 write entries; leave for Phase 7; other |

**User's choice:** The user selected the recommended inventory scope for all four questions.
**Notes:** The inventory should be detailed enough to guide Phase 8/10 without becoming a full execution-flow rewrite.

---

## R2 dry-run audit report shape

| Question | Selected | Alternatives considered |
|----------|----------|-------------------------|
| Who should the dry-run audit artifact primarily serve? | Human-readable first plus JSON/CSV details | Machine-first JSON/CSV; Markdown only; other |
| What minimum fields should each prefix/object group include? | Complete risk fields | Cost fields first; deletion-safety fields first; other |
| How should audit risk levels be defined? | Deletion risk plus cost risk dual axis | Single risk level; action-only classes; other |
| May Phase 6 delete any R2 objects? | No deletion in Phase 6 | Delete obvious test objects; delete dry-run-safe objects; other |

**User's choice:** The user selected the recommended dry-run report shape for all four questions.
**Notes:** The report should support human approval first, then later automation. Phase 6 remains audit-only.

---

## Storage naming and documentation semantics

| Question | Selected | Alternatives considered |
|----------|----------|-------------------------|
| What naming semantics should docs and code use for image URL sources? | Name by source | Keep existing fields and explain in docs; name by business role; other |
| How should existing `chapter.pages.image_url` and API `images: string[]` be recorded? | Historical fields with source/external URL semantics | Require Phase 7 DB/API rename; keep current behavior without note; other |
| How should `url` and `key` be constrained for R2 assets? | R2 assets require key plus public URL | URL primary and key optional; key only; other |
| Should docs explicitly split storage, proxying, and caching terminology? | Split storage, proxying, and caching terminology | Only forbid Worker proxying; reuse research wording; other |

**User's choice:** The user selected the recommended naming and terminology option for all four questions.
**Notes:** Existing names can remain for now only when the context explicitly locks their source/external URL semantics.

---

## the agent's Discretion

None.

## Deferred Ideas

None.
