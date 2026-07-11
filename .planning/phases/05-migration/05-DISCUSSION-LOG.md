# Phase 5: 部署基础盘 + 可观测骨架 + Migration 安全 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-13
**Phase:** 05-部署基础盘 + 可观测骨架 + Migration 安全
**Areas discussed:** deploy trigger strategy, rollback shape, migration safety, observability scope, runbook/ops baseline

---

## Deploy Trigger Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| 保持 `push main + workflow_dispatch` | 沿用现有 workflow 触发方式，增强护栏即可 | ✓ |
| 改成更复杂的 release/tag/promote 流 | 引入额外审批与环境分层 | |
| 合并成单一超大 deploy workflow | 统一入口但会显著提高单文件复杂度 | |

**User's choice:** 自动采用推荐项：保持现有 `push main + workflow_dispatch`
**Notes:** 当前仓库已经具备分 app deploy workflows，Phase 5 的目标是“正式化和防出错”，不是重写发布体系。

---

## Rollback Shape

| Option | Description | Selected |
|--------|-------------|----------|
| 新增统一 `rollback.yml` + app/version_id 参数 | Worker 回滚自动化，Pages 至少提供清晰人工路径 | ✓ |
| 分 app 各自维护 rollback workflow | 灵活但重复度高 | |
| 只写 RUNBOOK，不做 workflow | 太弱，不满足 phase 目标 | |

**User's choice:** 自动采用推荐项：统一 rollback workflow
**Notes:** v1 先优先保证“能回滚”，不追求 Pages 与 Workers 完全对称自动化。

---

## Migration Safety

| Option | Description | Selected |
|--------|-------------|----------|
| apply 前强制远程备份 + destructive diff gate | 最符合当前 Phase 4 之后的风险控制需求 | ✓ |
| 只做 apply，不做额外 guard | 风险过高 | |
| 引入复杂 schema diff 平台 | 超出 v1 必要复杂度 | |

**User's choice:** 自动采用推荐项：备份 + dangerous change gate
**Notes:** 当前 milestone 刚完成统一 progress cutover，D1 migration 安全是高优先级。

---

## Observability Scope

| Option | Description | Selected |
|--------|-------------|----------|
| 一个 Sentry 项目统一收口，先做骨架和第一轮过滤 | ✓ |
| 每个 app 独立 Sentry 项目 | |
| 暂不接入 Sentry，只保留 console / Workers logs | |

**User's choice:** 自动采用推荐项：统一 Sentry 项目
**Notes:** v1 目标是先让错误可见，细分项目和更深层指标治理可后置。

---

## RUNBOOK / Ops Baseline

| Option | Description | Selected |
|--------|-------------|----------|
| 以根 `RUNBOOK.md` 为唯一正式运维手册 | ✓ |
| 每个 phase / app 写各自 runbook | |
| 仅在 workflow 注释中记录 | |

**User's choice:** 自动采用推荐项：单一 RUNBOOK
**Notes:** 需要吸收 Phase 2 的 WAF 手配记录和 Phase 4 的 migration smoke，避免运维知识继续分散。

---

## the agent's Discretion

- destructive migration gate 的具体技术实现留给 planner 在现有 workflow/CI 约束下选择
- Pages 回滚如果 Cloudflare 当前 CLI 能力不对称，可先以“workflow + RUNBOOK 明确人工路径”落地
- Sentry 初始化落在入口文件还是 observability 模块，由 planner 结合现有结构决定

## Deferred Ideas

- staging / preview 环境体系
- Sentry 噪音二次治理
- 自建 APM / Grafana / 指标平台
- crawler 可靠性增强专项
