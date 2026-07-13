# Phase 09: Documentation Restructure - Research

**Researched:** 2026-07-13  
**Confidence:** HIGH  
**Scope:** 仅覆盖文档 owner 边界、live/archive 分类、重复冲突、RUNBOOK 与 phase artifact 分工、dirty working tree 风险。[VERIFIED: .planning/phases/09-documentation-restructure/09-CONTEXT.md][VERIFIED: git status --short]

<user_constraints>
## User Constraints (from CONTEXT.md)

来源：[VERIFIED: .planning/phases/09-documentation-restructure/09-CONTEXT.md]

### Locked Decisions
<!-- DATA_7K2M4Q9P_START -->
- **D-01:** 根文档职责固定为：`README.md` = 人类项目入口与本地开发速览；`AGENTS.md` = agent 规则 + 必读链接；`RUNBOOK.md` = 生产运维；`.planning/*` = 当前 milestone / phase 的执行真相；`docs/` = 主题长文；`openspec/` = 规格与变更历史。
- **D-02:** 同一类信息只允许一个 canonical owner。其他文档只保留 1-3 行摘要和链接，不再复制完整说明。
- **D-03:** 如果不同文档对同一主题说法不一致，执行中的当前约束先信 `.planning/*`；规则稳定后再沉淀回 `README.md`、`RUNBOOK.md` 或 `docs/`。归档 `openspec` 和 milestone 证据只作历史依据，不反向覆盖当前规则。
- **D-04:** `README.md` 与 `AGENTS.md` 都需要提供一个很短的“去哪读什么”索引表，按主题直接链接到 canonical owner。
- **D-05:** `AGENTS.md` 只保留 agent 必须执行的 repo 规则、文档索引、少量高风险提醒；不再充当完整 quick start、项目结构、技术栈、常见问题手册。
- **D-06:** `AGENTS.md` 只允许保留 5-10 条“忘了就容易做错”的硬规则；其他内容一律改为摘要 + 链接。
- **D-07:** `AGENTS.md` 是唯一 canonical agent 文档。`CLAUDE.md` 如果继续保留，只能作为很薄的适配层，主要指向 `AGENTS.md`，外加极少量 Claude 专属说明。
- **D-08:** GitNexus 相关内容在 `AGENTS.md` 里只保留 3-4 条必须执行的硬规则，例如改 symbol 前先做 impact、提交前先做 detect-changes；更长的资源表和说明迁移为链接。
- **D-09:** v1.0 的 phase / milestone 执行证据统一以 `.planning/milestones/v1.0-phases/` 和 `.planning/milestones/v1.0-MILESTONE-AUDIT.md` 为准；根目录和 `docs/` 不再承载同类 phase 证据。
- **D-10:** `docs/` 只保留“现在仍有稳定参考价值”的活文档；纯历史报告、完成总结、一次性测试材料不再与活文档混放。
- **D-11:** 已被当前规则推翻的旧文档不直接删除，而是迁到归档区，并明确标注 `superseded` 以及被哪份当前文档取代；同时从活文档索引移除。
- **D-12:** `docs/` 迁出的历史材料统一进入 `docs/archive/`；`.planning/milestones/...` 继续只承接 phase / milestone 执行证据。
- **D-13:** 稳定后的长期存储策略与运维合同以 `RUNBOOK.md` 为 canonical owner。
- **D-14:** `06-STORAGE-POLICY.md` 这类 phase policy 文档保留在对应 phase 目录里，作为历史决策快照，不再作为活文档 owner。
- **D-15:** `RUNBOOK.md` 只吸收长期有效的规则和操作合同：允许/禁止的存储用途、审计 stop conditions、cleanup/remediation 步骤、rollback 注意事项。inventory 明细、当期 dry-run 报告模板、阶段性分析继续留在 `.planning/*`。
- **D-16:** 后续如果存储规则发生变更，执行期先在当前 phase 的 `.planning` 工件中锁定并落地；在该 phase closeout 时，把已经稳定的规则回写到 `RUNBOOK.md`，并将旧的活入口标注为 `superseded`。
<!-- DATA_7K2M4Q9P_END -->

### the agent's Discretion
<!-- DATA_R5N8C1T6_START -->
- 规划阶段可自行决定 `README.md` / `AGENTS.md` 索引表的具体版式与文案，只要保持“短索引、直达 owner、无重复正文”。
- `AGENTS.md` 中最终保留的 5-10 条硬规则，可由规划/执行阶段基于误用风险精确筛选，但不得扩回完整手册。
- `docs/` 下具体哪些文件留在活文档区、哪些迁入 `docs/archive/`，可按单文件分类判断，只要满足“活文档保留稳定参考价值、历史/一次性材料出清、被推翻文档标 superseded”的边界。
<!-- DATA_R5N8C1T6_END -->

### Deferred Ideas (OUT OF SCOPE)
<!-- DATA_L2V7H4M8_START -->
None — discussion stayed within phase scope.
<!-- DATA_L2V7H4M8_END -->
</user_constraints>

## Project Constraints (from AGENTS.md)

- 默认使用中文沟通、问题分析、结果反馈和实现说明。[VERIFIED: AGENTS.md]
- 本地开发访问方式必须经 Gateway 的 `http://localhost:8080/...` 路径；不要把 `3000/3001/3002/3003/5173` 直连端口写成标准入口。[VERIFIED: AGENTS.md]
- 项目内现行命令名应保持为 canonical examples：`pnpm dev:clean`、`pnpm build`、`pnpm type-check`、`pnpm lint`、`pnpm test`、`pnpm test:e2e`。[VERIFIED: AGENTS.md]
- `openspec/` 已有独立 spec/change 体系；Phase 9 不应把当前 milestone/phase 执行真相搬进 OpenSpec。[VERIFIED: AGENTS.md][VERIFIED: openspec listing][VERIFIED: .planning/phases/09-documentation-restructure/09-CONTEXT.md]
- 若执行阶段意外触到代码 symbol，仍需遵守 GitNexus 的 impact analysis / detect-changes 规则；但本 phase 目标应保持在文档边界内。[VERIFIED: AGENTS.md]

## 当前文档 Owner 边界

| 位置 | Canonical Owner | 应保留 | 不应保留 | 当前观察 |
|------|-----------------|--------|----------|----------|
| `README.md` | 人类项目入口与本地开发速览 | 项目简介、最小启动路径、去哪读什么索引 | 完整技术栈手册、完整排障手册、agent 规则 | 当前仍承载项目结构、技术栈、功能清单、API/排障长文，已超出入口边界。[VERIFIED: README.md][VERIFIED: .planning/phases/09-documentation-restructure/09-CONTEXT.md] |
| `AGENTS.md` | 唯一 agent 入口 | 5-10 条硬规则、文档索引、高风险提醒 | 完整 quick start、项目结构、技术栈、常见问题手册 | 当前与 `README.md` 大量重复，仍充当项目百科。[VERIFIED: AGENTS.md][VERIFIED: .planning/phases/09-documentation-restructure/09-CONTEXT.md] |
| `CLAUDE.md` | Claude 适配层 | 指向 `AGENTS.md` 的薄入口，外加极少量 Claude 专属说明 | 第二份 canonical agent 手册 | 当前比 `AGENTS.md` 更厚，并复制了大量项目/架构/GitNexus 内容。[VERIFIED: CLAUDE.md][VERIFIED: .planning/phases/09-documentation-restructure/09-CONTEXT.md] |
| `RUNBOOK.md` | 生产运维与长期存储/rollback 合同 | deploy/rollback、D1 migration safety、R2 lifecycle/audit/remediation、稳定后的 storage contract | phase 执行证据、一次性 dry-run 报告 | 已承接 rollback 和 R2 成本护栏；但稳定 storage allow/forbidden 摘要仍部分留在 `06-STORAGE-POLICY.md` 快照里。[VERIFIED: RUNBOOK.md][VERIFIED: .planning/phases/06-storage-policy-audit/06-STORAGE-POLICY.md][VERIFIED: .planning/phases/09-documentation-restructure/09-CONTEXT.md] |
| `docs/` | 主题长文 | 仍有长期参考价值的专题文档 | 完成总结、一次性测试材料、旧部署手册与旧 checklist 混放 | 当前同时混放专题文档、实现报告、测试报告、完成总结；顶层也尚未出现 `docs/archive/`。[VERIFIED: docs listing][VERIFIED: .planning/phases/09-documentation-restructure/09-CONTEXT.md] |
| `.planning/` | 当前 milestone / phase 真相与历史执行证据 | `REQUIREMENTS/ROADMAP/STATE`、当前 phase artifact、milestone archive evidence | root doc 的平行手册副本 | 当前已是 v1.1 与 Phase 9 的执行真相，冲突时应优先于 root docs。[VERIFIED: .planning/REQUIREMENTS.md][VERIFIED: .planning/ROADMAP.md][VERIFIED: .planning/STATE.md][VERIFIED: .planning/phases/09-documentation-restructure/09-CONTEXT.md] |
| `openspec/` | spec/change 历史 | 活跃 spec 与 change proposal | milestone/phase 执行真相、runbook 规则 | 目录边界清楚：`specs/` + `changes/` + `config.yaml`。[VERIFIED: openspec listing][VERIFIED: AGENTS.md] |

## RUNBOOK 已有内容 vs Phase Artifact 仍保留内容

- `RUNBOOK.md` 已经是当前生产 rollback owner：包含 Workers/Pages 回滚、D1 migration safety、恢复路径、R2 生命周期规则、repeatable audit procedure、Budget Alerts、accidental upload remediation。[VERIFIED: RUNBOOK.md]
- `06-STORAGE-POLICY.md` 仍保留 phase 快照性质内容：allowlist/restricted/short-term/forbidden 分类、命名语义锁、discovered unlisted prefixes、Phase 6 的 no-delete/no-enforcement 边界；这些不应继续被当作活文档 owner。[VERIFIED: .planning/phases/06-storage-policy-audit/06-STORAGE-POLICY.md][VERIFIED: .planning/phases/09-documentation-restructure/09-CONTEXT.md]
- `08-VERIFICATION.md` 是“Phase 8 已把 RUNBOOK 与 audit 契约对齐”的验证证据，不是长期 owner。[VERIFIED: .planning/phases/08-cost-guardrails/08-VERIFICATION.md]
- Planner 的关键判断：Phase 9 不需要重写 phase 6/8 历史 artifact；需要把“长期有效的 storage policy 摘要”补到 `RUNBOOK.md`，同时把 phase 文档明确降级为历史快照/证据。[VERIFIED: RUNBOOK.md][VERIFIED: .planning/phases/06-storage-policy-audit/06-STORAGE-POLICY.md][VERIFIED: .planning/REQUIREMENTS.md]

## 活文档 vs Archive 候选

### 明确保留为活文档

| 文档 | 角色 |
|------|------|
| `README.md` | 人类入口，需瘦身后继续保留。[VERIFIED: README.md][VERIFIED: .planning/phases/09-documentation-restructure/09-CONTEXT.md] |
| `AGENTS.md` | 唯一 canonical agent 文档，需瘦身后继续保留。[VERIFIED: AGENTS.md][VERIFIED: .planning/phases/09-documentation-restructure/09-CONTEXT.md] |
| `CLAUDE.md` | 仅在压薄为 adapter 的前提下继续保留。[VERIFIED: CLAUDE.md][VERIFIED: .planning/phases/09-documentation-restructure/09-CONTEXT.md] |
| `RUNBOOK.md` | 活跃运维与长期 storage/rollback owner。[VERIFIED: RUNBOOK.md][VERIFIED: .planning/phases/09-documentation-restructure/09-CONTEXT.md] |
| `.planning/REQUIREMENTS.md` / `ROADMAP.md` / `STATE.md` / `09-CONTEXT.md` | 当前 v1.1 / Phase 9 计划真相。[VERIFIED: .planning/REQUIREMENTS.md][VERIFIED: .planning/ROADMAP.md][VERIFIED: .planning/STATE.md][VERIFIED: .planning/phases/09-documentation-restructure/09-CONTEXT.md] |
| `openspec/specs/*` / `openspec/changes/*` | 活跃 spec/change 体系，但不是 phase truth owner。[VERIFIED: openspec listing][VERIFIED: AGENTS.md] |

### 明确历史/归档候选

| 文档 | 建议 |
|------|------|
| `.planning/milestones/v1.0-MILESTONE-AUDIT.md` 与 `.planning/milestones/v1.0-phases/*` | 保留为历史证据；不要迁出或清理掉。[VERIFIED: .planning/MILESTONES.md][VERIFIED: .planning/phases/09-documentation-restructure/09-CONTEXT.md] |
| `.planning/phases/06-storage-policy-audit/06-STORAGE-POLICY.md` | 历史决策快照，保留在 phase 目录，不再作为活 owner。[VERIFIED: .planning/phases/06-storage-policy-audit/06-STORAGE-POLICY.md][VERIFIED: .planning/phases/09-documentation-restructure/09-CONTEXT.md] |
| `.planning/phases/08-cost-guardrails/08-VERIFICATION.md` | 历史验证证据，保留在 phase 目录。[VERIFIED: .planning/phases/08-cost-guardrails/08-VERIFICATION.md] |
| `docs/r2-mapping-storage-implementation-report.md`、`docs/task-15.7-r2-storage-completion-summary.md`、`docs/local-test-report-2026-03-31.md` | 明确 archive 候选；属于实施报告/完成总结/一次性测试材料。[VERIFIED: docs/r2-mapping-storage-implementation-report.md][VERIFIED: docs/task-15.7-r2-storage-completion-summary.md][VERIFIED: docs/local-test-report-2026-03-31.md][VERIFIED: .planning/phases/09-documentation-restructure/09-CONTEXT.md] |
| `docs/r2-mapping-storage-setup-guide.md`、`docs/r2-mapping-quick-deploy-guide.md`、`docs/r2-mapping-env-vars-guide.md`、`docs/r2-mapping-deployment-checklist.md`、`docs/r2-mapping-usage-examples.md` | 高优先级 archive/superseded 候选；均为 2026-03-31 的旧部署/环境/操作材料，且与当前 `RUNBOOK.md` / `.planning` 边界重叠。[VERIFIED: docs/r2-mapping-storage-setup-guide.md][VERIFIED: docs/r2-mapping-quick-deploy-guide.md][VERIFIED: docs/r2-mapping-env-vars-guide.md][VERIFIED: docs/r2-mapping-deployment-checklist.md][VERIFIED: docs/r2-mapping-usage-examples.md][VERIFIED: RUNBOOK.md] |
| `docs/seesaawiki-rollback-plan.md` | 历史专题回滚文档候选；当前生产 rollback owner 已是 `RUNBOOK.md`，此文不应与全局运维入口并列。[VERIFIED: docs/seesaawiki-rollback-plan.md][VERIFIED: RUNBOOK.md] |

## 重复 / 冲突点

- `README.md` 与 `AGENTS.md` 重复了 quick start、项目结构、技术栈、开发命令、Gateway 访问规则和常见问题；两者都不像“短入口”。[VERIFIED: README.md][VERIFIED: AGENTS.md]
- `AGENTS.md` 与 `CLAUDE.md` 重复了 GitNexus 规则；`CLAUDE.md` 还复制了大段项目/架构/约定信息，已经形成第二份 agent 手册。[VERIFIED: AGENTS.md][VERIFIED: CLAUDE.md]
- `README.md` / `AGENTS.md` 对存储的表述仍是泛化的“R2 存图片和媒体文件”，而当前 `.planning` 已锁定“章节正文图走 source/external URL，R2 只保留必要资产”；这是语义冲突，不只是重复。[VERIFIED: README.md][VERIFIED: AGENTS.md][VERIFIED: .planning/phases/06-storage-policy-audit/06-STORAGE-POLICY.md][VERIFIED: .planning/STATE.md] |
- `RUNBOOK.md` 与 `06-STORAGE-POLICY.md` 都在描述存储规则；如果不明确“RUNBOOK = 当前长期 owner，06 = 历史快照”，后续 agent 很容易读错 source of truth。[VERIFIED: RUNBOOK.md][VERIFIED: .planning/phases/06-storage-policy-audit/06-STORAGE-POLICY.md][VERIFIED: .planning/phases/09-documentation-restructure/09-CONTEXT.md] |
- 旧 `docs/r2-mapping-*` 文档仍把部署、环境变量、备份/回滚说明写成活手册，而当前全局运维 owner 已是 `RUNBOOK.md`，当前 phase truth 已在 `.planning/*`；这会制造多入口冲突。[VERIFIED: docs/r2-mapping-storage-setup-guide.md][VERIFIED: docs/r2-mapping-quick-deploy-guide.md][VERIFIED: docs/r2-mapping-env-vars-guide.md][VERIFIED: docs/r2-mapping-deployment-checklist.md][VERIFIED: RUNBOOK.md][VERIFIED: .planning/ROADMAP.md] |

## 风险

- **Dirty working tree 已覆盖本 phase 的目标文件。** 当前已修改但未提交的目标文档包括 `.planning/REQUIREMENTS.md`、`.planning/ROADMAP.md`、`.planning/STATE.md`、`AGENTS.md`、`CLAUDE.md`、`RUNBOOK.md`；执行阶段若做大改、重排或批量移动，极易覆盖现有未提交内容。[VERIFIED: git status --short]
- **Dirty working tree 还包含无关代码改动和未跟踪的 Phase 8 产物。** Planner 必须避免 `git add .`、repo-wide format、广义“清理旧文件”操作，否则会把无关代码和 `08-*` 产物一起卷入。[VERIFIED: git status --short]
- **先删后迁移会打断入口。** `README.md` / `AGENTS.md` / `CLAUDE.md` 当前虽然臃肿，但仍是入口；Phase 9 必须先落 owner 索引，再删长段正文或迁归档文档。[VERIFIED: README.md][VERIFIED: AGENTS.md][VERIFIED: CLAUDE.md][VERIFIED: .planning/phases/09-documentation-restructure/09-CONTEXT.md] |
- **误删历史证据会直接违背 DOC-03。** v1.0 证据目前集中在 `.planning/milestones/v1.0-MILESTONE-AUDIT.md` 与 `.planning/milestones/v1.0-phases/`；Phase 9 只能重分 root/docs 入口，不能损伤 milestone evidence。[VERIFIED: .planning/REQUIREMENTS.md][VERIFIED: .planning/MILESTONES.md][VERIFIED: .planning/phases/09-documentation-restructure/09-CONTEXT.md] |
- **把 phase 细节整段搬进 RUNBOOK 会复刻重复问题。** RUNBOOK 只该吸收长期合同，不该复制 inventory、dry-run 报告模板或 phase 级限制全文。[VERIFIED: RUNBOOK.md][VERIFIED: .planning/phases/06-storage-policy-audit/06-STORAGE-POLICY.md][VERIFIED: .planning/phases/09-documentation-restructure/09-CONTEXT.md] |

## 推荐 Plan Lanes

1. **Lane 0: Worktree safety gate**  
   先冻结允许改动的文件集合，只在文档目标文件内工作；明确禁止批量暂存、批量重命名、批量删除无关脏文件。[VERIFIED: git status --short]

2. **Lane 1: Root entrypoint slimming**  
   先收敛 `README.md`、`AGENTS.md`、`CLAUDE.md` 的 owner 边界：`README` 保留人类入口，`AGENTS` 保留硬规则与索引，`CLAUDE` 压成 adapter。[VERIFIED: README.md][VERIFIED: AGENTS.md][VERIFIED: CLAUDE.md][VERIFIED: .planning/phases/09-documentation-restructure/09-CONTEXT.md]

3. **Lane 2: RUNBOOK consolidation**  
   把长期有效的 storage policy 摘要、cleanup/remediation、rollback 注意事项明确收口到 `RUNBOOK.md`；Phase 6/8 artifact 只留链接与历史语境。[VERIFIED: RUNBOOK.md][VERIFIED: .planning/phases/06-storage-policy-audit/06-STORAGE-POLICY.md][VERIFIED: .planning/phases/08-cost-guardrails/08-VERIFICATION.md]

4. **Lane 3: Docs triage and archive moves**  
   逐个分类 `docs/` 中的旧 R2 mapping 文档、测试报告、完成总结；能明确为历史材料的迁入 `docs/archive/` 或标 `superseded`，并从活入口索引移除。[VERIFIED: docs listing][VERIFIED: .planning/phases/09-documentation-restructure/09-CONTEXT.md]

5. **Lane 4: Link cleanup and evidence preservation**  
   清理重复正文后，确保 root docs 只链接到 canonical owner；同时确认 `.planning/milestones/v1.0*` 与 phase 6/8 artifacts 原地保留，不被文档重构误伤。[VERIFIED: .planning/MILESTONES.md][VERIFIED: .planning/phases/09-documentation-restructure/09-CONTEXT.md]

## 验证钩子

- **文件集钩子：** 执行前后都跑 `git status --short`；Phase 9 的变更集应只覆盖约定的文档文件和新增归档目录，不应再带出当前无关代码改动。[VERIFIED: git status --short]
- **入口瘦身钩子：** 人工或 grep 确认 `README.md` 与 `AGENTS.md` 都有短版“去哪读什么”索引；`AGENTS.md` 不再保留完整 quick start / 项目结构 / 技术栈长节；`CLAUDE.md` 只保留 adapter 内容。[VERIFIED: README.md][VERIFIED: AGENTS.md][VERIFIED: CLAUDE.md][VERIFIED: .planning/phases/09-documentation-restructure/09-CONTEXT.md]
- **RUNBOOK owner 钩子：** 确认 `RUNBOOK.md` 继续承载 rollback、R2 audit、cleanup/remediation 和稳定 storage contract；phase 6/8 文档只作为历史链接存在。[VERIFIED: RUNBOOK.md][VERIFIED: .planning/phases/06-storage-policy-audit/06-STORAGE-POLICY.md][VERIFIED: .planning/phases/08-cost-guardrails/08-VERIFICATION.md]
- **Archive 钩子：** 被迁出的旧文档必须标注 `superseded` 或进入 `docs/archive/`，且活入口索引不再把它们当 canonical owner。[VERIFIED: .planning/phases/09-documentation-restructure/09-CONTEXT.md][VERIFIED: docs listing]
- **Evidence preservation 钩子：** `.planning/milestones/v1.0-MILESTONE-AUDIT.md`、`.planning/milestones/v1.0-phases/`、`06-STORAGE-POLICY.md`、`08-VERIFICATION.md` 仍存在且路径不变。[VERIFIED: .planning/MILESTONES.md][VERIFIED: .planning/phases/06-storage-policy-audit/06-STORAGE-POLICY.md][VERIFIED: .planning/phases/08-cost-guardrails/08-VERIFICATION.md]
