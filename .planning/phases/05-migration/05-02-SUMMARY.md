---
phase: 05-migration
plan: 02
subsystem: migration-safety
tags: [d1, migration, backup, ci, reviewer-ack]
requirements-completed:
  - DEPLOY-03
  - DEPLOY-04
completed: 2026-05-13
---

# Phase 5 Plan 02 Summary

## Accomplishments

- `deploy-migrations.yml` 增加 `wrangler d1 export --remote --output=...` 备份步骤
- backup 产物以 GitHub artifact 形式上传，保留 14 天
- 新增 destructive SQL 检测，覆盖 `DROP COLUMN` / `DROP TABLE` / `ALTER TABLE ... DROP`
- `deploy-migrations.yml` 与 `ci.yml` 都引入 reviewer ack 路径，使用 `production-migration-review` protected environment
- `RUNBOOK.md` 与 `packages/db/MIGRATION.md` 将恢复路径收口为“先备份、再 apply、优先 restore/time-travel、必要时 forward-fix”

## Verification

- `rg -n "d1 export|migrations apply" .github/workflows/deploy-migrations.yml`
- `rg -n "DROP COLUMN|DROP TABLE|review|ack" .github/workflows/deploy-migrations.yml .github/workflows/ci.yml`
- `rg -n "export|restore|rollback|备份|恢复|time-travel" packages/db/MIGRATION.md RUNBOOK.md`

## Notes

- 当前 backup 落 GitHub artifact，不额外接 R2；这是 v1 最小可追溯方案
- D1 仍不做自动逆迁移，恢复主路径放在 RUNBOOK 中
