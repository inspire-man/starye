---
name: starye-db-migration
description: Design, generate, test, and verify Starye Drizzle schema changes and Cloudflare D1 migrations across the monorepo.
metadata:
  author: AI
  version: "2.0"
---

# Starye D1 Migration Workflow

Use this skill for changes to packages/db/src/schema.ts, packages/db/drizzle, D1 table/index shape, or a cross-layer contract that depends on persisted data.

## 1. Establish the contract

- Read the current schema, the latest relevant migration, and the migration test before editing.
- Keep table definitions, foreign keys, indexes, relations(), and inferred types aligned. Drizzle relations() describes query relationships; a foreign key and a relation solve different parts of the contract.
- For crawler task/run/attempt, receipt, observation, projection, chapter, or page changes, preserve revision, idempotency, and CAS predicates. Treat D1 as the authoritative readback source.
- Cross api/db/frontend contract work starts with the repository OpenSpec flow; a local schema patch alone does not close that contract.

## 2. Generate and inspect

    pnpm --filter @starye/db run generate

Review the generated SQL and Drizzle metadata. Keep existing migration filenames and history intact, inspect destructive statements, and add or update a focused migration test under packages/db/src/__tests__ when the shape or invariants change.

## 3. Apply locally

Run from apps/api, where the D1 binding is defined:

    pnpm exec wrangler d1 migrations apply starye-db --local
    pnpm exec wrangler d1 execute starye-db --local --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"

For a local database investigation, inspect the current Wrangler D1 state under apps/api/.wrangler/state/v3/d1/miniflare-D1DatabaseObject, then use PRAGMA table_info(TARGET_TABLE) and targeted queries. Schema introspection comes before data assumptions.

## 4. Verify consumers

- Run pnpm --filter @starye/db run type-check.
- When API route types or AppType depend on the change, run pnpm --filter @starye/api-types run build and pnpm --filter api run type-check.
- Run the focused migration, repository, and route tests. Add a Gateway request through http://localhost:8080 for user-visible behavior.
- For crawler work, compare the mutation response with the same-content D1 authoritative readback. For availability or repair work, also compare receipt, source revision, projection version, and content-integrity fields.

## Production boundary

Production backup, destructive-SQL review, remote apply, R2 backup, and recovery follow packages/db/MIGRATION.md, RUNBOOK.md, and .github/workflows/deploy-migrations.yml. Keep manual local verification separate from production evidence.
