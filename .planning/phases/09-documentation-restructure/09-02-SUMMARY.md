---
phase: 09-documentation-restructure
plan: 02
subsystem: claude-adapter-and-archive
tags: [docs, CLAUDE, archive, superseded]
requirements-completed:
  - DOC-01
  - DOC-02
  - DOC-03
completed: 2026-07-13
status: complete
---

# Phase 9 Plan 02 Summary

## Accomplishments

- `CLAUDE.md` 压薄成兼容适配层，明确声明 `AGENTS.md` 是唯一 canonical agent doc。
- 新建 `docs/archive/README.md` 作为 archive 索引。
- 把旧的 `r2-mapping-*` 手册、`local-test-report-2026-03-31.md`、`task-15.7-r2-storage-completion-summary.md`、`series-publisher-separation-report-2026-03-31.md` 迁入 `docs/archive/`，并为每份文档加上 `Status` / `Replaced by` 头。

## Verification

- `powershell -NoProfile -Command "$lines=(Get-Content CLAUDE.md | Measure-Object -Line).Lines; if ($lines -gt 80) { throw 'CLAUDE still too long' }"`
- `rg -n "canonical agent doc|AGENTS\\.md|documentation-ownership\\.md|RUNBOOK\\.md" CLAUDE.md`
- `powershell -NoProfile -Command "$paths='docs/archive/README.md','docs/archive/local-test-report-2026-03-31.md','docs/archive/task-15.7-r2-storage-completion-summary.md','docs/archive/series-publisher-separation-report-2026-03-31.md','docs/archive/r2-mapping-storage-implementation-report.md','docs/archive/r2-mapping-storage-setup-guide.md'; foreach($p in $paths){ if(-not (Test-Path $p)){ throw \"Missing $p\" } }"`
- `rg -n "^> Status: (historical|superseded)|^> Replaced by:" docs/archive`

## Notes

- archive 的目标是把 historical / superseded 材料从 live docs 入口移走，不是删除历史内容。
- v1.0 的 milestone evidence 没有迁出 `.planning/milestones/...`。
