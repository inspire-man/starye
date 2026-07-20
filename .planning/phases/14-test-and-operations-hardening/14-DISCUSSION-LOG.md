# Phase 14: Test and Operations Hardening - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-20
**Phase:** 14-Test and Operations Hardening
**Areas discussed:** 域名字面量的允许清单与测试门禁, 静态审计的失败策略, RUNBOOK 的操作编排, 最终证据矩阵的真相规则

---

## 域名字面量的允许清单与测试门禁

| Option | Description | Selected |
|--------|-------------|----------|
| 严格允许清单并做自动门禁 | 仅允许显式 default target、legacy-alias rejection 和命名 fixture；其余 active 命中必须迁移。 | ✓ |
| 允许清单仅文档化 | 记录允许文件但依赖人工 review。 | |
| 全部运行时与测试去默认域名 | 连 default-target fixture 也不保留。 | |

**User's choice:** 严格允许清单并做自动门禁。
**Notes:** 首次 Phase 14 green run 必须清零未分类命中。

| Option | Description | Selected |
|--------|-------------|----------|
| 从 selected target 生成最终 `_redirects` | 构建前物化 canonical domain，保留 pages.dev source、path 和 SPA fallback。 | ✓ |
| 保留默认域名静态文件 | 将现有 `_redirects` 纳入允许清单并靠人工切换。 | |
| 移除 Pages 直链跳转 | pages.dev 不再跳回 canonical gateway domain。 | |

**User's choice:** 从 selected target 生成最终 `_redirects`。
**Notes:** tracked source template 不能再把默认域名作为运行时事实。

---

## 静态审计的失败策略

| Option | Description | Selected |
|--------|-------------|----------|
| 仅审计受 Git 跟踪的 active source、配置与测试 | 排除 docs、`.planning`、构建输出、被忽略本地 env/临时 projection。 | ✓ |
| 受 Git 跟踪的所有文件 | 同时审计文档与规划工件。 | |
| 只审计生产 source/config | 不检查测试 fixture。 | |

**User's choice:** 仅审计受 Git 跟踪的 active source、配置与测试。
**Notes:** RUNBOOK 和 matrix 各自验证文档与 evidence accuracy，不将其混入 literal gate。

| Option | Description | Selected |
|--------|-------------|----------|
| 首次落地即零个未分类命中 | 全部现有 active residual 都必须迁移、分类或移除。 | ✓ |
| 基线递减 | 只阻止后续新增。 | |
| 仅输出审计报告 | 暂不将 audit 作为失败条件。 | |

**User's choice:** 首次落地即零个未分类命中。
**Notes:** 不接受 baseline-ratchet。

---

## RUNBOOK 的操作编排

| Option | Description | Selected |
|--------|-------------|----------|
| target-first 运行手册 | selected target + preflight 后依序 projection、deploy/migrate/crawl、smoke、rollback/recovery。 | ✓ |
| 按应用/资源拆章节 | 每个 service 维护独立完整流程。 | |
| 保持现有结构 | 仅替换固定 domain/resource 文本。 | |

**User's choice:** target-first 运行手册。
**Notes:** resource-specific 细节可作为 target-first steps 的子项。

| Option | Description | Selected |
|--------|-------------|----------|
| 引用 profile 作为唯一 source，并给出名称、消费者、存放位置和验证入口矩阵 | 不复制 resource 或 secret 值。 | ✓ |
| 为每个 target 完整抄录资源和 secret 名称 | RUNBOOK 成为第二份配置。 | |
| 仅保留泛化提示 | 不列出 consumers 或 validation entry。 | |

**User's choice:** 引用 profile 作为唯一 source，并给出验证矩阵。
**Notes:** local/CI identity boundary 保持不变。

| Option | Description | Selected |
|--------|-------------|----------|
| 分阶段命令与结果分流 | `passed`、`failed`、`checkpoint` 有不同继续/停止和恢复路径。 | ✓ |
| 只保留成功路径 | 失败统一落到常见故障。 | |
| 将 smoke 降为可选检查 | deploy 成功即可完成。 | |

**User's choice:** 分阶段命令与结果分流。
**Notes:** terminal `passed` 才可记录完成。

| Option | Description | Selected |
|--------|-------------|----------|
| 有界人工恢复清单 | 停止 mutation、保存 evidence、分类 checkpoint、preflight 后回滚/恢复、以新 run 验证。 | ✓ |
| 自动化一键恢复 | 自动选择版本、回退 Pages 和恢复 D1。 | |
| 仅描述故障现象 | 不定义 evidence/stop/retry 规则。 | |

**User's choice:** 有界人工恢复清单。
**Notes:** Pages manual rollback 和 D1 recovery 边界不被放宽。

---

## 最终证据矩阵的真相规则

| Option | Description | Selected |
|--------|-------------|----------|
| 逐 requirement 链接 canonical verifier、命令和工件，并保留原始状态 | verifier 优先，禁止把 contract test 升级为 provider proof。 | ✓ |
| 以 REQUIREMENTS checkbox 为完成状态 | 忽略上游 verifier 冲突。 | |
| 只记录 Phase 14 新测试与文档 | 不回链 Phase 11-13。 | |

**User's choice:** canonical verifier、command/test 和 artifact 优先。
**Notes:** Phase 13 当前 `gaps_found` 必须被矩阵原样呈现。

| Option | Description | Selected |
|--------|-------------|----------|
| 一张完整的 30 行矩阵，并有自动完整性校验 | 校验 requirement 集合、重复项与本地 evidence path。 | ✓ |
| 每个 phase 一张摘要 | 不逐项展开 30 个 requirement。 | |
| 纯手工 release checklist | 不校验覆盖与链接。 | |

**User's choice:** 一张完整的 30 行矩阵，并有自动完整性校验。
**Notes:** 每行须有 status、source phase 和 command/test/artifact 指向。

| Option | Description | Selected |
|--------|-------------|----------|
| 显式标为 `blocked` 或 `deferred`，附恢复前置条件与下一条操作命令 | 不执行远程命令。 | ✓ |
| 以静态合同标为 `verified` | 用回归测试替代 provider proof。 | |
| 暂不生成矩阵 | 等所有 external run 完成。 | |

**User's choice:** 显式 `blocked` / `deferred` 交接。
**Notes:** checkpoint 和缺失 artifact 要保留在最终映射中。

| Option | Description | Selected |
|--------|-------------|----------|
| Phase 14 verification/evidence artifact | 随 milestone evidence archive 保存；RUNBOOK 保持稳定操作 owner。 | ✓ |
| RUNBOOK.md 直接保存完整矩阵 | 将执行 evidence 混入 live operations doc。 | |
| 新建 docs/ 专题文档 | 增加第三个长期 owner。 | |

**User's choice:** Phase 14 verification/evidence artifact。
**Notes:** 文档 owner 边界保持不变。

---

## the agent's Discretion

- 审计实现、allowlist schema、redirect materialization 和矩阵完整性校验的具体代码组织。
- Phase 14 内的计划拆分与验证命令，只要每个 requirement 都获得可执行证据。

## Deferred Ideas

- Phase 13 的 fresh local release、provider-backed tuple 和 selected-production browser closure 仍按其 verifier-driven gap path 执行。
- Cloudflare IaC、跨账户流量迁移、多 target scheduling 和自动化 destructive recovery 留待未来 milestone。
