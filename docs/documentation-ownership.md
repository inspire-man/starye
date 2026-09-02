# Documentation Ownership

本文件只定义文档归属，避免人和 agent 在重复手册之间选择错误的 source of truth。

## Canonical Owners

| 主题 | Canonical owner | 边界 |
|------|-----------------|------|
| 人类入口、最小本地启动 | [README.md](../README.md) | 项目简介、里程碑摘要、启动命令和短索引 |
| 稳定架构顶层地图 | [ARCHITECTURE.md](../ARCHITECTURE.md) | 可部署表面、共享包、关键数据流和不变量 |
| Agent 规则、工程原则、GitNexus guardrails | [AGENTS.md](../AGENTS.md) | 唯一的 agent 规则来源 |
| Claude 兼容入口 | [CLAUDE.md](../CLAUDE.md) | 只保留适配说明和读取顺序 |
| 生产运维、rollback、D1、R2 policy | [RUNBOOK.md](../RUNBOOK.md) | 长期有效的运维契约 |
| 当前 milestone / phase 真相 | [`.planning/PROJECT.md`](../.planning/PROJECT.md)、[`.planning/ROADMAP.md`](../.planning/ROADMAP.md)、[`.planning/STATE.md`](../.planning/STATE.md)、[`.planning/`](../.planning/) | 执行期状态和决策 |
| docs 导航和写入边界 | [`docs/README.md`](./README.md) | docs 分类、入口和维护命令 |
| 稳定专题说明 | [`docs/design-docs/`](./design-docs/)、[`docs/guides/`](./guides/) | 当前仍有长期参考价值的设计和专题文档 |
| 外部框架参考 | [`docs/references/`](./references/) | 可追踪来源的 llms.txt 和非托管参考 |
| 生成索引 | [`docs/generated/`](./generated/) | 由脚本生成的元数据和章节索引 |
| 历史或已取代材料 | [`docs/archive/`](./archive/) | 一次性报告、旧手册和完成总结 |
| phase / milestone 证据 | [`.planning/milestones/`](../.planning/milestones/)、[`.planning/`](../.planning/) | 执行证据，不回写 root docs |
| OpenSpec 使用入口 | [`openspec/README.md`](../openspec/README.md) | 最小命令流、何时建 change、token 读取规则 |
| spec / change history | [`openspec/`](../openspec/) | spec、proposal、change 历史 |

## 边界规则

- 先更新对应 canonical owner，再检查交叉引用；不把同一套规则复制到其他文档。
- 执行中的规则和状态先写入 `.planning/*`；closeout 后再回写稳定 owner。
- 长期 storage policy、cleanup、rollback 和 accidental upload 处理只归 [RUNBOOK.md](../RUNBOOK.md)。
- 被当前规则取代的文档移入 [`docs/archive/`](./archive/)，并注明 `Status` 与 `Replaced by`。
- `.planning` 证据保留在原位置，不把历史证据伪装成 live docs。

## 更新触发器

| 变更 | 先更新 | 复核 |
|------|--------|------|
| 启动方式或 Gateway 入口 | [README.md](../README.md) | [AGENTS.md](../AGENTS.md) 的入口规则 |
| Agent 工作流、工程原则或提交 guardrail | [AGENTS.md](../AGENTS.md) | [CLAUDE.md](../CLAUDE.md) 是否仍为薄适配 |
| Claude 专属提示 | [CLAUDE.md](../CLAUDE.md) | 不复制通用规则 |
| 部署、rollback、D1、R2 或 storage cleanup | [RUNBOOK.md](../RUNBOOK.md) | 当前 phase 的 `.planning/*` |
| milestone、phase、requirements 或 spec | 对应 [`.planning/`](../.planning/) 或 [`openspec/`](../openspec/) owner | 不把执行状态写进历史 spec |
