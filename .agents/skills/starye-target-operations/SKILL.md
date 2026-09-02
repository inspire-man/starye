---
name: starye-target-operations
description: Operate Starye target profiles through explicit validation, local or CI preflight, prepared deployment/mutation entries, smoke verification, and target-scoped evidence.
metadata:
  author: AI
  version: "1.0"
---

# Starye Target Operations

Use this skill for target profile changes, local projection, preflight, Worker/Pages deploy, D1 migration entry, crawler entry, rollback preparation, data-chain smoke, or remote mutation.

## Read the boundary

- Read AGENTS.md, RUNBOOK.md, and .planning/STATE.md before an operation. For schema, crawler, or API changes also load the corresponding project skill and OpenSpec change.
- The implementation boundary is packages/config/src/deployment-target/, scripts/target-profile.ts, scripts/target-deploy.ts, scripts/target-remote-entry.ts, scripts/data-chain-smoke.ts, scripts/data-chain-handoff.ts, packages/db/scripts/target-d1-mutation.ts, and packages/crawler/scripts/target-crawl-mutation.ts.
- TargetProfile owns account, domain, Worker routes, Pages projects/origins, D1/R2/KV resources, local Wrangler profile, CI environment, and required-secret metadata. Versioned docs record metadata only, never secret values or raw credentials.

## Explicit target and preflight

1. Select a tracked target id. Use no default, production alias, domain, account name, or ambient environment identity as a substitute.
2. Validate the selected profile:

       pnpm target-profile validate --target <target-id>

3. For local configuration, check the managed projection and run the selected command preflight:

       pnpm target-profile project-local --target <target-id> --check
       pnpm target-profile preflight --target <target-id> --scope local --command <closed-command>

4. Local scope uses the resolved Wrangler profile and rejects a shadowing Cloudflare API token. CI/remote scope uses the matching GitHub environment, account id, credentials, and read-only live resource checks. Pages deploy or rollback always carries an explicit surface.
5. Preflight is a gate and a diagnostic result. It does not prove a deploy, mutation, smoke, persistence, or user-visible outcome.

## Prepared execution

- Deploy through the target-aware entry so profile resolution, projected environment, Pages surface, build inputs, redirects, and cleanup stay bound:

       pnpm target-deploy -- --target <target-id> --app <app> [--surface <surface>]

- Remote or CI operations use a closed entry and a prepared context. The child command, secret allowlist, target, run id, and run directory are validated before execution:

       pnpm target-remote-entry --target <target-id> --entry <closed-entry>

- For workflow preparation, use target-profile prepare-mutation and then target-profile run-prepared-entry with the generated context. Do not compose an arbitrary remote shell command or copy resource identities from RUNBOOK.
- D1 backup/reviewer/apply/recovery remains governed by RUNBOOK.md. Crawler source/parser behavior remains governed by starye-crawler-strategy.

## Data-chain smoke and evidence

Use one mode/target/run tuple for execution and verification:

       pnpm smoke:data-chain -- --mode <mode> --target <target-id> --run-id <run-id>
       pnpm smoke:data-chain:verify -- --mode <mode> --target <target-id> --run-id <run-id>
       pnpm smoke:data-chain:handoff -- --mode <mode> --target <target-id> --run-id <run-id>

- Only passed is a completed smoke result. Failed, checkpoint, pending, missing artifacts, or tuple mismatch preserve current evidence and stop the next mutation.
- Evidence keeps local contract, credentialed provider, transport, content, persistence, receipt, readback, and actual consumer signals separate. A provider callback or HTTP 200 alone is not a completed chain.
- Record target, mode, run id, attempt, command, timestamp, canonical Gateway URL, and redacted result fields. Keep tokens, cookies, JWTs, raw callback payloads, and secret-bearing environment output out of artifacts.
- User-visible acceptance uses the canonical Gateway at http://localhost:8080/...; direct application ports support diagnosis only.

## Verification

Run focused tests under packages/config, packages/db/scripts, packages/crawler/scripts, and scripts before broader type-check/lint. For any code symbol change, run GitNexus upstream impact analysis first; before commit, run GitNexus detect_changes and review affected flows.
