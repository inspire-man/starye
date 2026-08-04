# Phase 16: Task Domain Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-30
**Phase:** 16-Task Domain Foundation
**Areas discussed:** 重复发起与排队、取消与重试语义、日志与留存边界、回调可信边界

---

## 重复发起与排队

| Decision | Alternatives considered | Selected |
|---|---|---|
| 活动模板重复发起 | 返回当前任务 / 明确拒绝 / 创建等待队列 | 返回当前任务 |
| 运行状态起点 | 首心跳后运行 / dispatch 后运行 / 保持排队到终态 | 首心跳后运行 |
| runner 失联 | 60 秒心跳、10 分钟失败 / 30 分钟失败 / 仅告警 | 60 秒心跳、10 分钟失败 |
| lease 互斥范围 | 控制面全局模板 / 按执行器 / 按操作者 | 控制面全局模板 |

**User's choice:** 活动执行幂等、明确分发态与运行态、可续租 lease、跨执行器互斥。
**Notes:** GitHub Actions、本地 runner 与未来定时任务均不得绕过同模板活动 lease。

---

## 取消与重试语义

| Decision | Alternatives considered | Selected |
|---|---|---|
| 取消状态 | 协作确认 / 立即取消 / 仅运行态可取消 | 协作确认 |
| 取消完成竞态 | 有效 receipt 优先 / 取消优先 / 人工待决 | 有效 receipt 优先 |
| 重试身份 | 同任务新增 attempt / 克隆新任务 / 复用原 attempt | 同任务新增 attempt |
| 重试触发 | 仅手动 / 分发前自动一次 / 固定次数自动 | 仅手动 |

**User's choice:** 取消请求与实际终态分离；实际入库 receipt 证明成功；失败记录不可覆盖；不采用自动重试。
**Notes:** receipt 成功而取消未生效时，需要显式审计该竞态。

---

## 日志与留存边界

| Decision | Alternatives considered | Selected |
|---|---|---|
| 日志粒度 | 结构化事件 / 外加脱敏控制台文本 / 仅终态 | 结构化事件 |
| 容量 | 4 KiB/500 条 / 16 KiB/2,000 条 / 无上限 | 4 KiB/500 条 |
| 留存 | 90 天 / 30 天 / 永久明细 | 90 天 |
| 脱敏位置 | API 写入前 / Dashboard 展示前 / runner 自行保证 | API 写入前 |

**User's choice:** 结构化、限量、90 天明细留存，API 先脱敏再持久化。
**Notes:** 终态错误和 receipt 摘要不受普通日志截断影响。

---

## 回调可信边界

| Decision | Alternatives considered | Selected |
|---|---|---|
| 回调密钥 | 独立 HMAC / 复用 CRAWLER_SECRET / 每模板长期密钥 | 独立 HMAC |
| 重放防护 | 5 分钟 + D1 幂等 / 30 分钟 + D1 幂等 / 仅 HMAC | 5 分钟 + D1 幂等 |
| 乱序事件 | 条件更新、终态不可逆 / 拒绝所有乱序 / 后到覆盖 | 条件更新、终态不可逆 |
| 密钥轮换 | 当前+上一版本 24 小时 / 硬切换 / 永久兼容 | 当前+上一版本 24 小时 |

**User's choice:** 环境隔离的 runner-event HMAC、短时间窗抗重放、状态不可逆、有限双版本轮换。
**Notes:** `key_id` 可公开携带，密钥值只存于本地或生产受管 secret。

---

## the agent's Discretion

- 表/字段/路由/事件码命名、分页游标和具体 migration 编号可在不违背 CONTEXT.md 约束的前提下确定。

## Deferred Ideas

- 实时日志/通知、额外 crawler 模板与任务定时策略编辑：未来需求。
- 本地执行验收、GitHub Actions 编排、Dashboard 完整操作面和 RUNBOOK：按既定路线留在 Phase 17–19。
