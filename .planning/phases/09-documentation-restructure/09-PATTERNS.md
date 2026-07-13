# Phase 09: Documentation Restructure - Pattern Map

**Mapped:** 2026-07-13
**Files analyzed:** 7
**Analogs found:** 6 / 7

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `AGENTS.md` | root entry doc | agent guidance / index routing | `.planning/PROJECT.md` + current `AGENTS.md` hard-rule sections | role-match |
| `README.md` | root entry doc | human onboarding / index routing | current `README.md` top-level structure + `.planning/PROJECT.md` milestone summary | role-match |
| `CLAUDE.md` | adapter doc | agent-specific redirect / compatibility | current `CLAUDE.md` project-start block + target thin-wrapper pattern inferred from Phase 9 decisions | partial-match |
| `RUNBOOK.md` | operations doc | owner-facing procedures / stable policy | current `RUNBOOK.md` section structure, especially `## 1` and `## 7` | exact |
| `docs/archive/*` or archive marker docs | archive doc | historical preservation / superseded routing | `.planning/milestones/v1.0-MILESTONE-AUDIT.md` + historical docs in `docs/*.md` | role-match |
| `.planning/ROADMAP.md` | planning index | wave annotation / plan inventory | current Phase 8 roadmap section | exact |
| `.planning/STATE.md` | workflow state doc | phase-status sync / next-step routing | current `STATE.md` phase 8 -> phase 9 transition block | exact |

## Pattern Assignments

### `AGENTS.md` (root entry doc, agent guidance / index routing)

**Primary analog:** `.planning/PROJECT.md`  
**Supplementary analog:** current `AGENTS.md` sections `中文协作约定` and `GitNexus — Code Intelligence`

**Concise rule block pattern** (`.planning/PROJECT.md` top sections):

- 先说明项目是什么、当前 milestone 是什么、核心约束是什么。
- 章节短，强调决策和边界，不展开成完整手册。

**Hard-rule list pattern** (current `AGENTS.md` useful retained areas):

- `中文协作约定`
- Gateway-only local access warning
- GitNexus hard rules

**Apply to this file:**

- 最终形状应是 `项目一句话 -> 必读文档索引 -> 5-10 条硬规则 -> GitNexus 短规则`。
- 保留最容易做错的 repo 边界，移除完整 quick start / tech stack / FAQ / crawler tutorial。
- 每一类信息给 canonical owner 链接，不在 `AGENTS.md` 复制正文。

---

### `README.md` (root entry doc, human onboarding / index routing)

**Primary analog:** current `README.md` top-level outline  
**Supplementary analog:** `.planning/PROJECT.md`

**Current overview pattern** (`README.md:1-35`):

- 标题
- 一句话项目介绍
- 项目结构 / 技术栈

**Milestone summary pattern** (`.planning/PROJECT.md:11-21`):

- `Current Milestone`
- `Goal`
- `Target features`

**Apply to this file:**

- 保留人类读者真正需要的最短入口：项目简介、当前里程碑、最小本地启动、去哪读什么。
- 具体技术栈、全量功能、详细运维和 agent 规则都改成摘要 + 链接。
- 适合用一个主题索引表把 `RUNBOOK`、`.planning`、`docs/`、`openspec/` 串起来。

---

### `CLAUDE.md` (adapter doc, agent-specific redirect / compatibility)

**Primary analog:** current `CLAUDE.md` 的 `Project` 头部  
**Supplementary analog:** Phase 9 决议中的“薄适配层”要求

**Apply to this file:**

- 不再承载从 `.planning/codebase/*` 镜像来的大段栈/结构/约定内容。
- 只保留：`本仓库 canonical agent 文档是 AGENTS.md`、极少量 Claude 专属兼容说明、必要链接。
- 如果需要引用更细节内容，直接链向 `AGENTS.md`、`.planning/PROJECT.md`、`RUNBOOK.md`。

**No exact analog:** 仓库里当前没有真正的“薄适配层”示例，这部分要按 Phase 9 决议新建最小模式。

---

### `RUNBOOK.md` (operations doc, owner-facing procedures / stable policy)

**Primary analog:** current `RUNBOOK.md` section structure  
**Best examples:** `## 1. 运维入口总览`, `## 3. Rollback 流程`, `## 7. R2 成本护栏`

**Section organization pattern:**

- 章节编号清晰
- 先给总览 / 原则，再给步骤 / checklist / stop conditions
- 使用表格列出入口、阈值、回滚路径

**Apply to this file:**

- Phase 9 不需要重写 RUNBOOK，只需要强化“它是长期 storage policy / cleanup / rollback owner”的入口语义。
- Phase 6/8 的稳定规则回写或交叉链接应沿用现有章节化结构，不新建平行专题文档替代 RUNBOOK。

---

### `docs/archive/*` and archive marker docs (archive doc, historical preservation / superseded routing)

**Primary analog:** `.planning/milestones/v1.0-MILESTONE-AUDIT.md`  
**Supplementary analog:** current historical docs under `docs/*.md`

**Archive index pattern** (`.planning/MILESTONES.md` + `v1.0-MILESTONE-AUDIT.md`):

- 明确“已交付什么 / 归档在哪里 / 已接受什么历史债”
- 把 archive 当索引与证据入口，而不是活指南首页

**Apply to this file set:**

- `docs/archive/` 里的迁档文档应加明显的 `superseded` / `historical` 头部说明。
- 说明取代它的当前 owner 是谁，例如 `RUNBOOK.md` 或 `.planning/milestones/...`。
- archive 文档继续保留原内容主体，重点是加身份标签和从活索引移除。

---

### `.planning/ROADMAP.md` (planning index, wave annotation / plan inventory)

**Primary analog:** current Phase 8 section in `.planning/ROADMAP.md`

**Reusable pattern:**

- `Goal`
- `Requirements`
- `Plans: N/N plans complete`
- Wave 标头
- 每个 `*-PLAN.md` 的一句话说明

**Apply to this file:**

- Phase 9 应补出与前面 phases 一致的 `Plans:`、`Wave` 和 plan summary。
- 如果有 cross-cutting constraints，沿用已有 phase 的简洁说明风格，不额外发明新格式。

---

### `.planning/STATE.md` (workflow state doc, phase-status sync / next-step routing)

**Primary analog:** current `STATE.md` phase transition blocks

**Reusable pattern:**

- frontmatter: `current_phase`, `status`, `stopped_at`, `last_activity_desc`
- body: `Current Position`, `Next recommended action`, `Operator Next Steps`

**Apply to this file:**

- planning 完成后只做最小状态同步：从 `ready_for_discussion` 切到 planned/ready-to-execute 语义。
- `Next recommended action` 应直接给 `$gsd-execute-phase 9`，不要写宽泛说明。
- 更新时必须保留已有 phase 8 closeout 与 open todos，不覆盖当前 dirty 内容。

## Shared Patterns

### Short Index Tables

**Sources:** current `RUNBOOK.md` summary tables, `ROADMAP.md` phase table

- 适用于 `README.md` / `AGENTS.md` 的“去哪读什么”入口表。
- 表项应包含：主题、canonical owner、什么时候读、什么时候更新。

### Superseded Marking

**Sources:** Phase 9 decisions + existing archive/index style

- 迁档文档需要明确：
  - 当前状态：historical / superseded
  - 被哪份当前文档取代
  - 为什么不再是活入口

### Minimal-State Updates

**Sources:** `.planning/STATE.md`, `.planning/ROADMAP.md`

- 这两个 planning 文件只能做 workflow-level 最小改动。
- 当前 worktree 很脏，执行时必须先 re-read 文件，再最小 patch，避免覆盖用户未提交内容。

## No-Exact-Analog Notes

- `CLAUDE.md` 的“薄适配层”在仓库中没有成品示例，需按决议新建最小模式。
- `docs/archive/` 目前尚不存在，需要执行阶段一并创建目录和 superseded 模板。
