# Documentation Ownership

Phase 9 固化的文档 owner 地图。目标只有一个：让人和 agent 都先落到正确的 source of truth，而不是继续读重复手册。

## Canonical Owners

| Topic | Canonical Owner | Why It Lives There | Notes |
|-------|-----------------|--------------------|-------|
| 人类入口 / 最小本地启动 | [README.md](../README.md) | root human entry | 只保留简介、当前里程碑、最小启动、短索引。 |
| agent 规则 / 高风险边界 | [AGENTS.md](../AGENTS.md) | canonical agent doc | 只保留硬规则与链接。 |
| Claude 兼容入口 | [CLAUDE.md](../CLAUDE.md) | thin adapter | 不再承载第二份 agent 手册。 |
| 生产运维 / rollback / D1 / R2 storage policy | [RUNBOOK.md](../RUNBOOK.md) | stable operations contract | 长期有效的 cleanup、rollback、accidental upload 规则都在这里。 |
| 当前 milestone / phase 真相 | [`.planning/PROJECT.md`](../.planning/PROJECT.md), [`.planning/ROADMAP.md`](../.planning/ROADMAP.md), [`.planning/STATE.md`](../.planning/STATE.md), [`.planning/phases/`](../.planning/phases/) | active execution truth | 执行期冲突先信 `.planning/*`。 |
| stable topic docs | [`docs/`](./) | live docs | 只放现在仍有稳定参考价值的专题文档。 |
| archive docs | [`docs/archive/`](./archive/) | historical / superseded docs | 一次性报告、旧部署手册、完成总结从 live docs 移出。 |
| milestone / phase historical evidence | [`.planning/milestones/`](../.planning/milestones/) | evidence chain | v1.0 证据不迁到 root docs 或 `docs/`。 |
| spec / change history | [`openspec/`](../openspec/) | spec system of record | 不承接当前 milestone 的执行真相。 |

## Root Entry Docs

| Root Doc | Audience | Keep | Do Not Keep |
|----------|----------|------|-------------|
| [README.md](../README.md) | 人 | 项目简介、当前里程碑、最小启动、短索引 | 完整技术栈、完整排障手册、agent 规则 |
| [AGENTS.md](../AGENTS.md) | agent | 5-10 条硬规则、短索引、GitNexus guardrails | Quick Start、项目百科、长 GitNexus 资源表 |
| [CLAUDE.md](../CLAUDE.md) | Claude runtime | 指向 `AGENTS.md` 的兼容说明 | 第二份 canonical agent doc |

## Live Docs vs Archive Docs

| Category | Location | Rule |
|----------|----------|------|
| live docs | [`docs/`](./) | 只保留仍有稳定参考价值的专题说明。 |
| archive docs | [`docs/archive/`](./archive/) | 迁入 historical / superseded 材料，并加 `Status` / `Replaced by` 头。 |
| execution evidence | [`.planning/milestones/`](../.planning/milestones/) and [`.planning/phases/`](../.planning/phases/) | Phase / milestone 证据继续留在 `.planning`，不与 live docs 混放。 |

## Storage Policy Ownership Path

- 当前执行中的 storage rule 先落在 `.planning/*`。
- 稳定后的长期 storage policy、cleanup procedure、rollback note、accidental upload remediation 以 [RUNBOOK.md](../RUNBOOK.md) 为 canonical owner。
- [`06-STORAGE-POLICY.md`](../.planning/phases/06-storage-policy-audit/06-STORAGE-POLICY.md) 和 [`08-VERIFICATION.md`](../.planning/phases/08-cost-guardrails/08-VERIFICATION.md) 是历史快照 / 验证证据，不再是 live owner。
- 未来规则变更走 `.planning` -> closeout -> `RUNBOOK.md` 的 write-back 路径。

## Update Triggers

| Change Trigger | Update This Owner First | Then Check |
|----------------|-------------------------|------------|
| 本地启动方式、Gateway 入口、最小开发命令变更 | [README.md](../README.md) | [AGENTS.md](../AGENTS.md) 中是否仍有高风险提醒需要同步 |
| agent 工作流、提交前 guardrail、中文协作规则变更 | [AGENTS.md](../AGENTS.md) | [CLAUDE.md](../CLAUDE.md) 是否仍只做薄适配 |
| Claude 专属兼容提示变更 | [CLAUDE.md](../CLAUDE.md) | 不得把通用规则写回 `CLAUDE.md` |
| deploy / rollback / D1 / storage cleanup / accidental upload 规则变更 | [RUNBOOK.md](../RUNBOOK.md) | 当前 phase 的 `.planning/*` 是否也需要先锁定新规则 |
| 当前 milestone / phase 范围、下一步命令、requirements traceability 变更 | [`.planning/ROADMAP.md`](../.planning/ROADMAP.md), [`.planning/STATE.md`](../.planning/STATE.md), [`.planning/REQUIREMENTS.md`](../.planning/REQUIREMENTS.md) | closeout 时再决定是否回写 root docs / RUNBOOK |
| 某个专题文档仍有长期参考价值且需要更新 | 对应 `docs/*.md` | 不要把同类说明复制回 root docs |
| 某份旧文档已经被当前规则取代 | 移入 [`docs/archive/`](./archive/) | 顶部加 `Status` / `Replaced by`，并从 live 索引移除 |
| spec 或 change proposal 变更 | [`openspec/`](../openspec/) | 不要把执行状态写进 spec 历史 |

## Reference Integrity Sweep

**Sweep date:** 2026-07-13

- v1.0 证据链仍以 [`.planning/milestones/v1.0-MILESTONE-AUDIT.md`](../.planning/milestones/v1.0-MILESTONE-AUDIT.md) 和 [`.planning/milestones/v1.0-phases/`](../.planning/milestones/v1.0-phases/) 为准。
- root entry docs 不再把已迁档的 `r2-mapping-*`、测试报告、完成总结当成 live docs 入口。
- `RUNBOOK.md` 明确承担长期 storage policy owner；phase 06 / 08 文档保留为历史快照和验证证据。
