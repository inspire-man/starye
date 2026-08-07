# Phase 22: Dashboard, MovieDetail And Player State Closure - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `22-CONTEXT.md`; this log preserves the alternatives considered.

**Date:** 2026-08-07
**Phase:** 22-Dashboard, MovieDetail And Player State Closure
**Areas discussed:** 来源选择与回退策略, 重试边界与错误升级, MovieDetail 状态动作, Dashboard 与详情状态同步

---

## 来源选择与回退策略

### Question 1: 标准播放入口首次选择来源时，采用哪种用户体验？

| Option | Description | Selected |
|--------|-------------|----------|
| 1 | 直连优先，磁力走 MovieDetail 的 TorrServer/Aria2 受控入口；评分和画质只影响列表展示。 | ✓ |
| 2 | 直连失败后自动尝试 magnet 的 TorrServer，再提示 Aria2。 | |
| 3 | 用户显式选择来源，播放器只打开所选 eligible 源。 | |

**User's choice:** 1
**Notes:** direct 是浏览器播放入口，magnet 通过受控传输路径处理。

### Question 2: 同一类型多个 eligible 来源的默认选中方式

| Option | Description | Selected |
|--------|-------------|----------|
| 1 | 沿用服务端受控顺序，首个 eligible 作为默认源；评分、画质和更新时间只用于列表展示。 | ✓ |
| 2 | 按画质或评分自动选最高项。 | |
| 3 | 每次先展示来源选择器，再启动播放。 | |

**User's choice:** 1
**Notes:** 播放候选选择与展示排序保持分离。

### Question 3: 旧入口直接选中 magnet 时 Player 的处理

| Option | Description | Selected |
|--------|-------------|----------|
| 1 | 停在受控提示页并返回 MovieDetail，进入 TorrServer 或 Aria2 路径。 | ✓ |
| 2 | 已配置 TorrServer 时自动转成流播放。 | |
| 3 | Player 内提供 Aria2/TorrServer 两个操作。 | |

**User's choice:** 1
**Notes:** 浏览器播放器只初始化可播放的 direct source。

### Question 4: MovieDetail 来源卡片默认展示顺序

| Option | Description | Selected |
|--------|-------------|----------|
| 1 | eligible direct 优先，eligible magnet 其次，inactive/ineligible 放后，并保留 bounded health 信息。 | ✓ |
| 2 | 沿用评分、画质、最新排序作为主要视觉顺序。 | |
| 3 | 严格沿用服务端 source 顺序。 | |

**User's choice:** 1
**Notes:** 展示顺序与 direct-first 的默认播放意图保持一致。

---

## 重试边界与错误升级

### Question 1: 同一 direct 来源连续失败时的最大尝试次数

| Option | Description | Selected |
|--------|-------------|----------|
| 1 | 最多 2 次，随后展示“切换来源”并回到 MovieDetail。 | ✓ |
| 2 | 最多 3 次，随后自动切换下一个 eligible direct 来源。 | |
| 3 | 首次失败后立即展示切换来源。 | |

**User's choice:** 1
**Notes:** 当前 source 重试有界，跨源选择由用户确认。

### Question 2: 重试计数的作用范围

| Option | Description | Selected |
|--------|-------------|----------|
| 1 | 按当前 source、当前播放会话计数；切换来源或重新进入播放页重新计数。 | ✓ |
| 2 | 按同一影片播放会话计数，不同来源共享额度。 | |
| 3 | 跨页面持久化同一影片和来源的失败次数。 | |

**User's choice:** 1
**Notes:** 计数不会把旧 source 的失败额度带到新 source。

### Question 3: 播放错误类型的处理边界

| Option | Description | Selected |
|--------|-------------|----------|
| 1 | 网络、缓冲、TorrServer 流错误进入重试；source-invalid/magnet 进入 MovieDetail。 | ✓ |
| 2 | 所有 Player 错误统一允许 2 次重试。 | |
| 3 | 只有网络/缓冲错误进入重试，TorrServer 或 xgplayer 错误直接切换来源。 | |

**User's choice:** 1
**Notes:** 错误类型决定下一步动作，浏览器不可播放地址使用来源路径提示。

### Question 4: waiting 超时与 Player error 的计数关系

| Option | Description | Selected |
|--------|-------------|----------|
| 1 | 同一加载周期合并为一次失败事件，一次加载周期最多消耗一次额度。 | ✓ |
| 2 | waiting 超时和 error 分别消耗一次额度。 | |
| 3 | 只有 error 事件消耗额度，waiting 只更新提示。 | |

**User's choice:** 1
**Notes:** 需要覆盖 waiting/error 竞态和重复事件的回归测试。

---

## MovieDetail 状态动作

### Question 1: 四种 readiness 状态的主操作

| Option | Description | Selected |
|--------|-------------|----------|
| 1 | ready 播放；no_source/source_failed 查看修复意图和重试读取；repairing 刷新状态。 | ✓ |
| 2 | 所有状态统一显示来源列表和相同操作。 | |
| 3 | 状态页只展示，播放/修复/刷新全部集中到 Dashboard。 | |

**User's choice:** 1
**Notes:** MovieDetail 提供信息与引导，实际 repair mutation 仍由 Dashboard 拥有。

### Question 2: repairing 期间已有来源卡片的处理

| Option | Description | Selected |
|--------|-------------|----------|
| 1 | 保留来源健康摘要，但暂停播放入口，显示观察时间、revision、修复状态和刷新按钮。 | ✓ |
| 2 | 保留 eligible 来源并允许继续播放。 | |
| 3 | 隐藏来源卡片，只显示修复状态。 | |

**User's choice:** 1
**Notes:** 旧 projection 作为状态说明保留，新的播放动作等待 server-owned readback。

### Question 3: no_source 与 source_failed 的差异

| Option | Description | Selected |
|--------|-------------|----------|
| 1 | 共用修复入口和重试读取，但保留原因差异与 bounded reason 文案。 | ✓ |
| 2 | no_source 先重试读取，source_failed 直接突出修复。 | |
| 3 | 统一为“来源不可用”状态。 | |

**User's choice:** 1
**Notes:** 状态差异继续服务于诊断和下一步动作。

### Question 4: ready 状态 source card 的入口

| Option | Description | Selected |
|--------|-------------|----------|
| 1 | direct 浏览器播放；magnet 提供 TorrServer/Aria2 等受控操作；inactive/ineligible 只显示健康信息。 | ✓ |
| 2 | 每个来源统一提供“播放”按钮，由 Player 再判断路径。 | |
| 3 | source card 只选择 source id，所有动作集中到 Player。 | |

**User's choice:** 1
**Notes:** source type 是操作路由的一部分，eligibility 先于播放入口。

---

## Dashboard 与详情状态同步

### Question 1: 修复任务状态更新的刷新体验

| Option | Description | Selected |
|--------|-------------|----------|
| 1 | 可见页 5 秒轮询；Dashboard 自动更新，MovieDetail 通过刷新状态主动读取。 | ✓ |
| 2 | Dashboard 与 MovieDetail 都使用实时推送。 | |
| 3 | 全部改为手动刷新。 | |

**User's choice:** 1
**Notes:** 沿用现有 Dashboard polling 与 MovieDetail refresh pattern。

### Question 2: 从 MovieDetail 发起修复后的 Dashboard 聚焦

| Option | Description | Selected |
|--------|-------------|----------|
| 1 | 自动打开新建 `repair_players` 任务详情，保留 movie identity、reason 和 source revision。 | ✓ |
| 2 | 留在任务列表，只显示创建成功提示。 | |
| 3 | 自动跳回 MovieDetail 等待结果。 | |

**User's choice:** 1
**Notes:** 控制面任务成为状态同步焦点。

### Question 3: repair 终态回到影片页面的方式

| Option | Description | Selected |
|--------|-------------|----------|
| 1 | 提供同一电影的“查看影片”入口；成功显示新 revision/readback，失败显示 bounded reason 和下一步动作。 | ✓ |
| 2 | 成功后自动跳转 MovieDetail 并刷新。 | |
| 3 | 任务详情只保留结果，用户自行返回。 | |

**User's choice:** 1
**Notes:** 用户主动回流，MovieDetail 再读取最新 server-owned projection。

### Question 4: 多个 repair task/旧 attempt 的状态聚焦

| Option | Description | Selected |
|--------|-------------|----------|
| 1 | 聚焦最新 repair task，同时保留旧任务日志和 receipt；MovieDetail 读取当前 source projection。 | ✓ |
| 2 | 保持当前选中任务，仅提示存在更新任务。 | |
| 3 | 合并多个任务为一个聚合状态。 | |

**User's choice:** 1
**Notes:** 最新状态与审计历史同时可见，避免旧 attempt 覆盖当前 projection。

---

## the agent's Discretion

- Vue 状态变量、组件拆分、视觉布局、按钮图标、具体中文文案和 polling lifecycle cleanup。
- 重试计数与加载周期去重的内部数据结构，以及测试 fixture 的组织方式。

## Deferred Ideas

- Phase 23：GitHub Actions production repair、provider dispatch、lease/attempt reconciliation、late callback 和生产 repair receipt。
- Phase 24：fresh production Dashboard -> Viewer -> actual playback proof，以及脱敏 playback event/currentTime evidence。
- v2：漫画或其他内容类型的通用 repair/playback template。
