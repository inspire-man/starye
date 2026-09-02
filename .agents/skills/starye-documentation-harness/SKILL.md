---
name: starye-documentation-harness
description: Audit, slim, move, archive, synchronize, and validate Starye documentation and maintenance scripts using canonical owners and generated-index integrity checks.
metadata:
  author: AI
  version: "1.0"
---

# Starye Documentation Harness

Use this skill for documentation cleanup, stale-document review, script retirement, docs migration, external reference sync, or changes to documentation navigation and integrity checks.

## Establish ownership

- Read AGENTS.md, docs/README.md, and docs/documentation-ownership.md before moving or editing a document.
- Stable human entry and startup belong to README.md; architecture to ARCHITECTURE.md; operations and storage policy to RUNBOOK.md; agent rules to AGENTS.md; current milestone and evidence to .planning/; specs and active cross-layer changes to openspec/.
- Long-lived topic material belongs in docs/design-docs/ or docs/guides/. External framework material belongs in docs/references/. Generated indexes belong in docs/generated/. Historical or superseded material belongs in docs/archive/.
- Update one canonical owner and repair its links. Repeated copies of the same procedure are a defect.

## Audit before removal

1. Search references, package scripts, CI workflows, and executable imports with rg before deleting a document or script.
2. Classify each candidate as live owner, supporting guide, generated artifact, phase evidence, historical archive, or obsolete path. A date in a filename is evidence to inspect, not a deletion rule.
3. Retire a script only after its package.json entry, workflow call, docs links, and imports are accounted for. Preserve replacement commands in the owning document.
4. Archived files start with Status and Replaced by metadata. Archive material remains traceable and is not a live operational instruction.

## Managed references and generated files

- scripts/docs-sources.json is the manifest for managed official references.
- pnpm docs:sync downloads changed references and regenerates metadata and section indexes.
- Do not hand-edit docs/references/frameworks/*/llms.txt, .version, docs/generated/_meta.json, or docs/generated/_sections.json.
- docs/references/unmanaged/ is outside the managed index and should remain clearly labeled as non-current or pending adoption.

## Validation

Run the smallest relevant command after each class of change:

    pnpm docs:check
    pnpm docs:meta
    pnpm docs:index
    git diff --check

docs:check verifies the manifest, source hashes and sizes, generated paths, and live Markdown links. Its scan intentionally excludes docs/archive/, docs/references/, docs/generated/, and crawler examples; inspect those links directly when touching excluded material.

For a cleanup that changes executable behavior, also run the affected package tests, type-check, lint, and the CI path that calls the script. Preserve unrelated worktree changes and use an explicit staging allowlist for review.
