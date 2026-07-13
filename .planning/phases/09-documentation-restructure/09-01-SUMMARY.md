---
phase: 09-documentation-restructure
plan: 01
subsystem: root-doc-ownership
tags: [docs, README, AGENTS, ownership]
requirements-completed:
  - DOC-01
  - DOC-02
completed: 2026-07-13
status: complete
---

# Phase 9 Plan 01 Summary

## Accomplishments

- 新建 `docs/documentation-ownership.md`，把 `README.md`、`AGENTS.md`、`CLAUDE.md`、`RUNBOOK.md`、`.planning/*`、`docs/`、`docs/archive/`、`openspec/` 的 canonical owner 边界写成长期参考。
- `README.md` 收缩为人类入口：只保留项目简介、当前里程碑、最小本地启动和短版 doc map。
- `AGENTS.md` 收缩为 canonical agent doc：只保留 doc map、硬规则和精简 GitNexus guardrails，不再继续镜像 quick start / tech stack / FAQ。

## Verification

- `rg -n "^## Canonical Owners|^## Root Entry Docs|^## Update Triggers" docs/documentation-ownership.md`
- `rg -n "^\\| Topic \\| Canonical Owner \\||documentation-ownership\\.md" AGENTS.md README.md`
- `powershell -NoProfile -Command "$a=Get-Content AGENTS.md -Raw; if ($a -match '## Quick Start|## Project Structure|## Technology Stack|## Development Workflow|## Testing|## Common Issues') { throw 'AGENTS still contains handbook sections' }"`

## Notes

- `README.md` 继续做人类入口，但不再承担完整项目手册。
- `AGENTS.md` 继续做唯一 canonical agent doc，`CLAUDE.md` 不得再反向扩写成第二份总手册。
