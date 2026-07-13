# Phase 9: Documentation Restructure - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-13
**Phase:** 9-Documentation Restructure
**Areas discussed:** 文档职责切分, AGENTS 瘦身范围, 历史材料归档边界, 存储策略正式落点

---

## 文档职责切分

### 根目录文档职责

| Option | Description | Selected |
|--------|-------------|----------|
| 职责切开 | `README` = 人类入口；`AGENTS` = agent 规则；`RUNBOOK` = 运维；`.planning` = 当前真相；`docs` = 主题长文；`openspec` = 规格/变更历史 | ✓ |
| README / AGENTS 双入口并行承载大量操作内容 | 一个偏人、一个偏 agent，但都保留较多正文 | |
| 极简 README | 大量信息整体下沉到 `AGENTS` / `RUNBOOK` / `.planning` | |
| 其他 | 用户自由定义 | |

**User's choice:** 职责切开  
**Notes:** 用户明确要把 canonical owner 切清楚，而不是继续维护多份平行说明。

### 重复信息裁决规则

| Option | Description | Selected |
|--------|-------------|----------|
| 单 owner | 一类信息只允许一个 canonical owner，其他地方只保留摘要和链接 | ✓ |
| 精简摘录 | `README` / `AGENTS` 允许保留更多摘录，但细节有唯一 owner | |
| 多处完整保留 | 允许多份完整说明并靠人工同步 | |
| 其他 | 用户自由定义 | |

**User's choice:** 单 owner  
**Notes:** 用户明确反对继续复制完整内容。

### 冲突时的优先级

| Option | Description | Selected |
|--------|-------------|----------|
| 执行期先信 `.planning` | 稳定后再沉淀回长期文档，归档不反向覆盖当前规则 | ✓ |
| 长期文档优先 | `README` / `RUNBOOK` / `docs` 一旦写下就高于 `.planning` | |
| OpenSpec 永远最高 | `openspec` 总是覆盖 `.planning` | |
| 其他 | 用户自由定义 | |

**User's choice:** 执行期先信 `.planning`  
**Notes:** 这条规则直接决定了 Phase 9 之后的文档回写节奏。

### 入口索引形式

| Option | Description | Selected |
|--------|-------------|----------|
| 双索引 | `README` 和 `AGENTS` 都提供很短的“去哪读什么”索引 | ✓ |
| 只在 `AGENTS` 放索引 | `README` 继续做普通项目入口 | |
| 只在 `README` 放索引 | `AGENTS` 只保留规则和链接 | |
| 其他 | 用户自由定义 | |

**User's choice:** 双索引  
**Notes:** 用户要同时优化人类入口和 agent 入口。

---

## AGENTS 瘦身范围

### `AGENTS.md` 最终粒度

| Option | Description | Selected |
|--------|-------------|----------|
| 规则 + 索引 + 高风险提醒 | 不再保留完整 quick start / 项目结构 / 技术栈 / 常见问题 | ✓ |
| 规则 + 索引 + 速查命令 | 额外保留部分常用命令和本地入口 | |
| 压缩版总手册 | 继续保留较完整 repo 手册，只是缩短 | |
| 其他 | 用户自由定义 | |

**User's choice:** 规则 + 索引 + 高风险提醒  
**Notes:** 用户明确不要再让 `AGENTS.md` 承担项目百科角色。

### 硬规则保留程度

| Option | Description | Selected |
|--------|-------------|----------|
| 只留 5-10 条硬规则 | 忘了就容易做错，其余全部链接出去 | ✓ |
| 不留硬规则 | `AGENTS` 只做目录和链接 | |
| 保留更宽的速查 | 除硬规则外再放常用命令 | |
| 其他 | 用户自由定义 | |

**User's choice:** 只留 5-10 条硬规则  
**Notes:** 用户仍要当场可执行的防错规则，但数量必须受控。

### `CLAUDE.md` 处理方式

| Option | Description | Selected |
|--------|-------------|----------|
| 薄适配层 | `AGENTS.md` 为唯一 canonical agent 文档；`CLAUDE.md` 只保留最少适配说明 | ✓ |
| 更完整的 Claude 手册 | `CLAUDE.md` 继续承担更大正文 | |
| 直接移除 | 只保留 `AGENTS.md` | |
| 其他 | 用户自由定义 | |

**User's choice:** 薄适配层  
**Notes:** 用户不希望镜像文档继续漂移成第二个 owner。

### GitNexus 区块收口

| Option | Description | Selected |
|--------|-------------|----------|
| 只留 3-4 条硬规则 | 比如 impact / detect-changes，长说明移为链接 | ✓ |
| 完整保留整块 | 继续在 `AGENTS.md` 内保留长说明和资源表 | |
| 全部移除 | 只保留一个 GitNexus 链接 | |
| 其他 | 用户自由定义 | |

**User's choice:** 只留 3-4 条硬规则  
**Notes:** 这部分必须满足“高风险强提醒”而不是“长篇重复介绍”。

---

## 历史材料归档边界

### v1.0 执行证据的 owner

| Option | Description | Selected |
|--------|-------------|----------|
| `.planning/milestones/...` | v1.0 phase / milestone 执行证据统一以 milestone archive 为准 | ✓ |
| `.planning` + `docs` 并存 | 两边都保留同类历史报告 | |
| 迁到 `docs/history` | 尽量把 phase 证据移出 `.planning` | |
| 其他 | 用户自由定义 | |

**User's choice:** `.planning/milestones/...`  
**Notes:** 用户明确不希望根目录或 `docs/` 继续承接同类 phase 证据。

### `docs/` 中旧 Markdown 的分流

| Option | Description | Selected |
|--------|-------------|----------|
| 活文档 only | `docs/` 只保留仍有稳定参考价值的文档 | ✓ |
| 活文档和历史文档混放 | 靠命名区分 | |
| 尽量不动 | 通过索引标记是否过时 | |
| 其他 | 用户自由定义 | |

**User's choice:** 活文档 only  
**Notes:** 用户要彻底分开“现在该读什么”和“历史上发生过什么”。

### 被当前规则推翻的旧文档处理

| Option | Description | Selected |
|--------|-------------|----------|
| 迁归档并标 `superseded` | 不删，标明被哪份当前文档取代，并从活索引移除 | ✓ |
| 直接删除 | 当前规则吸收后就删掉旧文档 | |
| 继续留在 `docs/` | 只在文件头加过时提醒 | |
| 其他 | 用户自由定义 | |

**User's choice:** 迁归档并标 `superseded`  
**Notes:** 用户要保留历史价值，但不允许继续混淆当前入口。

### 归档区落点

| Option | Description | Selected |
|--------|-------------|----------|
| 执行证据留 `.planning`，文档历史进 `docs/archive/` | 两类归档边界分明 | ✓ |
| 全部进 `.planning/milestones/...` | 包括 `docs/` 迁出的旧文档 | |
| 全部在 `docs/` 下归档 | 不再使用 `.planning` 作为归档面 | |
| 其他 | 用户自由定义 | |

**User's choice:** 执行证据留 `.planning`，文档历史进 `docs/archive/`  
**Notes:** 用户要让 phase/milestone 证据归档与普通文档归档并行但不混淆。

---

## 存储策略正式落点

### 长期 owner

| Option | Description | Selected |
|--------|-------------|----------|
| `RUNBOOK.md` | 长期生效的 storage policy / operations 合同由 RUNBOOK 承接 | ✓ |
| `06-STORAGE-POLICY.md` | phase policy 长期继续当 canonical owner | |
| 新建长期专题文档 | 例如 `docs/storage-policy.md` | |
| 其他 | 用户自由定义 | |

**User's choice:** `RUNBOOK.md`  
**Notes:** 用户不希望长期规则继续依赖 phase artifact。

### Phase policy 文档稳定后的角色

| Option | Description | Selected |
|--------|-------------|----------|
| 历史快照 | 保留在 phase 目录里，不再作为活文档 | ✓ |
| 与 RUNBOOK 长期并存 | 一个偏策略，一个偏操作 | |
| 稳定后删除 | 只保留 RUNBOOK | |
| 其他 | 用户自由定义 | |

**User's choice:** 历史快照  
**Notes:** 用户同时要历史决策留痕和长期 owner 单一化。

### RUNBOOK 吸收深度

| Option | Description | Selected |
|--------|-------------|----------|
| 只吸收长期规则与操作合同 | 允许/禁止用途、审计 stop conditions、cleanup/remediation、rollback 注意事项 | ✓ |
| 尽量自足 | 连背景、字段定义、详细模板都一起吸收 | |
| 只保留操作步骤 | 策略定义继续主要留在 `.planning` | |
| 其他 | 用户自由定义 | |

**User's choice:** 只吸收长期规则与操作合同  
**Notes:** 用户明确把 inventory 明细、dry-run 模板和阶段分析留在 `.planning`。

### 执行期与长期文档的回写节奏

| Option | Description | Selected |
|--------|-------------|----------|
| 先写 `.planning`，closeout 回写 `RUNBOOK` | 稳定后同步长期规则，并将旧入口标 `superseded` | ✓ |
| 规则一变立刻同步 `RUNBOOK` | 不等 phase closeout | |
| 只在 milestone closeout 统一更新 | 平时全部留在 `.planning` | |
| 其他 | 用户自由定义 | |

**User's choice:** 先写 `.planning`，closeout 回写 `RUNBOOK`  
**Notes:** 这与“执行期先信 `.planning`”的全局规则保持一致。

---

## the agent's Discretion

- `README.md` 与 `AGENTS.md` 索引表的具体排版和字段命名。
- `AGENTS.md` 最终 5-10 条硬规则的精确取舍。
- `docs/` 下具体文件的活文档 / archive 归类细则，只要不越过已锁定边界。

## Deferred Ideas

None — discussion stayed within phase scope.
