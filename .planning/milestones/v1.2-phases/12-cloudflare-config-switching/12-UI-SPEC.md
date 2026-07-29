---
phase: 12
slug: cloudflare-config-switching
status: approved
reviewed_at: 2026-07-15
shadcn_initialized: false
preset: none
created: 2026-07-15
---

# Phase 12 — Cloudflare Config Switching UI Design Contract

> 本阶段只变更浏览器可消费的公开运行时配置投影。有效配置必须对终端用户无可见差异；不得借此新增目标切换界面、设置页、控制面板、弹窗、卡片或视觉重构。

---

## Design System

| Property | Value |
|----------|-------|
| Tool | 既有 Tailwind CSS v4 与 `@starye/ui` 共享、Shadcn-compatible token；本阶段不新增组件或样式 |
| Preset | `packages/ui/tailwind.config.ts`（既有 token，原样保留） |
| Component library | 既有 Vue 应用组件与 `@starye/ui`；无新增 UI surface |
| Icon library | 沿用各应用现有图标；本阶段不新增图标或 icon-only action |
| Font | 沿用各应用现有系统 sans-serif；本阶段不改字体声明 |

`components.json` 不存在，且本阶段不交付用户界面，因此不初始化 shadcn。`starye-ui-components` 的共享 token 与组件边界保持不变。

---

## Visual And Interaction Contract

### Visibility and focal point

- **主视觉锚点：** 无。本阶段没有新增或重排任何用户屏幕；每个既有应用保留其当前页面焦点、信息层级与响应式布局。
- **有效 public config：** 切换 selected target 后，用户只会继续看到既有应用的相同界面和路由体验；配置值不是页面内容，不得在浏览器中显示 target selector、account、Environment、Worker/Pages origin 或资源名称。
- **浏览器请求边界：** Vite/Nuxt/Vue app 只使用类型化 allowlist 内的 canonical gateway/API base 与 app base path。local browser canonical entry 固定为 `http://localhost:8080/...`；直连开发端口、Pages deployment URL 和 Worker internal origin 都不得成为可见端点或用户可选项。

### States and errors

| State | User-visible behavior | Contract |
|-------|-----------------------|----------|
| Valid selected target | 无新增提示、徽标、卡片或 loading state | 既有页面视觉与交互保持不变。 |
| Invalid target / public-key validation | 不新增浏览器错误 UI | 在 config validation、build 或 CI/remote preflight 处 fail closed；不得把不完整或不安全的 config 交给浏览器。 |
| Existing runtime network error | 沿用拥有该页面的既有 error surface | 不新增文案、modal 或 retry 控件；错误信息不得包含 token、secret、internal origin 或完整环境变量。 |
| Empty / destructive / confirmation | 无新增状态 | 本阶段没有用户可操作的数据或 destructive action，不能借配置切换新增 empty state 或确认对话框。 |

### Security-visible rules

- 公开 contract 仅允许 selected target id、gateway/API canonical URL 与应用 base path，以及经审计为公开的 telemetry 值（D-04、D-06）。
- 不得向用户显示或序列化 credential、token、client secret、crawler secret、R2 access key、GitHub Environment secret、Worker origin、Pages internal/deployment origin，或未注册的 `VITE_*` / `NUXT_PUBLIC_*` key。
- 配置错误属于 operator/CI 处理路径，不得退化为让终端用户选择 target、输入域名或绕过校验的 UI。

---

## Spacing Scale

既有视觉系统的标准网格保持不变；Phase 12 不引入新的 layout、panel 或 control。

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | 既有图标间距、行内 padding |
| sm | 8px | 既有紧凑元素间距 |
| md | 16px | 既有默认元素间距 |
| lg | 24px | 既有区块 padding |
| xl | 32px | 既有布局间距 |
| 2xl | 48px | 既有主要区块分隔 |
| 3xl | 64px | 既有页面级间距 |

Exceptions: none. 不因 public config 投影新增 spacing 或改变任一既有页面布局。

---

## Typography

以下为既有共享 token 的受限基线；不授权 Phase 12 新增或调整任何页面文本样式。

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Body | 16px | 400 | 1.5 |
| Label | 14px | 600 | 1.3 |
| Heading | 20px | 600 | 1.2 |
| Display | 28px | 600 | 1.2 |

Public config、target id、resource identity 与 validation details 均不是浏览器 UI 文案，不得为其创建新的 label、heading 或 display treatment。

---

## Color

以下为 `@starye/ui` 已有默认 token 的继承规则，不是本阶段新增配色。Phase 12 不可使用颜色暗示 account、target 或部署状态。

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `#FFFFFF` (`--background`) | 既有页面 background；本阶段不新增 surface |
| Secondary (30%) | `#F1F5F9` (`--secondary` / `--muted`) | 既有 cards、sidebar、nav；本阶段不新增容器 |
| Accent (10%) | `#0F172A` (`--primary`) | 仅既有 primary CTA、active navigation、visible focus ring；Phase 12 新增项为零 |
| Destructive | `#EF4444` (`--destructive`) | 仅既有 destructive actions；不得用于 config validation 或泄露信息的错误提示 |

Accent reserved for: 既有 primary CTA、active navigation 和可见 focus ring；不得扩展到所有 interactive elements，且本阶段不创建任何新的这些元素。

---

## Copywriting Contract

本阶段没有新的用户命令或用户可见配置状态。下列条目是明确的禁止新增约束，避免 executor 为配置流程虚构 UI copy。

| Element | Copy |
|---------|------|
| Primary CTA | 不适用：不得新增“切换目标”“保存配置”或部署相关的浏览器 CTA。 |
| Empty state heading | 不适用：不得为 public config 创建 empty state。 |
| Empty state body | 不适用：没有用户下一步；无效配置必须在浏览器配置生成前由 validation/preflight 阻断。 |
| Error state | 不适用：不得新增浏览器错误文案；既有应用 runtime error 沿用所属页面已有 error surface，并且不显示 secret 或 internal origin。 |
| Destructive confirmation | 不适用：本阶段没有用户触发的 destructive action 或 confirmation。 |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| Existing local `@starye/ui` tokens and Vue components | none added | not required — no registry consumption or component installation in Phase 12 |
| shadcn official | none | not required — `components.json` is not initialized and scope forbids UI additions |

No third-party registry is allowed for this phase.

---

## Implementation Boundaries

- Preserve the existing Vite/Nuxt/Vue visual system. Public runtime config adapters may change data sources only; they must not add CSS, components, routes, controls, dialogs, dashboard cards, or a target-management screen.
- Existing browser calls remain canonical gateway/API calls. Browser-side config must not provide service discovery, direct port URLs, Worker origins, Pages origins, or a route around the gateway boundary (D-05).
- Valid config produces no new visual state. Invalid config is rejected by typed allowlist validation, build, or CI/remote preflight rather than surfaced as a user-selectable recovery flow.
- Phase 13 owns actual local/production crawler-to-D1-to-admin-to-viewing smoke; Phase 14 owns final runbook and old-domain cleanup. This contract does not pull those UI or evidence flows forward.

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: pending checker review; no new user-facing copy is permitted.
- [ ] Dimension 2 Visuals: pending checker review; no screen or focal-point change is permitted.
- [ ] Dimension 3 Color: pending checker review; existing token palette only.
- [ ] Dimension 4 Typography: pending checker review; existing constrained baseline only.
- [ ] Dimension 5 Spacing: pending checker review; standard 4px grid only.
- [ ] Dimension 6 Registry Safety: pending checker review; no registry blocks consumed.

**Approval:** pending
