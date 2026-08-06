# Phase 21: Source Health And Local repair_players Vertical Slice - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md; this log preserves the alternatives considered.

**Date:** 2026-08-06
**Phase:** 21-source-health-and-local-repair-players-vertical-slice
**Areas discussed:** Source health 展示粒度、Repair 入口和输入形状、本地 repair_players 执行契约、失败/重试/旧事件保护

---

## Source health 展示粒度

### Q1. 每个播放源健康状态展示到哪一级？

| Option | Description | Selected |
|--------|-------------|----------|
| 有限稳定集 | 展示 source type、health、观察时间和受控原因 | [x] |
| TTL/expiry/probe 限制 | 同时展示探测时效和探测约束 | |
| 浏览器事件摘要 | 将 canplay/playing/currentTime 混入 source health | |

**User's choice:** 1
**Notes:** playback proof 保持独立层。

### Q2. magnet 如何进入 source type 展示？

| Option | Description | Selected |
|--------|-------------|----------|
| 候选源且默认 unverified | 展示候选性，不把 magnet 视为 direct ready | [x] |
| 只作为 fallback source | 从常规 source 列表中隐藏 | |
| 与 direct 一样进入列表 | 直接按 ready 语义处理 | |

**User's choice:** 1
**Notes:** TorrServer/Aria2 的实际动作留到 Phase 22。

### Q3. failed 原因展示多细？

| Option | Description | Selected |
|--------|-------------|----------|
| bounded reason code + 中文文案 | 只展示受控原因 | [x] |
| 脱敏 probe 摘要 | 额外展示探测摘要 | |
| 详细诊断字段 | 展示底层诊断材料 | |

**User's choice:** 1
**Notes:** 原始来源值、请求材料、页面内容、异常细节和签名材料保持服务端边界。

### Q4. inactive 如何处理？

| Option | Description | Selected |
|--------|-------------|----------|
| 显示但排除 eligibility | 解释数量差异，同时保持候选资格边界 | [x] |
| 默认隐藏 inactive | 列表只显示可用候选 | |
| 按 failed 展示 | 把 inactive 归入失败 | |

**User's choice:** 1

---

## Repair 入口和输入形状

### Q1. 修复目标意图如何表达？

| Option | Description | Selected |
|--------|-------------|----------|
| 固定 `restore_playable_sources` | 目标由服务端模板决定 | [x] |
| `restore_sources` / `verify_sources` | 允许两种意图 | |
| 选择 direct/magnet/TorrServer | 管理员指定传输目标 | |

**User's choice:** 1

### Q2. 后台如何创建 repair_players 任务？

| Option | Description | Selected |
|--------|-------------|----------|
| 专用 `repair-players` 接口 | 路由语义专一，服务端创建任务快照 | [x] |
| 通用接口加 operation | 复用通用创建任务 payload | |
| Dashboard 直接调用本地 runner | 绕过 API task control plane | |

**User's choice:** 1

### Q3. 发起修复前是否确认？

| Option | Description | Selected |
|--------|-------------|----------|
| 二次确认后创建 | 展示影片、受控原因和固定意图后提交 | [x] |
| 点击即创建 | 省略确认步骤 | |
| dry-run 预览后创建 | 增加预览阶段 | |

**User's choice:** 1

**Notes:** `reason` 只来自当前 `no_source` 或 `source_failed` disposition；请求不接受自由文本、任意 URL、命令、workflow 或 secrets。一个任务绑定一部影片。

---

## 本地 repair_players 执行契约

### Q1. 何时可以标记成功？

| Option | Description | Selected |
|--------|-------------|----------|
| 持久化并读回一致后成功 | 服务端权威 observation/readback 与本次结果一致 | [x] |
| 上报影片 ID 后立即成功 | 只证明 runner 看到了影片 | |
| 本地进程退出即成功 | 将进程状态当成业务成功 | |

**User's choice:** 1

### Q2. 快照如何表达 repair_players？

| Option | Description | Selected |
|--------|-------------|----------|
| 独立 operation + 专用 adapter | 与普通 movie crawler 显式分离 | [x] |
| movie adapter 加 repair 模式 | 共用 adapter，通过 mode 分流 | |
| 伪装普通 movie 任务 | 由 adapter 自行判断 | |

**User's choice:** 1

### Q3. 成功事件携带什么回执？

| Option | Description | Selected |
|--------|-------------|----------|
| 专用 repair receipt | 绑定 operation、影片 ID、sourceRevision、observedAt、有限 source summary | [x] |
| 普通 receipt | 只复用 contentIds/templateKey | |
| 只上报 succeeded | 不携带业务回执 | |

**User's choice:** 1

### Q4. adapter 的数据写入边界？

| Option | Description | Selected |
|--------|-------------|----------|
| 受控服务/API | 服务端持久化并提供权威读回 | [x] |
| adapter 直接写 D1/数据库 | 本地执行器直接操作数据层 | |
| 从 runner 日志推断 | 服务端解析日志获得业务状态 | |

**User's choice:** 1

---

## 失败、重试和旧事件保护

### Q1. 失败后的重试策略？

| Option | Description | Selected |
|--------|-------------|----------|
| 可重试故障自动新增一次 attempt | 确定性失败终止，人工重试创建新任务 | [x] |
| 自动重试最多三次 | 扩大自动重试预算 | |
| 全部人工新建 | runner 不自动重试 | |

**User's choice:** 1

### Q2. 旧 attempt、重复投递或乱序回执？

| Option | Description | Selected |
|--------|-------------|----------|
| 绑定运行身份/顺序并校验 source revision | 精确重放幂等，旧或冲突事件保持当前状态 | [x] |
| 时间戳最新者覆盖 | 以时间排序决定最终状态 | |
| 签名正确即可覆盖 | 忽略 attempt/sequence/source revision | |

**User's choice:** 1

**Notes:** 现有控制面已有 attempt、sequence、event identity 和签名事件边界；Phase 21 将其扩展到 repair receipt/source revision。

---

## the agent's Discretion

reason code allowlist 的具体枚举、DTO/存储拆分、CAS/readback 的内部实现、可重试故障的精确分类、轮询间隔、视觉细节和测试 fixture 组织，交由研究与规划在既有模式内决定。

## Deferred Ideas

- Source-specific TorrServer/Aria2 播放和切换动作 - Phase 22
- GitHub Actions production repair 与 reconciliation - Phase 23
- fresh production Dashboard -> Viewer -> actual playback proof - Phase 24
- 更广泛内容类型的通用 repair 模板与全库自动重抓 - v2

---

*Phase: 21-source-health-and-local-repair-players-vertical-slice*
*Discussion log generated: 2026-08-06*
