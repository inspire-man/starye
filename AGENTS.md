# AGENTS.md

本文件是本仓库唯一的 canonical agent 文档。协作默认使用中文。

## 文档入口

| 主题 | Canonical owner | 何时读取 |
|------|-----------------|----------|
| 人类入口、最小本地启动 | [README.md](./README.md) | 了解项目与启动方式 |
| Agent 规则 | [AGENTS.md](./AGENTS.md) | 执行仓库内任何任务 |
| 文档 owner 边界 | [`docs/documentation-ownership.md`](./docs/documentation-ownership.md) | 判断文档归属或更新位置 |
| 当前 milestone / phase | [`.planning/PROJECT.md`](./.planning/PROJECT.md)、[`.planning/ROADMAP.md`](./.planning/ROADMAP.md)、[`.planning/STATE.md`](./.planning/STATE.md) | 了解项目计划与状态 |
| 生产运维、rollback、D1、R2 | [RUNBOOK.md](./RUNBOOK.md) | 部署和生产运维 |
| Claude 兼容入口 | [CLAUDE.md](./CLAUDE.md) | 使用 Claude 适配层时 |
| OpenSpec 使用与 change | [`openspec/README.md`](./openspec/README.md) | 新功能规格、任务和归档 |
| 规格与 change 历史 | [`openspec/`](./openspec/) | 查阅 spec、proposal、archive |

## 工作规则

1. 发生文档冲突时先信 `.planning/*`；稳定规则在对应 canonical owner 中维护。
2. 本地验证统一经 Gateway：使用 `http://localhost:8080/...`，不要把应用 dev port 当成标准入口。
3. 更新文档只改 canonical owner，不复制同一套说明到多个 root doc。
4. 保留用户已有的工作树改动；不回滚、覆盖、暂存无关改动，也不做 repo-wide 清理。
5. 单文件小改动直接实现；跨 api/db/frontend 或接口契约变更先读 [`openspec/README.md`](./openspec/README.md) 并建立 change。

## 工程原则

1. 废弃路径直接移除，不为旧路径新增向后兼容层、fallback 或迁移。
2. 选择完整满足当前需求的最小实现，避免推测性抽象、配置和间接层。
3. 分层演进：先让最小版本端到端可用，再在工作产品上逐层增加能力；不以未完成的复杂度替代可用产品。
4. 保持组件模块化，清楚分离不同关注点。
5. 优先使用成熟、维护良好的库，减少复杂度并提高可靠性；没有明确理由时不重写通用能力。
6. 先检查项目已有依赖的文档和类型，再决定是否自行实现或新增依赖。
7. 以长期架构为决策标准，不接受只解决眼前问题且计划后续替换的临时方案。

## GitNexus Guardrails

- 修改函数、类、方法或其他代码 symbol 前，运行 GitNexus upstream impact analysis，并向用户报告直接调用者、受影响模块/流程和风险级别。
- impact 返回 `HIGH` 或 `CRITICAL` 时，先明确告警，再继续编辑。
- 提交前运行 GitNexus `detect_changes`，确认只影响预期 symbols 和 execution flows。
- 探索陌生代码时优先使用 GitNexus query/context；索引过期时先运行 `npx gitnexus analyze`。

更细的文档归属规则见 [`docs/documentation-ownership.md`](./docs/documentation-ownership.md)。

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **starye** (29055 symbols, 42146 relationships, 300 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

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
