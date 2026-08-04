---
phase: 17
slug: local-runner-vertical-slice
status: approved
shadcn_initialized: false
preset: none
created: 2026-07-30
reviewed_at: 2026-07-30T19:47:02+08:00
---

# Phase 17 — UI Design Contract

> 为本地 runner 纵向切片定义的后台视觉与交互契约。实现只扩展 `Crawlers.vue`，本地浏览器验收入口固定为 `http://localhost:8080`。

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none — 未初始化 shadcn CLI；使用仓库已有的 Shadcn 兼容语义 token |
| Preset | not applicable（`components.json` 在 2026-07-30 扫描中不存在） |
| Component library | 内部 `@starye/ui`：复用 `ConfirmDialog`、`SkeletonCard`、`ErrorDisplay`、toast；按钮与卡片直接使用其语义 token |
| Icon library | `lucide-vue-next`；沿用现有图标尺寸 16px，按钮文字不得只用 emoji 表达状态 |
| Font | `ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`；代码、run ID 与 sequence 使用 `ui-monospace, SFMono-Regular, Menlo, monospace` |

**实现边界：**新任务面板使用 `@starye/ui/globals.css` 的 `background`、`card`、`secondary`、`muted`、`primary`、`destructive`、`border`、`ring` token；不得为本面板新增硬编码 HEX 色值、独立组件库或第三方 registry。已有旧统计/失败任务区保持原样，本 phase 不重做全页视觉体系。

---

## Spacing Scale

Declared values (must be multiples of 4):

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | 状态点与图标和标签的内联间距 |
| sm | 8px | 状态字段、按钮组、日志行内间距 |
| md | 16px | 卡片内边距、默认控件与字段间距 |
| lg | 24px | 任务面板卡片内边距、相邻子区块间距 |
| xl | 32px | 创建区、所选运行详情与既有统计区之间的布局间距 |
| 2xl | 48px | 页面主区块之间的分隔 |
| 3xl | 64px | 页面级留白；仅宽屏页面首尾使用 |

Exceptions: 所有可点击按钮、receipt 链接和“加载更早日志”控件最小可点击区域为 **44 × 44px**；不因视觉紧凑而缩小。

---

## Typography

全页只使用下列 4 个字号和 2 个字重；数字、时间、run ID 与日志 sequence 可改字体族但不新增字号或字重。

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| 辅助元数据、日志、按钮标签 | 14px | 400 | 1.5 |
| 正文、卡片字段、确认对话框正文 | 16px | 400 | 1.5 |
| 区块标题、任务模板名称 | 20px | 600 | 1.2 |
| 页面标题“爬虫监控” | 28px | 600 | 1.2 |

---

## Color

下列值是现有 `@starye/ui/globals.css` token 的亮色解析值；Vue 模板只引用 token utility，不把这些值写回组件。

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `--background` = `hsl(0 0% 100%)` | 页面背景、对话框与可读性优先的主表面 |
| Secondary (30%) | `--secondary` / `--muted` = `hsl(210 40% 96.1%)` | 任务卡片辅助区、日志容器、禁用态、非主操作 |
| Accent (10%) | `--primary` = `hsl(222.2 47.4% 11.2%)` | “创建视频任务”“创建漫画任务”、成功 receipt 的“管理内容”、非破坏性确认与焦点环 |
| Destructive | `--destructive` = `hsl(0 84.2% 60.2%)` | 仅用于取消确认按钮、失败状态图标/标签；不用于普通重试或“加载更早日志” |

Accent reserved for: 两个固定模板创建按钮、成功 receipt 的内容管理链接、取消以外的确认主按钮、键盘焦点环。重试、刷新、加载更早日志为次级/outline 样式；状态颜色只传达运行状态，必须同时显示中文状态文字。

---

## Layout and Interaction Contract

### 页面结构

在既有页面标题和刷新操作下方新增“本地任务”主区块，再保留现有统计与失败任务区。主区块在宽度 >= 1024px 时以两列并列展示可访问模板卡；小于该宽度时单列堆叠，不卡住文本或操作。用户只看得到其已有 `canAccessCrawler` 权限的模板；无权限模板不渲染，也不显示被禁止的按钮或数据。

每个可见模板卡固定包含：模板名称（“视频”或“漫画”）、一句“仅执行服务端固定模板”的说明、最新 run 的状态标签、最近心跳/终态时间、主操作与次操作。页面不提供命令、URL、workflow、环境变量、密钥、并发数或来源站输入，也不猜测或展示 runner 的 stdout、HTML、headers、cookie。

选择最新 run、创建任务或重试成功后，打开同一区块下方的“任务执行详情”；没有可选 run 时显示空态。详情区只展示该 run 的模板、attempt、中文状态、最近心跳/终态时间、安全 failure code、receipt 摘要及结构化脱敏日志。它不是 Phase 19 的历史列表、筛选器或实时日志流。

### 固定模板创建与去重

- 主按钮文案严格为“创建视频任务”和“创建漫画任务”；按下直接提交对应固定 key，不弹出可编辑参数表单。
- 提交中仅禁用被点击的按钮，按钮内显示短加载指示，另一个模板仍可操作；请求完成后立即刷新面板和已选 run。
- API 返回已有活动 run 时，不创建第二条视觉记录：选中该 run，并显示信息 toast“该模板已有活动任务，已打开当前任务。”
- 新建成功后选中新 run；初始状态按 API 原值显示“排队中 · 等待本地 runner”。runner 离线时保留此状态，禁止以失败、超时或成功替代。

### 生命周期、取消与重试

| API 状态 | 可见文案 | 操作规则 |
|----------|----------|----------|
| `queued` | 排队中 · 等待本地 runner | 显示取消；不得暗示已开始执行 |
| `dispatching` | 正在领取 | 显示取消；展示上次刷新时间 |
| `running` | 运行中 · 最近心跳 {时间} | 显示取消；不得以本地按钮乐观结束 |
| `cancel_requested` | 已请求取消 · 等待 runner 确认 | 禁用/隐藏再次取消，保留轮询与日志；终态前不显示“已取消” |
| `succeeded` | 已完成 | 显示验证后的 receipt 与“管理电影内容”或“管理漫画内容” |
| `failed` | 执行失败 | 显示安全 failure code；`receipt_missing` 文案为“任务未找到可验证的入库结果”，不显示 receipt 链接；显示重试 |
| `cancelled` | 已取消 | 显示重试；不显示成功 receipt，即使取消前已有入库记录 |

- 点击“取消任务”必须使用已有 `ConfirmDialog` 二次确认；标题“确认请求取消任务”，正文说明 runner 会在下一个安全检查点停止后续工作且已入库内容保留，按钮为“继续取消”与“返回任务”。确认请求成功后立即显示 toast：**“已请求取消，等待 runner 确认。”** 并以 `cancel_requested` 渲染。
- 点击“重试任务”使用普通确认对话框（非 destructive）：标题“确认重试任务”，正文“将创建新的 attempt；原任务的状态和日志会保留。”，按钮为“创建重试”和“返回任务”。成功后选中新 attempt、立即刷新；旧 attempt 保持只读可见。
- 任何提交失败都保留上一次已加载数据及选择，不把失败状态伪装成 API 状态；用脱敏 toast 报告并提供“刷新”路径。

### Receipt、内容交接与日志

- 只有状态为 `succeeded` 且 API 已返回验证后的 receipt 时，显示“已验证入库结果”卡：模板、主内容 ID、新增数、更新数和一个内容管理链接。链接目标使用既有电影/漫画管理路由及其 receipt 查询参数，打开现有编辑能力，不新建编辑器。
- receipt 摘要缺失、模板不匹配或状态不是 `succeeded` 时，隐藏整个内容管理链接与新增/更新数；不得以 runner 自报 ID 形成跳转。
- 日志默认请求并展示最新 50 条**结构化、脱敏**记录，最新在上；每行只含 sequence、时间、等级、code、安全消息和计数摘要。接收更早 cursor 时显示“加载更早日志”，加载后在列表底部追加；没有 cursor 时不渲染该按钮。
- 日志容器最大高度 448px，纵向滚动；`safe_message` 可换行，长 code/ID 单行省略并通过 `title`/复制控件提供完整安全值。绝不在 UI 展开原始 crawler 输出或凭据。

### 刷新、加载与可访问性

- 页面可见时每 5 秒轮询任务详情与当前 run 日志；`visibilitychange` 为 hidden 或组件卸载时清除轮询；重新可见时立即刷新再恢复间隔。创建、取消、重试成功后不等待 5 秒，立即刷新。
- 首次加载使用 `SkeletonCard` 覆盖两张模板卡和详情骨架；已有数据的后台刷新仅在标题处显示“正在更新”，不清空卡片或日志。
- 所有按钮可用键盘 Tab/Enter/Space 操作；`ConfirmDialog` 保持焦点可见（`ring` token），Escape 和“返回任务”均不发出请求。状态不可只靠颜色或图标区分。

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| Primary CTA | 创建视频任务 / 创建漫画任务 |
| 活动任务去重提示 | 该模板已有活动任务，已打开当前任务。 |
| 空状态标题 | 暂无本地任务 |
| 空状态正文 | 选择“创建视频任务”或“创建漫画任务”后，任务会保持排队，直到本地 runner 领取。 |
| 详情空状态 | 选择一个最新任务以查看状态、入库结果和结构化日志。 |
| 日志空状态 | 此运行尚未产生可显示的结构化日志；页面可见时会每 5 秒刷新。 |
| Error state | 无法加载任务数据。请刷新页面；如果问题持续，请检查 Gateway 与本地 runner 服务。 |
| 取消请求成功 | 已请求取消，等待 runner 确认。 |
| `receipt_missing` | 任务未找到可验证的入库结果，未生成内容管理链接。 |
| Destructive confirmation | 取消任务：runner 会在下一个安全检查点停止后续工作；已入库内容会保留。 |
| Retry confirmation | 重试任务：将创建新的 attempt；原任务的状态和日志会保留。 |

---

## UI Considerations

> 适用状态考虑：**7 covered, 1 backstop, 0 unresolved**。空态和错误态的文案引用上方 Copywriting Contract，不在此重复。

| Category | Element(s) | Status | Resolution / Reason |
|----------|------------|--------|---------------------|
| empty | 模板任务卡、任务执行详情、日志集合 | ✅ covered | 无任务、无选中 run、无日志分别渲染已定义的空态；不会以空白容器、旧任务或伪成功代替。 |
| loading | 首次任务面板与已选 run 日志 | ✅ covered | 首次加载显示 `SkeletonCard`；后续 5 秒刷新保留上一份已加载内容，仅显示“正在更新”。 |
| error | 任务/详情/日志请求与创建、取消、重试操作 | ✅ covered | 请求失败保留最后有效数据，渲染已定义错误 toast/提示并保留“刷新”；不暴露原始响应或 crawler 输出。 |
| populated | 可访问模板卡、选中 run 详情、已验证 receipt | ✅ covered | 每个有权限的固定模板显示一张卡；成功且 receipt 已验证时才显示摘要和既有内容管理链接。 |
| partial | 心跳、receipt 摘要或安全字段不完整的 run | ✅ covered | 缺少值显示“尚未上报”，但不会补造数据；receipt 缺失或不匹配使用 `receipt_missing` 失败态且隐藏内容链接。 |
| overflow | 50+ 条日志、长安全消息、code、run ID 与 receipt 摘要 | ✅ covered | 日志容器 448px 滚动，使用 cursor 追加更早记录；安全消息换行，长 code/ID 单行省略并提供完整安全值。 |
| zero-one-many | 0–2 个当前可访问的固定模板及每个模板的最新 run | ✅ covered | 0 个模板权限时不显示任务创建区；1 个模板单列满宽；2 个模板宽屏两列、小屏单列。Phase 17 不渲染完整历史任务列表。 |
| long-text | 确认对话框、错误提示、任务标签与交互控件 | 🧪 backstop | 视觉状态测试覆盖中文长模板/错误文案、长 run ID 与长 `safe_message`：文字保持可读、操作按钮不被挤出 44px 目标，且不会泄露受限输入。 |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| internal `@starye/ui` | `ConfirmDialog`、`SkeletonCard`、`ErrorDisplay`、toast | not required — first-party source inspected 2026-07-30 |
| shadcn official | none | not applicable — `components.json` absent in codebase scan on 2026-07-30 |
| third-party registries | none | not applicable — none declared as of 2026-07-30; no registry vetting required |

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** approved with 2 non-blocking recommendations
