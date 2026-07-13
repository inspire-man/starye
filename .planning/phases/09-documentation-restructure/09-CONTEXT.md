# Phase 9: Documentation Restructure - Context

**Gathered:** 2026-07-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 9 收紧仓库文档入口，让后续开发和维护先读到正确 source of truth。它要把 `README`、`AGENTS`、`RUNBOOK`、`.planning`、`docs`、`openspec` 的职责切开，消除重复说明，给历史材料建立明确归档边界，并把已经稳定的存储策略/运维规则沉淀到长期 owner。它不新增产品能力，不重写 OpenSpec 体系，也不在本 phase 内做存储代码整理或新的运维能力。

</domain>

<decisions>
## Implementation Decisions

### Canonical Documentation Ownership
- **D-01:** 根文档职责固定为：`README.md` = 人类项目入口与本地开发速览；`AGENTS.md` = agent 规则 + 必读链接；`RUNBOOK.md` = 生产运维；`.planning/*` = 当前 milestone / phase 的执行真相；`docs/` = 主题长文；`openspec/` = 规格与变更历史。
- **D-02:** 同一类信息只允许一个 canonical owner。其他文档只保留 1-3 行摘要和链接，不再复制完整说明。
- **D-03:** 如果不同文档对同一主题说法不一致，执行中的当前约束先信 `.planning/*`；规则稳定后再沉淀回 `README.md`、`RUNBOOK.md` 或 `docs/`。归档 `openspec` 和 milestone 证据只作历史依据，不反向覆盖当前规则。
- **D-04:** `README.md` 与 `AGENTS.md` 都需要提供一个很短的“去哪读什么”索引表，按主题直接链接到 canonical owner。

### AGENTS and Agent-Facing Doc Boundaries
- **D-05:** `AGENTS.md` 只保留 agent 必须执行的 repo 规则、文档索引、少量高风险提醒；不再充当完整 quick start、项目结构、技术栈、常见问题手册。
- **D-06:** `AGENTS.md` 只允许保留 5-10 条“忘了就容易做错”的硬规则；其他内容一律改为摘要 + 链接。
- **D-07:** `AGENTS.md` 是唯一 canonical agent 文档。`CLAUDE.md` 如果继续保留，只能作为很薄的适配层，主要指向 `AGENTS.md`，外加极少量 Claude 专属说明。
- **D-08:** GitNexus 相关内容在 `AGENTS.md` 里只保留 3-4 条必须执行的硬规则，例如改 symbol 前先做 impact、提交前先做 detect-changes；更长的资源表和说明迁移为链接。

### Live Docs vs Historical Archives
- **D-09:** v1.0 的 phase / milestone 执行证据统一以 `.planning/milestones/v1.0-phases/` 和 `.planning/milestones/v1.0-MILESTONE-AUDIT.md` 为准；根目录和 `docs/` 不再承载同类 phase 证据。
- **D-10:** `docs/` 只保留“现在仍有稳定参考价值”的活文档；纯历史报告、完成总结、一次性测试材料不再与活文档混放。
- **D-11:** 已被当前规则推翻的旧文档不直接删除，而是迁到归档区，并明确标注 `superseded` 以及被哪份当前文档取代；同时从活文档索引移除。
- **D-12:** `docs/` 迁出的历史材料统一进入 `docs/archive/`；`.planning/milestones/...` 继续只承接 phase / milestone 执行证据。

### Storage Policy Long-Term Home
- **D-13:** 稳定后的长期存储策略与运维合同以 `RUNBOOK.md` 为 canonical owner。
- **D-14:** `06-STORAGE-POLICY.md` 这类 phase policy 文档保留在对应 phase 目录里，作为历史决策快照，不再作为活文档 owner。
- **D-15:** `RUNBOOK.md` 只吸收长期有效的规则和操作合同：允许/禁止的存储用途、审计 stop conditions、cleanup/remediation 步骤、rollback 注意事项。inventory 明细、当期 dry-run 报告模板、阶段性分析继续留在 `.planning/*`。
- **D-16:** 后续如果存储规则发生变更，执行期先在当前 phase 的 `.planning` 工件中锁定并落地；在该 phase closeout 时，把已经稳定的规则回写到 `RUNBOOK.md`，并将旧的活入口标注为 `superseded`。

### the agent's Discretion
- 规划阶段可自行决定 `README.md` / `AGENTS.md` 索引表的具体版式与文案，只要保持“短索引、直达 owner、无重复正文”。
- `AGENTS.md` 中最终保留的 5-10 条硬规则，可由规划/执行阶段基于误用风险精确筛选，但不得扩回完整手册。
- `docs/` 下具体哪些文件留在活文档区、哪些迁入 `docs/archive/`，可按单文件分类判断，只要满足“活文档保留稳定参考价值、历史/一次性材料出清、被推翻文档标 superseded”的边界。

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone and Phase Boundaries
- `.planning/PROJECT.md` — 项目级文档职责方向已经锁定，包括“AGENTS 只保留入口级规则”和 v1.1 的文档瘦身目标。
- `.planning/REQUIREMENTS.md` — Phase 9 requirements `DOC-01` through `DOC-04`，以及与 Phase 10 的边界。
- `.planning/ROADMAP.md` — Phase 9 goal 和 success criteria；明确本 phase 是文档重构，不是代码整理。
- `.planning/STATE.md` — 当前 milestone 进度、Phase 9 当前状态，以及前序 phase 已锁定的文档/存储相关决策。
- `.planning/MILESTONES.md` — 当前仓库对 milestone archive 的现有组织方式。
- `.planning/milestones/v1.0-MILESTONE-AUDIT.md` — v1.0 归档证据的总入口，说明哪些历史 artifacts 已作为 archive 证据存在。

### Current Canonical / Near-Canonical Docs
- `README.md` — 当前人类入口文档；需要收敛成项目介绍 + 本地开发速览 + owner 索引。
- `AGENTS.md` — 当前 agent 入口文档；需要收敛成硬规则 + owner 索引。
- `CLAUDE.md` — 当前过厚的 agent 专用镜像；Phase 9 需要将其压薄成适配层。
- `RUNBOOK.md` — 当前正式运维手册，且已承接 R2 成本护栏、cleanup/remediation、rollback 等稳定运维合同。
- `scripts/README.md` — 脚本说明文档示例；可作为“稳定参考文档是否留在 docs/root”的分类参照。

### Existing Planning and Storage Policy Sources
- `.planning/phases/06-storage-policy-audit/06-CONTEXT.md` — 锁定了 source/external URL vs R2 asset 的术语边界，以及“历史文档声明”和“当前运行真相”应分开。
- `.planning/phases/06-storage-policy-audit/06-STORAGE-POLICY.md` — 当前 phase 级存储策略文档；Phase 9 需要决定其与 `RUNBOOK.md` 的长期关系。
- `.planning/phases/08-cost-guardrails/08-CONTEXT.md` — 锁定了 `RUNBOOK.md` 已承接的 R2 成本护栏、审计 stop conditions 和 remediation 合同。

### Historical Docs to Classify or Archive
- `docs/r2-mapping-storage-setup-guide.md` — 旧存储流程说明；与 v1.1 存储策略存在潜在冲突。
- `docs/r2-mapping-storage-implementation-report.md` — 旧实现报告；偏历史证据而非当前活文档。
- `docs/r2-mapping-quick-deploy-guide.md` — 旧部署指南；需判断是仍有效还是应迁归档。
- `docs/r2-mapping-env-vars-guide.md` — 旧环境变量说明；需判断是否已被现行文档吸收。
- `docs/r2-mapping-deployment-checklist.md` — 旧 checklist 文档；可能属于一次性实施材料。
- `docs/r2-mapping-usage-examples.md` — 旧用法示例；需判断是否仍有稳定参考价值。
- `docs/task-15.7-r2-storage-completion-summary.md` — 典型完成总结型历史材料；应作为 archive 分类样本。
- `docs/local-test-report-2026-03-31.md` — 典型一次性测试报告；应作为 archive 分类样本。
- `docs/seesaawiki-rollback-plan.md` — 主题型历史方案文档；需判断是否属于仍有效的专题长文。

### Docs / Spec Organization Context
- `.planning/codebase/CONVENTIONS.md` — 文档语言、注释习惯、仓库命名约定。
- `.planning/codebase/STRUCTURE.md` — 当前 root / docs / openspec / .planning 的目录职责现状。
- `openspec/specs/docs-indexing/spec.md` — 现有文档索引相关 spec，可作为历史/规格语境参考。
- `openspec/specs/ai-docs-strategy/spec.md` — 现有文档策略相关 spec，可作为长期文档结构参考。

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `.planning/milestones/v1.0-phases/`：现成的 phase 级 archive 结构，已能承接 `CONTEXT / PLAN / SUMMARY / VERIFICATION / UAT / SECURITY` 等执行证据。
- `.planning/milestones/v1.0-MILESTONE-AUDIT.md`：现成的 milestone 级 archive 入口，可作为“历史执行证据的单点索引”模式复用。
- `RUNBOOK.md`：已经具备明确章节化结构，适合作为长期存储策略 / 运维合同 owner，而无需再造一份平行长期文档。
- `AGENTS.md` 与 `README.md`：当前都位于 root，适合保留短索引入口，只是要去掉重复正文。

### Established Patterns
- 当前 `.planning/*` 已经承担 milestone 执行真相和阶段合同，说明“执行期先信 planning”有现成落点，不需要新体系。
- 当前 `docs/` 同时混放活文档和历史报告，说明 Phase 9 需要的是分类与迁移，而不是从零发明新目录模型。
- 当前 `CLAUDE.md` 明显比 `AGENTS.md` 更厚，说明 agent-facing 文档已经发生镜像漂移，必须收敛到单 owner + 适配层模式。
- Phase 6 和 Phase 8 已经把存储策略与运维动作拆成“phase 合同”与“RUNBOOK 运行规则”两类材料，Phase 9 只需要明确长期 owner 和回写节奏。

### Integration Points
- `README.md` 和 `AGENTS.md` 需要一起改造成“短索引入口”，并且互相不再复制完整手册内容。
- `CLAUDE.md` 需要同步改薄，避免继续成为第二份 canonical agent 手册。
- `docs/archive/` 需要作为新归档落点，与 `.planning/milestones/...` 的执行证据归档形成并行但不混淆的结构。
- `RUNBOOK.md` 需要吸收稳定后的存储策略长期规则，而 phase 目录保留历史快照与执行证据。

</code_context>

<specifics>
## Specific Ideas

- `README.md` 和 `AGENTS.md` 都应有一份很短的“去哪读什么”表，而不是再复制长段 quick start / troubleshooting。
- `AGENTS.md` 的最终形状应接近“硬规则清单 + 链接跳板”，而不是项目百科。
- `docs/r2-mapping-*` 与 `docs/task-15.7-r2-storage-completion-summary.md` 是典型的 superseded 候选；规划阶段应优先纳入分类清单。
- 存储策略的长期 owner 不应再落回某个 phase artifact；`RUNBOOK.md` 负责长期规则，phase 文档只保留历史快照和执行语境。

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 9-Documentation Restructure*
*Context gathered: 2026-07-13*
