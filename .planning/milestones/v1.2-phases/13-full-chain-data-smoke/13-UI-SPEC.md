---
phase: 13
slug: full-chain-data-smoke
status: approved
shadcn_initialized: false
preset: none
created: 2026-07-28
reviewed_at: 2026-07-28
---

# Phase 13 - UI Design Contract

> Dashboard movie-list and Viewer observability contract for the one-item, target-scoped smoke path. This contract adds no product screen and never turns local evidence into a production-complete claim.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | Manual shared system: `@starye/ui` + Tailwind CSS v4 |
| Preset | Not applicable. No `components.json` exists; this phase must not initialize or alter shadcn configuration. |
| Component library | Vue 3 components backed by Radix Vue; reuse `DataTable`, `SkeletonTable`, `ErrorDisplay`, `StatusBadge`, `ConfirmDialog`, and `useToast` from `@starye/ui`. |
| Icon library | `lucide-vue-next` for any new icon-only control; every icon-only control needs an accessible name. |
| Font | Existing system/inherit font stack only; do not add a web font for a smoke-observation change. |

Source: existing `packages/ui` tokens and Phase 13 research. This is a manual Vue design system, not a shadcn registry consumer.

---

## Spacing Scale

Declared values (must be multiples of 4):

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Icon-to-label gaps, compact badge internals |
| sm | 8px | Cell-internal gaps, adjacent controls |
| md | 16px | Default row/cell and panel spacing |
| lg | 24px | List header, empty/error panel padding |
| xl | 32px | Dashboard content and Viewer section gaps |
| 2xl | 48px | Standalone state-panel vertical padding |
| 3xl | 64px | Page-level separation only |

Exceptions: interactive controls use a minimum 48px by 48px target on touch viewports; the existing desktop table may retain compact 32px pagination controls when a 48px target is not practical.

---

## Typography

Use exactly these three sizes and two weights. Do not introduce viewport-scaled type or negative letter spacing.

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Body | 14px | 400 | 1.5 |
| Label | 14px | 600 | 1.2 |
| Heading | 16px | 600 | 1.2 |
| Display | 20px | 600 | 1.2 |

Movie code, target ID, run ID, and checkpoint code use the existing monospace utility at the Body size. They wrap at character boundaries or offer a non-secret copy control; they never force page-width overflow.

---

## Color

Use existing semantic CSS variables only. No new component may hard-code a hex color or add a one-off palette.

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | Dashboard: `hsl(var(--background))`; Viewer: `hsl(222 47% 11%)` through `--background` | Page canvas and primary reading surfaces |
| Secondary (30%) | Dashboard: `hsl(var(--secondary))`; Viewer: `hsl(215 28% 17%)` through `--card` / `--secondary` | Table headers, cards, panels, skeleton base |
| Accent (10%) | Dashboard: `hsl(var(--primary))`; Viewer: `hsl(199 89% 48%)` through `--primary` | See the reserved list below |
| Destructive | `hsl(var(--destructive))` | Existing destructive confirmations only; never the smoke observation status or retry action |

Accent reserved for: the selected Dashboard navigation item, the visible smoke-item code link to the Viewer, keyboard focus ring, the one primary `查看影片` action, and the terminal-pass status icon. Pending, checkpoint, disabled, and unauthenticated states must remain distinguishable by text and icon without relying on accent or destructive color.

**App-theme boundary (required):** the Dashboard and Viewer accents are mutually exclusive page themes. A Dashboard surface inherits and uses only Dashboard `hsl(var(--primary))`; a Viewer surface inherits and uses only the Viewer `hsl(var(--primary))` value (`hsl(199 89% 48%)`). A component, table row, panel, dialog, badge, or status state must never hard-code, combine, or visually place both app accents on the same surface. A Dashboard-to-Viewer link carries the item identity only; it does not carry Dashboard accent styling into the Viewer. Shared `@starye/ui` components must consume the host app's semantic CSS variables and must not import the other app's color value.

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| Primary CTA | `查看影片` |
| Dashboard loading | `正在加载影片列表...` |
| Pending status | `已写入待观察条目，尚未完成 Dashboard 和 Viewer 验证。` |
| Local terminal status | `已按 Dashboard -> Viewer 完成本地观察；这不表示生产环境已完成。` |
| Production terminal status | `已按 Dashboard -> Viewer 完成当前 selected target 的观察。` Only render after a fresh remote terminal artifact exists. |
| Checkpoint status | `本次观察已停止，尚未形成通过结论。请查看非敏感 checkpoint 原因；不要在此 run 上重试。` |
| Empty state heading | `未找到匹配的影片` |
| Empty state body | `检查筛选条件后重试。若这是刚写入的 smoke 条目，请刷新列表；不会自动新建或重跑数据链。` |
| Viewer no-player state | `该影片暂无可用播放源。` |
| Dashboard error state | `影片列表加载失败。请检查 Gateway 连接后重试。` |
| Viewer error state | `未能加载该影片。请返回列表并确认影片编号后重试。` |
| Unauthenticated state | `需要登录才能访问影片管理。登录后将返回当前页面。` |
| Unauthorized state | `当前账号没有影片管理权限。请返回登录页切换账号，或联系管理员申请影片管理权限。` |
| Destructive confirmation | Not applicable. The Phase 13 observation flow has no delete, session-revoke, ingest-retry, or remote-handoff command. Existing unrelated Dashboard deletion controls remain outside this flow. |

Never place a token, cookie value, signed-session material, raw provider error, full remote endpoint, or prepared child context in any user-facing copy, URL label, status detail, toast, or evidence preview.

---

## Observation and Interaction Contract

### Scope and component inventory

The observable path uses the existing `Movies.vue` collection in the Dashboard and `MovieDetail.vue` in the Viewer. Reuse `SkeletonTable` for initial list loading, `DataTable` for populated/empty list states, `ErrorDisplay` for recoverable fetch failure, and `StatusBadge` plus a visible text label for smoke status. Do not create a smoke runner button, credential input, target selector, remote authorization button, or new administrative workflow.

The primary action is a non-mutating `查看影片` link for the exact deterministic item code. It opens the canonical Viewer path after the Dashboard row has been observed. The link must be disabled or absent while identity is missing, pending has not reached the Dashboard observation step, or the state is checkpointed.

### Visual hierarchy

The Dashboard focal point is the exact deterministic item code paired with its visible observation status; the `查看影片` link is the sole secondary action and appears only after that identity is confirmed. In the Viewer, the same code and title form the reading anchor, followed by status metadata and then optional player content. Loading, empty, error, pending, and checkpoint panels occupy the same content region so a state transition does not shift the primary anchor or resemble a terminal success state.

### Canonical route and identity rules

1. Local browser evidence and any visible local route affordance use only `http://localhost:8080/dashboard/movies` followed by `http://localhost:8080/movie/{item_code}`. Direct `3000`, `3001`, `3002`, `3003`, and `5173` origins are diagnostics only and must never appear as canonical links, assertions, receipts, or user instructions.
2. Remote browser affordances use only the selected target's canonical Gateway origin resolved by `TargetProfile`; a component must not assemble, guess, or expose another origin.
3. The Dashboard row and Viewer heading must expose the exact item code. A title alone never proves identity. Per-mode item IDs may be shown only as non-secret monospace metadata and must match the evidence tuple for that mode.
4. Observation order is fixed: authenticated Dashboard row first, then canonical Viewer route for the same code. A Viewer-only visit is incomplete and stays pending/checkpointed.
5. `p13-60-5b545aa10389b50cfa86e78319665398` is frozen history. It must have no visible observe, verify, retry, or remote-handoff action; no later plan may treat it as a usable pending carrier.

### Session boundary

The Dashboard remains protected by the existing real auth and role guard. Before session resolution, render neither a populated movie table nor a smoke-pass state. A missing session redirects to the existing login route with the current canonical Dashboard path as the return target; an insufficient role goes to the existing unauthorized state. Do not inspect, display, persist, synthesize, or transfer cookies/session values in the UI or evidence.

The public Viewer is not evidence of Dashboard authorization. A terminal observation requires the Dashboard's real session/role result and the ordered Viewer receipt. Browser adapter unavailability, missing signed session, provider preflight failure, or Dashboard auth failure becomes a checkpoint, never a local fallback or a success-styled empty state.

### State machine and allowed actions

| State | Visual treatment | Allowed action | Prohibited behavior |
|-------|------------------|----------------|---------------------|
| Loading | `SkeletonTable` with `aria-busy="true"`; preserve table geometry with 20 rows and 7 columns | None until the initial query settles | Replacing the table with a blank page or announcing a pass |
| Populated | One visible row matches exact code; code and status stay readable before secondary metadata | `查看影片` after Dashboard observation | Treating a title match or a different item ID as a match |
| Empty | Centered state panel using the documented empty copy | `刷新列表` may repeat the read-only list fetch | Creating a fixture, widening filters automatically, or claiming ingestion failed/succeeded |
| Fetch error | `ErrorDisplay` banner with the documented error copy and a bounded `重试加载影片列表` action | Retry the read-only page fetch at most once from the visible control; existing transport may keep its bounded internal retries | Showing raw error text, endpoint, header, or credentials |
| Pending | Neutral `StatusBadge` plus the pending copy and exact non-secret code | Read-only refresh of the applicable surface | Opening the Viewer as terminal proof, allocating another carrier, or mutating the current run |
| Local terminal | Primary check icon plus the local-terminal copy | View the already observed local result | Labeling it production complete or starting remote work from this UI |
| Remote terminal | Primary check icon plus the production-terminal copy | View the recorded result | Rendering this state from local evidence or a checkpoint artifact |
| Checkpoint | Neutral outlined status with an AlertTriangle icon, non-secret checkpoint code, and documented copy; `role="alert"` | Return to login when auth is missing, or view non-secret record details | Retrying, observing, verifying, or handing off the frozen/current checkpoint carrier |

Status text must use one of `等待观察`, `本地观察完成`, `远端观察完成`, or `Checkpoint: {allowlisted_code}`. Do not show `通过`, `完成`, or green terminal styling when `provesExternalChain` is false, the ordered pair is incomplete, or the current mode lacks a terminal artifact.

---

## Accessibility and Responsive Contract

### Accessibility

- Use semantic table markup for the Dashboard collection. Sortable headers and row navigation must use actual buttons/links, not click handlers on non-interactive text.
- Keep the exact movie code in the accessible name of `查看影片`: `查看影片 {item_code}`. Status badges include visible text and an icon with `aria-hidden="true"`; state is never color-only.
- Mark list loading with `aria-busy="true"` and announce loading completion/pending with one `aria-live="polite"` region. Error and checkpoint use `role="alert"` / assertive announcement once; do not repeatedly announce polling or retries.
- Send keyboard focus to the error heading or empty-state heading after a failed/empty query. When login or unauthorized routing completes, focus the target page's first heading.
- Maintain a visible `ring` focus indicator with at least 2px apparent width, 4.5:1 text contrast, and no keyboard trap in the standard list/detail path.
- Respect `prefers-reduced-motion`: skeleton shimmer may use the existing reduced-motion pulse; do not add autoplay, scroll jumps, or motion that is required to understand state.

### Responsive behavior

- Desktop Dashboard uses the existing DataTable minimum width of 800px. At widths below 800px, the table container scrolls horizontally; it must not clip columns or shrink code/status below readability.
- Keep the code and status cells on the leading edge of the table. Long title, provider, and checkpoint text truncate visually with an accessible full value (`title` or equivalent accessible description), never overlap controls.
- At 767px and below, filters wrap in source order, action targets become at least 48px high, and bulk-management controls remain separate from the smoke observation link.
- Viewer metadata and player sections use a one-column flow below 640px. Player actions wrap to a second line rather than overflow, while `查看影片` and canonical path text remain readable.

---

## UI Considerations

> `--auto` probe input uses the declared kind for each actual surface: Dashboard movie collection (`list-collection`), Viewer detail (`media`), Viewer player collection (`list-collection`), auth boundary (`nav`), and the three status notices (`static-content`). Empty and error copy is owned by `## Copywriting Contract` and referenced here without duplication.

Probe result: 28 applicable considerations, 28 resolved, 0 dismissed, 0 unresolved. Every item is an explicit implementation contract; no item relies on a backstop-only test.

| Category | Element(s) | Status | Verification | Resolution / Reason |
|----------|------------|--------|--------------|---------------------|
| empty | Dashboard movie collection | resolved | explicit | A zero-result collection renders the documented empty-state copy and only a read-only refresh affordance. |
| loading | Dashboard movie collection | resolved | explicit | `SkeletonTable` preserves 20-row/7-column geometry and announces busy state before the first list response. |
| error | Dashboard movie collection | resolved | explicit | A request failure renders `ErrorDisplay` with redacted error copy and one visible `重试加载影片列表` control. |
| populated | Dashboard movie collection | resolved | explicit | The deterministic code, mode-local item ID, and observation status are visible in the matching row before secondary metadata. |
| partial | Dashboard movie collection | resolved | explicit | Missing optional metadata/player fields render `-` or the documented no-player state; identity and status remain visible. |
| overflow | Dashboard movie collection | resolved | explicit | The 800px table scrolls horizontally on narrow viewports; long cells truncate with an accessible full value. |
| zero-one-many | Dashboard movie collection | resolved | explicit | Zero uses the empty state, one preserves normal table layout, and many retain pagination and selection behavior. |
| empty | Viewer detail media/content | resolved | explicit | Absent playable media is represented by the documented no-player state without hiding the verified item identity. |
| loading | Viewer detail media/content | resolved | explicit | The Viewer exposes one loading state without emptying the page shell or implying a terminal result. |
| error | Viewer detail media/content | resolved | explicit | Missing or failed detail load uses the documented Viewer error copy and returns the user to the canonical list path. |
| populated | Viewer detail media/content | resolved | explicit | The Viewer shows the exact code and item metadata matching the Dashboard row before any player interaction. |
| empty | Viewer player collection | resolved | explicit | Zero sources render `该影片暂无可用播放源。`; the item remains visible and identifiable. |
| loading | Viewer player collection | resolved | explicit | Player sources remain inside the Viewer detail loading shell until the same detail query settles; no empty or terminal player state is shown early. |
| error | Viewer player collection | resolved | explicit | A source/detail failure uses the documented Viewer error state and canonical-list return path, never a pass-like empty player panel. |
| populated | Viewer player collection | resolved | explicit | One or more source cards use the existing stable source order beneath the verified code and status metadata. |
| partial | Viewer player collection | resolved | explicit | Missing optional player metadata leaves the source card usable or shows the no-player state without hiding code or observation status. |
| overflow | Viewer player collection | resolved | explicit | The one-column small-viewport/two-column `md` grid and wrapped player actions prevent horizontal page overflow. |
| zero-one-many | Viewer player collection | resolved | explicit | Zero uses no-player copy; one has no placeholder or singular special copy; many retain stable ordering and responsive grid layout. |
| loading | Auth/navigation boundary | resolved | explicit | Protected Dashboard content stays withheld until the real session and role guard settles. |
| error | Auth/navigation boundary | resolved | explicit | Missing session and insufficient role use distinct documented states without exposing session material. |
| overflow | Auth/navigation boundary | resolved | explicit | Long return paths stay internal to the redirect parameter and never render as unbounded UI text. |
| long-text | Auth/navigation boundary | resolved | explicit | The visible unauthorized instruction is concise; any internal return path is not rendered as a user-facing long string. |
| overflow | Observation status panel | resolved | explicit | Allowlisted checkpoint codes wrap within the panel; raw provider messages and endpoint text are excluded. |
| long-text | Observation status panel | resolved | explicit | Checkpoint codes and non-secret status details wrap without obscuring the primary identity. |
| overflow | Pending/terminal/checkpoint status | resolved | explicit | Status copy wraps in its fixed content region and never expands into an overlapping action surface. |
| long-text | Pending/terminal/checkpoint status | resolved | explicit | Pending, terminal, and checkpoint labels retain their non-success/success distinction when copy wraps. |
| overflow | Frozen-run notice | resolved | explicit | The frozen identifier wraps at safe boundaries and has no interactive command, evidence access, session data, or remote link. |
| long-text | Frozen-run notice | resolved | explicit | The full frozen identifier remains informational only and does not force horizontal page overflow. |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | none | not applicable; `components.json` is absent and this phase must not initialize shadcn (confirmed 2026-07-28) |
| Third-party registries | none | no registry source, block, or generated component is permitted in scope (confirmed 2026-07-28) |

---

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS
- [x] Dimension 2 Visuals: PASS
- [x] Dimension 3 Color: PASS
- [x] Dimension 4 Typography: PASS
- [x] Dimension 5 Spacing: PASS
- [x] Dimension 6 Registry Safety: PASS (no third-party registry blocks in scope; UI safety gate is disabled)

**Approval:** approved 2026-07-28
