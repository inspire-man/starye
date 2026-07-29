# Phase 15: Reconcile v1.2 evidence matrix with Phase 13 closeout - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-29
**Phase:** 15-reconcile-v1-2-evidence-matrix-with-phase-13-closeout
**Areas discussed:** 证据优先级、收敛规则、外部验证边界

---

## 证据优先级

| Decision | Selected choice | Alternatives considered |
|---|---|---|
| Truth source | Phase 13 verifier/receipts 优先 | Phase 14 matrix 优先；REQUIREMENTS checkbox 优先 |
| Status representation | `verified` / `partial` / `blocked` / `deferred`，并保留恢复信息 | 二态；仅最终状态 |
| Historical artifacts | 保持不可改写，新增 Phase 15 reconciliation/closeout | 回写 verifier；仅更新 STATE |
| Requirements checkbox | 保持 traceability，实时状态由 verifier 决定 | 回退 checkbox；新增实时状态列 |

**User's choice:** 1、1、1、1。
**Notes:** 静态 matrix 绿灯不能替代 Phase 13 的 live/provider proof。

---

## 收敛规则

| Decision | Selected choice | Alternatives considered |
|---|---|---|
| Validation budget | 最多两轮，第二轮条件触发 | 恰好一轮；无条件两轮 |
| First-round coverage | 全 30 项 evidence 来源、状态、路径与 matrix CLI；无 remote | 重跑全栈浏览器 smoke；仅 Phase 13/14 |
| Second-round trigger | 新的、run 绑定 Phase 13 terminal artifact | 任意 Phase 13 文件变化；无条件执行 |
| Exit semantics | Phase 15 可作为对账完成关闭，不升级 Phase 13/v1.2 | 自动再规划；matrix 绿灯即完成里程碑 |

**User's choice:** 1、1、1、1。
**Notes:** 第三轮或自动 replan 被明确排除。

---

## 外部验证边界

| Decision | Selected choice | Alternatives considered |
|---|---|---|
| Remote operation | Phase 15 仅本地、只读对账 | 自动尝试远程；永久移除远程证明 |
| Handoff content | 状态、缺失 evidence、前置条件、下一条命令、显式授权边界 | 泛化人工说明；不记录 |
| Future proof update | 先经 Phase 13 run/verifier，再新开 reconciliation | 回写本次 closeout；手工改 matrix |
| Blocked detail | 结构化、非敏感原因与恢复条件 | 写会话/凭据；不解释 |

**User's choice:** 1、1、1、1。
**Notes:** cookie、token、endpoint 和会话内容不进入 evidence。

---

## the agent's Discretion

- 复用现有 typed matrix contract、只读 CLI 和测试模式；具体 report schema 可由 planner 选择。
- 任何子代理运行以 30 分钟为上限，超时后记录观察结果并收敛为 handoff。

## Deferred Ideas

- 本地 Dashboard signed-session 与 provider-backed data-chain proof 继续由 Phase 13 的显式、已授权 handoff 承接。
