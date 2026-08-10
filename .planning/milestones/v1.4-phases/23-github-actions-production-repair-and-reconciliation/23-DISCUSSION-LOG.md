# Phase 23: GitHub Actions Production Repair And Reconciliation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-07
**Phase:** 23-GitHub Actions Production Repair And Reconciliation
**Areas discussed:** 生产 Provider 调度与修复范围, Provider 失败与重试策略, 迟到回调与 Reconciliation 规则, Dashboard 历史与状态分层

---

## 生产 Provider 调度与修复范围

| Option | Description | Selected |
|--------|-------------|----------|
| 复用现有 movie workflow，按 operation 分流 | 保留现有 provider registry、environment、target 和签名回调，在同一 workflow 内分流普通 movie 与 repair。 | ✓ |
| 新增专用 repair workflow | 用独立 workflow 隔离生产修复与日常抓取。 | |
| 由 agent 决定 | 由 agent 按既有 provider/runner 边界选择。 | |

| Option | Description | Selected |
|--------|-------------|----------|
| 只从 server-owned task snapshot 读取 | workflow dispatch 只传 run/attempt/template/target，operation 和 movie repair identity 以 task snapshot 为唯一事实。 | ✓ |
| workflow dispatch 同时显式传 operation 与 movieId | 服务端复制 repair identity 到 GitHub Actions inputs 并执行一致性校验。 | |
| 由 agent 决定 | 选择单一控制面事实的实现。 | |

| Option | Description | Selected |
|--------|-------------|----------|
| 共享现有 job，在 claim 后按 task snapshot 选择 adapter | target、lease、签名 callback 和 provider association 生命周期保持一致。 | ✓ |
| 同一 YAML 内拆成独立 repair job | 在同一 workflow 中为 repair 使用独立 job 和日志步骤。 | |
| 由 agent 决定 | 选择 operation-aware adapter registry 的最小分流。 | |

| Option | Description | Selected |
|--------|-------------|----------|
| Fail closed，记录 bounded contract failure | snapshot 契约错误进入受控终态，不回退普通 movie crawl。 | ✓ |
| 回退为普通 movie crawl | template 为 movie 时继续执行普通抓取。 | |
| 由 agent 决定 | 选择 fail-closed 契约边界。 | |

**User's choice:** 复用现有 movie workflow、以 task snapshot 为唯一 repair identity、共享 job 分流并对契约异常 fail closed。
**Notes:** Phase 23 保持 movie-only；浏览器执行继续位于 GitHub Actions。

---

## Provider 失败与重试策略

| Option | Description | Selected |
|--------|-------------|----------|
| 仅 transient provider/transport、timeout、run lost 或 lease 过期自动重试一次 | 确定性 snapshot、authorization 和 receipt contract failure 进入当前 attempt 终态。 | ✓ |
| 除契约错误外，所有 provider 失败自动重试一次 | provider 业务失败也自动产生新 attempt。 | |
| 生产 provider 失败全部由人工新 task 重试 | 自动 retry 只保留在人工流程。 | |
| 由 agent 决定 | 由 agent 选择 retryable 分类。 | |

| Option | Description | Selected |
|--------|-------------|----------|
| 同一 repair task 下创建新的 run/attempt | 新 attempt 获得新 lease/provider association，旧 run 历史保留。 | ✓ |
| 自动 retry 创建新的 task | 每次 retry 拆成新的 task 聚合。 | |
| 在原 run 内覆盖 attempt 状态 | 在同一 run 中修改 attempt。 | |
| 由 agent 决定 | 由 agent 选择历史组织。 | |

| Option | Description | Selected |
|--------|-------------|----------|
| dispatch transient 立即 retry；timeout/lost 等待 reconciliation window | 让 dispatch 波动快速恢复，同时给迟到 callback 留出窗口。 | ✓ |
| 所有 transient/timeout/lease 故障立即 retry | 故障发生后立即创建新 attempt。 | |
| 所有 retry 都由 window 结束后的统一 reconciliation 创建 | 所有 retry 都等待 reconciliation。 | |
| 由 agent 决定 | 由 agent 选择触发时机。 | |

| Option | Description | Selected |
|--------|-------------|----------|
| 将 retry 作为 task-level 派生状态 | 旧 run 保持 failed，新 run 使用 queued/dispatching 等已有状态。 | ✓ |
| 新增显式 run 状态 retry/retrying | 在底层 run 状态机增加 retry 枚举。 | |
| 只显示 failed 与创建新 attempt 动作 | 依靠 attempt 编号表达 retry。 | |
| 由 agent 决定 | 由 agent 选择 UI/state 映射。 | |

**User's choice:** 对 transient provider 波动做一次受控自动 retry；同一 task 创建新 application attempt；dispatch 与 reconciliation timeout 采用不同触发时机；`retry` 作为 task-level 派生状态。
**Notes:** providerRunAttempt 与 application attempt 保持两个独立维度。

---

## 迟到回调与 Reconciliation 规则

| Option | Description | Selected |
|--------|-------------|----------|
| 保留事实，冻结业务状态 | 旧 callback 经过校验后进入 append-only 历史，CAS 阻止其改变当前 task/source。 | ✓ |
| 只保留原始事件，不做 provider/receipt 解析 | 只保存 envelope，不生成 bounded outcome。 | |
| 只要 receipt 有效就允许旧 attempt 更新当前 source | 旧 attempt 可以覆盖 current source projection。 | |
| 由 agent 决定 | 由 agent 选择 late callback policy。 | |

| Option | Description | Selected |
|--------|-------------|----------|
| 当前 application attempt 胜出 | 当前 attempt 拥有 source 写入权，旧 attempt 作为 late/stale 历史。 | ✓ |
| 第一个 validated receipt 胜出 | 最先完成的 receipt 锁定 source projection。 | |
| 按 source revision 与 observedAt 竞争 | revision/时间优先于 application attempt。 | |
| 由 agent 决定 | 由 agent 选择 winner 规则。 | |

| Option | Description | Selected |
|--------|-------------|----------|
| 当前 attempt 进入 bounded receipt failure | provider success 保持 observation，receipt 缺失/校验失败不升级 repair success，也不自动 retry。 | ✓ |
| 把 receipt 缺失视为 transient，自动创建一次新 attempt | receipt 问题进入自动 retry。 | |
| 继续保持 reconciliation pending | window 结束后继续等待。 | |
| 由 agent 决定 | 由 agent 选择 receipt terminal policy。 | |

| Option | Description | Selected |
|--------|-------------|----------|
| 幂等接受完全相同的重放，冲突/乱序记录 bounded rejection | 返回稳定 duplicate/stale/conflict outcome，当前 task/source 只接受有效事件。 | ✓ |
| 所有重复、冲突和乱序事件直接丢弃 | 不在控制面留下 rejection history。 | |
| 按到达时间覆盖旧事件 | 最新到达事件覆盖先前事件。 | |
| 由 agent 决定 | 由 agent 选择 event replay policy。 | |

**User's choice:** 迟到事实可追溯但没有 current write authority；当前 application attempt 胜出；receipt 是 repair success 的硬边界；duplicate/stale/conflict outcome 稳定且可审计。
**Notes:** source revision CAS、signed callback、event identity 和 append-only observation 继续复用 Phase 21 控制面。

---

## Dashboard 历史与状态分层

| Option | Description | Selected |
|--------|-------------|----------|
| 当前 attempt focal point + 历史 attempt 列表 | 顶部显示同一 movie identity/current source，旧 attempt 可展开。 | ✓ |
| 按 Provider、Repair、Receipt 分成独立 tabs | 三个事实层分别放入 tabs。 | |
| 单条时间线展示全部事件 | 全部事件在一条 timeline 中显示。 | |
| 由 agent 决定 | 由 agent 选择 task detail layout。 | |

| Option | Description | Selected |
|--------|-------------|----------|
| 显示 bounded attempt summary，并可展开受控日志/事实 | 显示 attempt/run/provider/lease/receipt/sourceRevision/late-stale，不显示 raw runner/provider material。 | ✓ |
| 只显示 attempt 编号、终态和失败原因 | 只保留最小历史摘要。 | |
| 展示完整 provider 与 runner 原始事件 | 在 Dashboard 暴露完整执行材料。 | |
| 由 agent 决定 | 由 agent 选择历史细节。 | |

| Option | Description | Selected |
|--------|-------------|----------|
| 锁定 active repair，聚焦当前 task | terminal 且仍 repairable 且重新读取 disposition 后才允许人工新 task。 | ✓ |
| 允许再次发起并创建并行 repair task | active task 期间允许并行修复。 | |
| 先取消当前 task，再创建新 task | 新 task 前强制取消旧 task。 | |
| 由 agent 决定 | 由 agent 选择 duplicate action policy。 | |

| Option | Description | Selected |
|--------|-------------|----------|
| 展示 allowlisted provider summary 与 run link | provider/repository/workflow/ref/environment/runId/provider attempt/status/conclusion/lease/reconciliation 可见。 | ✓ |
| 只展示 provider 名称、状态和 conclusion | 隐藏 run link 和固定身份摘要。 | |
| 展示完整 provider association 与原始 run metadata | 展示未裁剪 provider payload/metadata。 | |
| 由 agent 决定 | 由 agent 选择 provider projection。 | |

**User's choice:** Dashboard 聚焦当前 attempt、保留 bounded history、active repair 防重复，并展示 allowlisted provider summary/run link；provider dispatch、repair success、receipt validation 和 source state 保持独立。
**Notes:** 现有 `Crawlers.vue` task detail、visible-page polling 和 same-movie navigation 作为 UI 基础。

---

## the agent's Discretion

- 具体 bounded code allowlist、DTO 字段命名、中文文案、状态图标和 Dashboard 布局细节。
- reconciliation window 的具体时长、retryable code 映射和内部 CAS/SQL 组织。
- workflow/adapter 内部编排、测试 fixture 与 focused verification 命令。

## Deferred Ideas

- Fresh production Dashboard -> Viewer -> actual playback proof 与脱敏播放证据属于 Phase 24。
- 漫画、actor、publisher 和其他内容类型的通用 repair template 属于 v2。
- 高频、全库、无限自动重抓和时间序列 source health 平台属于 v2。

