# CLAUDE.md

这是 Claude 兼容适配层，不是 canonical agent 手册。

## Canonical Read Order

1. [AGENTS.md](./AGENTS.md)
2. [`docs/documentation-ownership.md`](./docs/documentation-ownership.md)
3. [`.planning/PROJECT.md`](./.planning/PROJECT.md), [`.planning/ROADMAP.md`](./.planning/ROADMAP.md), [`.planning/STATE.md`](./.planning/STATE.md)
4. [RUNBOOK.md](./RUNBOOK.md)

## Claude-Specific Notes

- Canonical agent doc is [AGENTS.md](./AGENTS.md).
- 如果 `CLAUDE.md` 与 `AGENTS.md` 冲突，以 `AGENTS.md` 为准。
- 本文件必须保持薄；不要再把项目结构、技术栈、GSD 说明或 GitNexus 长手册镜像回来。

需要看 owner 边界时，直接跳到 [`docs/documentation-ownership.md`](./docs/documentation-ownership.md)。

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **starye** (17712 symbols, 23688 relationships, 300 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/starye/context` | Codebase overview, check index freshness |
| `gitnexus://repo/starye/clusters` | All functional areas |
| `gitnexus://repo/starye/processes` | All execution flows |
| `gitnexus://repo/starye/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
