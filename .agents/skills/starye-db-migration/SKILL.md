---
name: starye-db-migration
description: Design, generate, test, and verify Starye Drizzle schema changes and Cloudflare D1 migrations across the monorepo.
metadata:
  author: AI
  version: "2.1"
---

# Starye D1 Migration Workflow

Use this skill for packages/db/src/schema.ts, packages/db/drizzle, D1 table/index shape, relations, or a cross-layer contract that depends on persisted data.

## Establish the contract

- Read the current schema, the newest relevant migration, migration tests, packages/db/MIGRATION.md, and the applicable OpenSpec change before editing.
- Keep table definitions, foreign keys, indexes, relations(), and inferred types aligned. Drizzle relations describe query relationships; foreign keys enforce a different part of the contract.
- For crawler task/run/attempt, receipt, observation, projection, chapter, page, or Quant changes, preserve revision, idempotency, user/target scope, and CAS predicates. Treat D1 as the authoritative readback source.
- Quant workspace rows are scoped by the authenticated user id while quant_daily_bar is shared by stock code and trade date. Keep this distinction in repository queries, migrations, and tests.
- Target-aware apply, remote credentials, prepared entries, and production evidence follow starye-target-operations and RUNBOOK.md.

## Generate and inspect

    pnpm --filter @starye/db run generate

Review generated SQL and Drizzle metadata. Keep existing migration filenames and history intact, inspect destructive statements, and add or update a focused test under packages/db/src/__tests__ when shape or invariants change.

## Apply locally

Run from apps/api, where the D1 binding is defined:

    pnpm exec wrangler d1 migrations apply starye-db --local
    pnpm exec wrangler d1 execute starye-db --local --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"

For local investigation, inspect apps/api/.wrangler/state/v3/d1/miniflare-D1DatabaseObject, then use PRAGMA table_info(TARGET_TABLE) and targeted queries. Schema introspection precedes data assumptions.

## Verify consumers

- Run pnpm --filter @starye/db run type-check.
- When API route types or AppType depend on the change, run pnpm --filter @starye/api-types run build and pnpm --filter api run type-check.
- Run focused migration, repository, and route tests. Add a request through http://localhost:8080 for user-visible behavior.
- Compare mutation response with the same-content D1 readback. For availability, repair, or research evidence work, also compare receipt, source revision, projection version, user scope, and content-integrity fields.
- Production migration requires the RUNBOOK backup, destructive-SQL review, remote apply, and recovery gates. Local checks remain separate from production evidence.

Before editing a shared code symbol, use GitNexus upstream impact analysis. Before committing, run GitNexus detect_changes with an explicit staged file allowlist.
