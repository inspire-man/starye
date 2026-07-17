# AGENTS.md

本文件是本仓库唯一的 canonical agent 文档。协作默认使用中文。

## Doc Map

| Topic | Canonical Owner | Use When |
|-------|-----------------|----------|
| 人类项目入口 / 最小本地启动 | [README.md](./README.md) | 需要项目概览或本地启动入口 |
| agent 规则 / 高风险边界 | [AGENTS.md](./AGENTS.md) | 需要知道本仓库必须遵守的执行规则 |
| 文档 owner 边界 | [`docs/documentation-ownership.md`](./docs/documentation-ownership.md) | 不确定该改哪份文档、哪份文档算当前 owner |
| 当前 milestone / phase 真相 | [`.planning/PROJECT.md`](./.planning/PROJECT.md), [`.planning/ROADMAP.md`](./.planning/ROADMAP.md), [`.planning/STATE.md`](./.planning/STATE.md) | 继续当前阶段工作、判断下一步命令 |
| 生产运维 / rollback / storage policy | [RUNBOOK.md](./RUNBOOK.md) | 部署、回滚、R2/D1 运维、accidental upload 处理 |
| Claude 兼容入口 | [CLAUDE.md](./CLAUDE.md) | 只在 Claude 适配需要时查看；其内容不得覆盖 AGENTS |
| 规格与 change 历史 | [`openspec/`](./openspec/) | 查 spec、proposal、archive |

## Hard Rules

1. 默认使用中文沟通、分析、验证和交付结论。
2. 改仓库前先走 GSD 工作流：小改动用 `$gsd-quick`，排障用 `$gsd-debug`，phase 工作用 `$gsd-execute-phase`。
3. 文档冲突时，执行中的当前约束先信 `.planning/*`；稳定后的规则再在 closeout 时回写到 `README.md`、`RUNBOOK.md` 或 `docs/`。
4. 本地验证必须经 Gateway：标准入口是 `http://localhost:8080/...`，不要把 `3000/3001/3002/3003/5173` 直连端口写成 canonical URL。
5. 更新文档时只改 canonical owner，不要把同一套说明复制到多份 root doc；owner 边界以 [`docs/documentation-ownership.md`](./docs/documentation-ownership.md) 为准。
6. 当前工作树可能是脏的；不要回滚、覆盖或顺手暂存无关改动，也不要做 repo-wide “清理旧文件”。
7. 如果要修改函数、类、方法等代码 symbol，先做 GitNexus impact analysis，并把 blast radius 告知用户。
8. 如果 impact analysis 返回 HIGH 或 CRITICAL，先明确告警再继续。
9. 提交前必须跑 GitNexus detect-changes，确认只影响预期 symbols 和 execution flows。

## GitNexus Guardrails

- 改 symbol 前：先做 impact analysis。
- 风险高时：先告警，不要静默继续。
- 提交前：做 detect-changes。

更细的文档入口见 [`docs/documentation-ownership.md`](./docs/documentation-ownership.md)。

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
