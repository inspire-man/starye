---
name: starye-db-migration
description: Safely manage Drizzle schema changes, relations, and Cloudflare D1 migrations for Starye.
metadata:
  author: AI
  version: "1.0"
---

# Starye D1 Migration Wizard

When the user requests a database structure change (adding/modifying tables, columns, indexes), execute this precise order of operations to avoid breaking the Monorepo.

## 1. Schema Editing (`packages/db/src/schema.ts`)

- Write the new Drizzle schema definitions.
- **CRITICAL**: If you add foreign keys or join tables, you MUST add or update the `relations()` definitions at the bottom of the file to guarantee Dizzle ORM resolves Nested Includes cleanly.

## 2. Generate Migration

- Run `pnpm --filter @starye/db drizzle-kit generate` to create the `.sql` migration file.

## 3. Apply Local D1 Migration

- Cloudflare `wrangler` requires executing within the project scope bound to `wrangler.toml`.
- **Command**: `cd apps/api && pnpx wrangler d1 migrations apply starye-db --local`

## 4. Sync Monorepo Types

- Database schemas heavily dictate API and UI typings.
- **Command**: `pnpm --filter @starye/api-types run build`
- Finally, run `pnpm --filter api type-check` to catch any schema regressions.
