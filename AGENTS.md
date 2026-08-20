# AGENTS.md

本文件是本仓库唯一的 canonical agent 文档。协作默认使用中文。

## 文档入口

| 主题 | Canonical owner | 何时读取 |
|------|-----------------|----------|
| 人类入口、最小本地启动 | [README.md](./README.md) | 了解项目与启动方式 |
| Agent 规则 | [AGENTS.md](./AGENTS.md) | 执行仓库内任何任务 |
| 文档 owner 边界 | [`docs/documentation-ownership.md`](./docs/documentation-ownership.md) | 判断文档归属或更新位置 |
| 当前 milestone / phase | [`.planning/PROJECT.md`](./.planning/PROJECT.md)、[`.planning/ROADMAP.md`](./.planning/ROADMAP.md)、[`.planning/STATE.md`](./.planning/STATE.md) | 继续 GSD 工作 |
| 生产运维、rollback、D1、R2 | [RUNBOOK.md](./RUNBOOK.md) | 部署和生产运维 |
| Claude 兼容入口 | [CLAUDE.md](./CLAUDE.md) | 使用 Claude 适配层时 |
| 规格与 change 历史 | [`openspec/`](./openspec/) | 查阅 spec、proposal、archive |

## 工作规则

1. 改仓库前先走 GSD：小改动用 `$gsd-quick`，排障用 `$gsd-debug`，phase 工作用 `$gsd-execute-phase`。
2. 执行期发生文档冲突时先信 `.planning/*`；稳定规则在 closeout 时回写到对应 canonical owner。
3. 本地验证统一经 Gateway：使用 `http://localhost:8080/...`，不要把应用 dev port 当成标准入口。
4. 更新文档只改 canonical owner，不复制同一套说明到多个 root doc。
5. 保留用户已有的工作树改动；不回滚、覆盖、暂存无关改动，也不做 repo-wide 清理。

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
