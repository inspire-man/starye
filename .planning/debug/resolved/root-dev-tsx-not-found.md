---
status: resolved
trigger: "根目录执行 pnpm dev 报错 Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'tsx' imported from D:\\my-workspace\\starye\\packages\\crawler\\"
created: 2026-07-18
updated: 2026-07-18
---

# Debug: Root Dev Cannot Resolve tsx

## Symptoms

- Expected behavior: Running `pnpm dev` from the repository root starts the local development environment.
- Actual behavior: Node exits while resolving the `tsx` import from `packages/crawler`.
- Error message: `Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'tsx' imported from D:\my-workspace\starye\packages\crawler\`
- Timeline: Not provided.
- Reproduction: Run `pnpm dev` from the repository root.

## Current Focus

- hypothesis: The crawler manifest and lockfile declare `tsx`, but the local `node_modules` installation is missing the crawler package link.
- test: Check the package manifest, lockfile importer, pnpm store, and `packages/crawler/node_modules/tsx`, then reinstall from the frozen lockfile.
- expecting: The store contains `tsx@4.21.0`, the crawler link is initially absent, and a frozen reinstall restores it without changing source or lockfile state.
- next_action: Resolved; keep the verified local development process running through Gateway.

## Evidence

- timestamp: 2026-07-18
  observation: `packages/crawler/package.json` declares `tsx` as a dev dependency and the crawler importer in `pnpm-lock.yaml` resolves it to `4.21.0`.
- timestamp: 2026-07-18
  observation: `node_modules/.pnpm/tsx@4.21.0` existed, but `packages/crawler/node_modules/tsx` did not.
- timestamp: 2026-07-18
  observation: The exact filtered Node command reproduced `ERR_MODULE_NOT_FOUND` before executing `scripts/local-dev.ts`.
- timestamp: 2026-07-18
  observation: `pnpm install --frozen-lockfile --offline` restored the crawler dependency link and completed all workspace lifecycle scripts successfully.
- timestamp: 2026-07-18
  observation: The isolated loader check printed `tsx-loader-ok`; root `pnpm dev` then started the local services and Gateway returned `301` from `http://localhost:8080/` to `/blog/`.

## Eliminated

- hypothesis: The crawler package forgot to declare `tsx`.
  evidence: Both its manifest and lockfile importer contain the direct `tsx@4.21.0` dev dependency.
- hypothesis: The root dev script resolves `tsx` from the wrong package by design.
  evidence: The script intentionally runs under the crawler package, which owns the direct loader dependency; restoring the expected pnpm link made the same command succeed.

## Resolution

- root_cause: The local pnpm installation was incomplete: the content-addressed store contained `tsx@4.21.0`, but the direct dependency link under `packages/crawler/node_modules` was missing, so Node could not resolve the loader from the crawler execution context.
- fix: Re-linked workspace dependencies with `pnpm install --frozen-lockfile --offline`; no package declaration or application code change was required.
- verification: Frozen install completed, the crawler loader probe passed, the real root `pnpm dev` process started all services, and the canonical Gateway responded on `http://localhost:8080/`.
- files_changed: .planning/debug/root-dev-tsx-not-found.md
