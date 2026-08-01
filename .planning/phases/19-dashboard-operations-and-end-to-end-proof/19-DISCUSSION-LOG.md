# Phase 19: Dashboard Operations and End-to-End Proof - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md; this log preserves the alternatives considered.

**Date:** 2026-08-01
**Phase:** 19-Dashboard Operations and End-to-End Proof
**Areas discussed:** 任务视图与刷新, 取消/重试与权限, receipt 交接, 验收证据与 RUNBOOK

---

## 任务视图与刷新

### Q1 - 任务历史呈现

| Option | Description | Selected |
|--------|-------------|----------|
| 按模板分组的完整任务列表 | 视频/漫画各显示 task 历史，点击 task 进入详情并切换 attempt。 | ✓ |
| 最新任务卡加详情历史 | 保留当前最新 task 卡，历史 attempt 只放在详情。 | |
| 单一时间线 | 两种模板按时间混排，详情再区分 attempt。 | |

**User's choice:** 按模板分组的完整任务列表。
**Notes:** 完整 task 与 attempt 历史必须可审计。

### Q2 - 详情打开方式

| Option | Description | Selected |
|--------|-------------|----------|
| 页面内详情面板 | 同页显示 attempt、状态、receipt 和分页日志。 | ✓ |
| 独立详情路由 | 每个 task 使用可直接访问的独立页面。 | |
| 右侧抽屉 | 保持列表可见，但日志空间更紧。 | |

**User's choice:** 页面内详情面板。
**Notes:** 复用现有 `selectedRun/task-detail` 入口。

### Q3 - 自动刷新

| Option | Description | Selected |
|--------|-------------|----------|
| 可见时每 5 秒 | 隐藏暂停，恢复立即刷新，并保留手动刷新。 | ✓ |
| 始终每 10 秒 | 页面隐藏后仍持续轮询。 | |
| 可见时每 30 秒 | 主要依赖手动刷新。 | |

**User's choice:** 页面可见时每 5 秒刷新。
**Notes:** 延续 Phase 17 的可见性轮询契约。

### Q4 - 历史加载

| Option | Description | Selected |
|--------|-------------|----------|
| 游标加载更多 | 按更新时间倒序，以游标逐步读取。 | ✓ |
| 页码分页 | 固定每页数量和页码导航。 | |
| 最近一批 | 不提供更早历史入口。 | |

**User's choice:** 游标加载更多。
**Notes:** 与 D1 稳定排序和现有日志 cursor 模式保持一致。

---

## 取消/重试与权限

### Q1 - 无权限模板

| Option | Description | Selected |
|--------|-------------|----------|
| 完全隐藏 | 前端隐藏模板，API 做最终 403 校验。 | ✓ |
| 置灰显示 | 显示模板并说明所需权限。 | |
| 只读历史 | 所有人可查看，写操作按权限禁用。 | |

**User's choice:** 无权限模板完全隐藏。
**Notes:** 沿用 movie/comic resource guard。

### Q2 - 取消等待状态

| Option | Description | Selected |
|--------|-------------|----------|
| 等待 runner 确认 | 保留 attempt/日志并禁用冲突操作。 | ✓ |
| 提前显示已取消 | 后台终态到达后再修正。 | |
| 关闭详情 | 用户之后手动刷新结果。 | |

**User's choice:** 显示 `cancel_requested` 并等待 runner。
**Notes:** Dashboard 不伪造 terminal state。

### Q3 - 重试确认内容

| Option | Description | Selected |
|--------|-------------|----------|
| 展示终态与新 attempt | 显示 failure/cancel reason 和 attempt，明确历史不覆盖。 | ✓ |
| 简单确认 | 只显示确认重试。 | |
| 输入标识确认 | 要求输入 failure code 或 task ID。 | |

**User's choice:** 展示原终态和新 attempt 语义。
**Notes:** 确认后切换到新 attempt。

### Q4 - Provider 信息

| Option | Description | Selected |
|--------|-------------|----------|
| 脱敏 provider 摘要 | 显示状态、run/attempt、SHA 和 provider URL。 | ✓ |
| 仅应用状态 | provider 只留在 evidence/RUNBOOK。 | |
| 原始事件时间线 | 展示完整 callback 字段。 | |

**User's choice:** 显示脱敏 provider 摘要。
**Notes:** secret 和原始 callback payload 不进入 Dashboard。

---

## receipt 交接

### Q1 - CRUD 落点

| Option | Description | Selected |
|--------|-------------|----------|
| 直接打开既有编辑器 | 通过 `primaryContentId` 加载并打开 Movies/Comics 编辑器。 | ✓ |
| 列表高亮 | 先进入列表，由管理员再次点击编辑。 | |
| 新 receipt 页 | 新增只读 receipt 详情页再跳转。 | |

**User's choice:** 直接打开既有编辑器。
**Notes:** 查询失败时留在管理页并显示错误。

### Q2 - 来源上下文

| Option | Description | Selected |
|--------|-------------|----------|
| 受控来源参数 | 携带 task/run/attempt 和返回任务入口，不传原始 receipt。 | ✓ |
| 仅内容 ID | 不保留任务来源。 | |
| 独立 receipt 记录页 | 由新页面保存全部来源。 | |

**User's choice:** 保留受控来源参数。
**Notes:** 编辑器仍只以 `primaryContentId` 查询内容。

### Q3 - CRUD 验收序列

| Option | Description | Selected |
|--------|-------------|----------|
| 真实内容可回退增删改 | movie 使用元数据和播放源，manga 使用元数据和章节/等价子项。 | ✓ |
| 仅更新 | 增删只验证按钮存在。 | |
| 专用 fixture 子记录 | 不触碰 receipt 主内容。 | |

**User's choice:** 对真实 receipt 内容执行模板化可回退增删改。
**Notes:** 最后恢复原值并清理验收子项。

### Q4 - 目标失败或权限变化

| Option | Description | Selected |
|--------|-------------|----------|
| 权限通过才显示链接 | 403/404 保留 task 详情并显示受控错误。 | ✓ |
| 始终显示链接 | 失败时退回对应内容列表。 | |
| 自动重试 | 持续等待内容出现。 | |

**User's choice:** 权限通过才显示管理链接。
**Notes:** 保留返回 task 详情入口。

---

## 验收证据与 RUNBOOK

### Q1 - Evidence 组织

| Option | Description | Selected |
|--------|-------------|----------|
| 固定 tuple JSON/Markdown | 记录 application/provider/callback/receipt/Gateway/CRUD 同一链路。 | ✓ |
| 日志加截图 | 不固定 run tuple。 | |
| 仅 provider URL | 本地由单元测试代替。 | |

**User's choice:** 固定 tuple 的 JSON/Markdown evidence。
**Notes:** 本地与生产必须分别标注。

### Q2 - 凭据记录

| Option | Description | Selected |
|--------|-------------|----------|
| 只记录 metadata | 名称、消费者、权限、Environment、preflight 和轮换。 | ✓ |
| 只写已配置 | 不列名称或步骤。 | |
| 写入 secret 值 | 把值放进本地 evidence。 | |

**User's choice:** 只记录 secret metadata 和操作步骤。
**Notes:** 值留在受管 secret store。

### Q3 - 回滚与部分入库

| Option | Description | Selected |
|--------|-------------|----------|
| 冻结、保留、新 attempt | 分类恢复；内容不自动删除，修正走 CRUD。 | ✓ |
| 删除并自动重试 | 删除该 run 内容并自动再跑一次。 | |
| 同 attempt provider rerun | 覆盖原 provider 关联。 | |

**User's choice:** 冻结 mutation、保留证据、恢复后新 attempt。
**Notes:** 部分入库继续可审计。

### Q4 - 生产证明范围

| Option | Description | Selected |
|--------|-------------|----------|
| 一个生产 tuple + 本地双模板 | 一个真实 provider success；本地 movie/manga 都走完整链路。 | ✓ |
| 生产双模板 | movie/manga 各一条 credentialed tuple。 | |
| 仅本地 fixture | 不做 credentialed provider run。 | |

**User's choice:** 一个生产 tuple，加本地双模板完整证据。
**Notes:** 与 Phase 18 `COVERAGE.md` handoff 一致。

---

## the agent's Discretion

- 组件拆分、cursor DTO、provider 摘要布局、来源 query 参数、具体可回退字段/子项、evidence 文件名与测试工具。
- 所有细节须遵守已锁定的 Gateway、权限、D1、状态机、receipt 和秘密管理契约。

## Deferred Ideas

- 实时流式日志、通知、schedule 编辑、额外模板、多任务并发和自动业务重试。
- 第二个模板的 credentialed production provider tuple。
- 独立 receipt 详情页和第二套内容编辑器。
