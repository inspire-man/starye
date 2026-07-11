---
phase: 05-migration
plan: 01
subsystem: deploy-rollback-baseline
tags: [deploy, rollback, wrangler, github-actions]
requirements-completed:
  - DEPLOY-01
  - DEPLOY-02
  - DEPLOY-06
completed: 2026-05-13
---

# Phase 5 Plan 01 Summary

## Accomplishments

- root / `apps/api` / `apps/gateway` 的 `wrangler` 版本统一提升到 `^4.90.0`
- 保持现有 `deploy-*.yml` 的 `push main + workflow_dispatch` 双入口
- 新增统一 `.github/workflows/rollback.yml`
- 对 `api` / `gateway` 提供可执行 `wrangler rollback <version_id>` 路径
- 对 Pages apps 明确 fail-closed，要求按 `RUNBOOK.md` 手动回退

## Verification

- `rg -n "\"wrangler\": \"\\^4\\.(9[0-9]|[1-9][0-9]{2,})" package.json apps/api/package.json apps/gateway/package.json`
- `rg -n "workflow_dispatch|branches:" .github/workflows/deploy-*.yml`
- `rg -n "workflow_dispatch|version_id|app|rollback" .github/workflows/rollback.yml`

## Notes

- 本 plan 没有重写 deploy workflow 结构，只做工具链 floor 和 rollback 入口基线
- Pages rollback 仍依赖 Cloudflare Pages deployment history，已在 workflow 和 RUNBOOK 中明确
