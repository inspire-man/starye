---
phase: 23
slug: github-actions-production-repair-and-reconciliation
status: draft
shadcn_initialized: false
preset: none
created: 2026-08-07
---

# Phase 23 - UI Design Contract

> Visual and interaction contract for the Dashboard production `repair_players` workflow.
> The surface is operational: an operator should identify the movie, current attempt, provider
> facts, lease/reconciliation outcome, receipt validation, and next action from one scan.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none - manual `@starye/ui` system |
| Preset | not applicable; `components.json` is absent |
| Component library | `@starye/ui` shared Vue components; existing Tailwind v4 tokens; `radix-vue` only where an existing accessible primitive is already used |
| Icon library | `lucide-vue-next` |
| Font | system UI stack: `system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif` |

### Existing system contract

- Import `@starye/ui/globals.css`; use `hsl(var(--background))`, `hsl(var(--card))`,
  `hsl(var(--muted))`, `hsl(var(--primary))`, `hsl(var(--destructive))`, and their foreground
  tokens for all Phase 23 surfaces.
- Reuse `SkeletonCard` for the first load, `ConfirmDialog` for cancel/repair confirmation,
  `Toast` composables for short completion feedback, and the existing `safe-log-scroller`
  pattern for bounded structured logs.
- Use `lucide-vue-next` icons with visible labels. Icon-only controls require an `aria-label` and
  a tooltip; familiar commands use `RefreshCw`, `ChevronDown`, `ExternalLink`, `CircleCheck`,
  `CircleAlert`, `LoaderCircle`, `Clock3`, `History`, `ShieldCheck`, `TimerOff`, and `Wrench`.
- Keep the page's existing maximum width of 1400px and its 1023px single-column breakpoint.
  The detail surface is the primary page content; global crawler statistics and legacy failed-task
  blocks remain secondary.

### Locked Phase boundary

- Scope is movie `repair_players` through the existing movie GitHub Actions workflow. The page
  presents a movie identity and the fixed operation; content-type selection is absent from this
  surface.
- The Dashboard command expresses only `confirmed`, `movieId`, `reason`, and
  `targetIntent`. Operation, movie snapshot, source revision, target profile, workflow, provider,
  authorization, and callback configuration come from the server-owned task/registry projection.
- Workflow dispatch is represented by its existing binding facts: `run_id`, `attempt`, `template`,
  and `target`. The UI presents the resulting allowlisted provider summary and run link.
- Provider dispatch accepted, provider observation, repair result, validated receipt, current source
  projection, and browser playback proof are separate fact layers. `playing`/`currentTime` evidence
  belongs to Phase 24.
- Automatic retry is a single bounded retry for transient provider/transport, timeout, provider-lost,
  or lease-expiry outcomes. The task-level `retry` label accompanies a new current attempt; the run
  status vocabulary remains the existing set.
- Manual retry is a new task created after the current source disposition is reread. An active repair
  for the same movie locks the duplicate repair entry; a terminal repairable task exposes the same
  fixed production repair entry again.
- Late, stale, duplicate, and conflict outcomes remain append-only history facts. The current task
  and source projection follow the current application attempt/source revision CAS result.

---

## Spacing Scale

Declared values (must be multiples of 4):

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Icon-to-label gaps, status dot gaps, compact metadata separators |
| sm | 8px | Badge padding, fact-row gaps, compact control spacing |
| md | 16px | Detail surface padding, fact grid gaps, source row padding |
| lg | 24px | Page section padding, focal panel separation |
| xl | 32px | Page content gaps, header-to-detail spacing |
| 2xl | 48px | Major history and operational section breaks |
| 3xl | 64px | Page-level breathing room at wide desktop widths |

Exceptions: 44px minimum height for every actionable button, disclosure row, and checkbox label;
1px borders; 448px maximum height for the safe-log viewport. These values preserve the existing
Dashboard touch target and bounded-log behavior.

### Layout contract

- Use one unframed page band for the Dashboard shell and one framed `task-detail` focal surface.
  Inside the focal surface, fact groups use border separators and a 2-column grid rather than
  stacked decorative cards.
- Desktop order is fixed: identity strip, current-attempt status, provider/lease/reconciliation/
  receipt facts, current source projection, current safe logs, then expandable older attempts.
- At or below 1023px, every grid becomes one column; identity metadata wraps; action groups become
  full-width rows; safe logs keep a bounded viewport with horizontal overflow for structured columns.
- Task IDs, movie IDs, provider IDs, failure codes, SHA values, and safe messages use
  `overflow-wrap: anywhere`. Link labels stay short even when their provider target is long.

---

## Typography

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Body | 14px | 400 | 1.5 |
| Label | 12px | 600 | 1.2 |
| Heading | 20px | 600 | 1.2 |
| Display | 28px | 600 | 1.15 |

Weights are limited to regular 400 and semibold 600. Use the 12px label style for provider,
lease, reconciliation, receipt, source-type, and timestamp labels; use 14px body text for bounded
reasons and safe log messages. The page title uses the 28px display style; fact headings use 14px
semibold or the 20px heading style according to the existing hierarchy.

---

## Color

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `hsl(var(--background))` (light fallback `#ffffff`) | Page canvas, empty areas, large whitespace |
| Secondary (30%) | `hsl(var(--muted))` (light fallback `#f1f5f9`) | History rows, fact separators, safe-log viewport, pending-state surfaces |
| Accent (10%) | `hsl(var(--primary))` (light fallback `#0f172a`) | Current-attempt border/ring, selected history disclosure, `发起生产修复`, refresh progress, same-movie link |
| Destructive | `hsl(var(--destructive))` (light fallback `hsl(0 84.2% 60.2%)`) | Cancel confirmation, receipt/contract failure marker, terminal error border/icon |

Accent reserved for: the current attempt focal outline, the active task-level retry/current-attempt
indicator, the primary production repair CTA, the active refresh state, and the server-owned
same-movie navigation link. Provider success, receipt validation, and source readiness each retain
their own text/icon state label; a single accent badge never combines these facts.

### Status encoding

- Every status uses icon + text + semantic `aria` state. Color supplies hierarchy and never carries
  the only meaning.
- `queued`/`dispatching`/`running` use `Clock3`/`LoaderCircle`; `succeeded` uses `CircleCheck`
  only after validated receipt/readback; `failed`/receipt failure use `CircleAlert`; `retry` uses
  `RefreshCw`; `late`/`stale`/`ignored` use `History` or `TimerOff`.
- Provider `completed/success` uses a provider observation label. Repair success uses a separate
  `修复已验证` label. Receipt `已验证` and current source `ready` appear as separate facts.

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| Primary CTA | `发起生产修复` |
| Empty state heading | `暂无生产修复任务` |
| Empty state body | `从 no_source 或 source_failed 的影片发起生产修复，当前任务会在本页显示。` |
| Error state | `生产修复状态读取失败。请刷新任务详情；若问题持续，请检查 Gateway 与后台服务。` |
| Destructive confirmation | `取消当前 attempt：已记录的任务状态、日志、receipt 和 source observation 保留；确认后等待 provider/runner 在安全检查点收敛。` |

### Operational labels

| Fact | Required label behavior |
|------|-------------------------|
| Current task status | `排队中` / `正在提交生产 provider` / `生产运行中` / `已请求取消` / `运行已完成` / `执行失败` / `已取消` |
| Task-level retry | `任务级重试 · 当前 attempt #N` beside the current attempt; older failed attempt keeps its own terminal status |
| Provider lifecycle | `Provider 已受理` / `Provider 运行中` / `Provider 已完成` with provider status/conclusion beside it |
| Lease | `Lease 有效` / `Lease 已续期` / `Lease 已过期` / `等待 lease 对账` |
| Reconciliation | `对账窗口进行中` / `已完成对账` / `late` / `stale` / `ignored` / `duplicate` / `conflict` |
| Repair result | `修复待校验` / `修复已验证` / `修复失败` |
| Receipt | `receipt 待验证` / `receipt 已验证` / `receipt 校验失败` |
| Source projection | `ready · 有可用播放源` / `no_source · 暂无可用播放源` / `repairing · 修复进行中` / `source_failed · 来源读取失败` |
| Missing fact | `尚未上报` for provider/lease fields and `等待对账` for reconciliation fields; preserve the known current source projection |
| Same-movie action | `查看影片` on a terminal repair run, using the server-owned movie code link |
| Provider link | `打开 provider run #N` as visible link text; provider URL is a fixed allowlisted link target |
| Log pagination | `加载更早日志`; safe log empty state: `此运行尚未产生可显示的结构化日志；页面可见时会每 5 秒刷新。` |

Copy stays concise, factual, and operational. `repair_players`, `movieId`, `sourceRevision`,
`attempt`, `providerRunAttempt`, and bounded reason codes remain visible as code/data labels when
they are the source-of-truth identifier.

---

## Phase Surface Contract

### 1. Identity strip

The top of the detail surface shows, in one line at desktop and a wrapped stack on mobile:

- movie title, movie code, movie/content ID, and the fixed `repair_players` operation;
- task ID, current application attempt, task-level status/retry indicator, and source revision;
- the current source disposition and the only action currently allowed by the server-owned
  `allowedNextAction` projection.

Identity matches are explicit: display `movie.id`/`contentId` and source revision together, and show
`同一内容身份` when task snapshot, receipt, and current readback agree. A validated receipt with a
different movie identity displays `receipt 校验失败` beside the mismatch reason and retains the
current source projection.

### 2. Current-attempt focal point

- Resolve the focal run from `latestRunId` and keep it pinned at the top of the detail surface.
- Render the current status as the largest status signal, followed by a compact attempt timeline:
  `queued/dispatching -> provider accepted -> running -> reconciliation -> receipt/source result`.
- Each timeline step has its own state label and timestamp. Provider acceptance, provider completion,
  repair result, receipt validation, and source readback occupy separate columns/rows.
- During a visible-page refresh every known value remains on screen; `正在更新` is a small inline
  note. Initial load uses `SkeletonCard` blocks shaped like the identity and fact rows.

### 3. Provider, lease, and reconciliation facts

Use a stable 2-column fact grid on desktop and one column on mobile:

| Block | Visible fields |
|-------|----------------|
| Provider | provider, repository, workflow, ref, environment, provider run ID, provider attempt, provider status, provider conclusion, SHA, fixed provider run link |
| Lease | lease result, lease/heartbeat timestamps when present, expiry/recovery outcome |
| Reconciliation | window status, latest bounded outcome, observed-at/processed-at time, `late`/`stale`/`ignored`/`duplicate`/`conflict` result |
| Repair and receipt | repair result, receipt validation result, receipt observedAt, source revision, same-movie identity match |

Provider `dispatch accepted` occupies the provider block while the repair block remains
`修复待校验`. Provider `completed/success` advances only the provider block; validated receipt plus
authoritative readback advances repair success and current source projection.

### 4. Current source projection

- Keep the existing readiness order: identity -> metadata persisted -> source readiness -> playback
  proof boundary -> receipt/source summary. Phase 23 extends the source/receipt summary with
  production reconciliation facts while Phase 24 owns browser playback evidence.
- Show source revision, observedAt, eligible count, bounded source type/health/reason rows, and the
  current next action. For zero rows show `暂无来源观察` with the known disposition and reason.
- Render `direct`, `magnet`, and `TorrServer` rows with `eligible`, `inactive`, `unverified`, or
  `failed` labels. The row carries source type, health, observedAt, reasonCode, and eligibility.
- A `ready` projection and a validated receipt remain distinct from browser playback proof. The
  playback block can say `播放未验证` and points to Phase 24 ownership for actual evidence.

### 5. Bounded attempt history

- Keep the current attempt as the focal surface. Render older attempts as compact expandable rows
  under `旧 attempt 历史`.
- Each older row contains only attempt number, run ID, run status, bounded failure code, provider
  status/conclusion/provider attempt, lease result, reconciliation outcome, receipt validation,
  source revision, observed/terminal time, and late/stale outcome.
- Expansion reveals the same allowlisted facts and the existing cursor-based safe logs for that run.
  A bounded row never turns into a raw runner timeline.
- Identical replay renders `duplicate`; body-conflict renders `conflict`; old valid facts render
  `late`/`stale`/`ignored`. These labels sit on the old attempt row and leave the current source
  projection visually separate.
- Zero attempts shows the task identity plus `等待 attempt 上报`; one attempt shows the current
  focal state without a history heading; many attempts show current first and old rows collapsed.

### 6. Repair entry and same-movie return

- `发起生产修复` is available from a `no_source` or `source_failed` movie when the server projection
  marks the disposition repairable. The confirmation summary contains movie title, current reason,
  and fixed `restore_playable_sources` intent.
- Active same-movie repair shows the current task and a locked duplicate-entry state with
  `当前电影已有活动修复任务，页面聚焦当前 attempt。`
- Terminal repair with `allowedNextAction: create_new_task` reuses the same primary CTA; the server
  rereads the current disposition before creating the new task.
- On success or a terminal repair outcome, `查看影片` returns to the same movie code. The Dashboard
  keeps the task identity, source revision, and validated receipt visible until navigation.

### 7. Safe log surface

- Render structured logs with sequence, time, level, bounded code, safe message, and counts when
  present. Keep the existing 448px maximum viewport, row separators, monospace identifiers, and
  cursor action `加载更早日志`.
- Log loading and provider refresh use `role="status"`; task-load failures use `role="alert"`.
- Provider link text uses the provider run ID; detailed target values remain in the fixed link target
  generated by the allowlisted provider projection.

---

## Projection Allowlist

The Dashboard renderer consumes these bounded projection groups. This table is the UI data contract;
executor state and templates should use these groups instead of passing through provider/runner
objects.

| Projection group | Fields rendered |
|------------------|-----------------|
| Task identity | task ID, movie `{ id, code, title }`, operation, reason, targetIntent, sourceRevision, allowedNextAction, latestRunId |
| Application attempt | run ID, application attempt, run status, created/updated/terminal time, bounded failure code |
| Provider summary | provider, repository, workflow, ref, environment, providerRunId, providerRunAttempt, providerStatus, providerConclusion, SHA, fixed provider run link |
| Lease/reconciliation | bounded lease result/timestamps, reconciliation window/result/timestamps, duplicate/stale/late/ignored/conflict outcome |
| Receipt/readback | receipt validation state, movieId, observedAt, sourceRevision, source count, eligible count, bounded source summary, same-identity match |
| Safe logs | sequence, timestamp, level, code, safe message, bounded counts, cursor |

The projection boundary keeps URL, command, secret, signature material, and raw runner JSON as
service-side source material. The visible provider run link uses the allowlisted repository and
numeric provider run ID; its link text stays bounded.

---

## Component Inventory

| Surface | Existing/recommended implementation | Contract |
|---------|--------------------------------------|----------|
| Task groups | Existing `task-history-grid` / `task-group` in `Crawlers.vue` | Keep movie repair history scannable; group manga ordinary tasks separately when access permits |
| Current detail | Existing `task-detail` extended with `current-attempt-focal` structure | Identity and current attempt lead the surface |
| Operational facts | Existing `readiness-grid` pattern, refactored into labeled fact blocks | Provider, lease, reconciliation, repair, and receipt stay separate |
| Attempt history | Native disclosure or accessible local Vue disclosure | Older attempts start collapsed; current attempt remains pinned |
| Source rows | Existing `source-health-grid` / `source-health-row` | Bounded type, health, observedAt, reason, eligibility |
| Loading | `@starye/ui` `SkeletonCard` plus inline refresh note | Shape matches identity/fact content; prior valid data remains visible during refresh |
| Confirmation | `@starye/ui` `ConfirmDialog` | Required for cancel and fixed production repair submission |
| Logs | Existing `safe-log-scroller` and cursor API | 448px viewport, bounded fields, explicit older-log loading |
| Status iconography | `lucide-vue-next` | Icon + text + semantic state; no hand-drawn SVG |

The page may keep implementation in `Crawlers.vue` or extract local Vue components. Shared UI
components remain the source for skeleton, confirmation, toast, and token behavior; a third-party
registry block has no role in this phase.

---

## Interaction Contract

1. On visible mount, load task lists and details; refresh visible task detail every 5 seconds and
   stop the interval when the page is hidden or unmounted. The existing 30-second statistics refresh
   remains independent.
2. Preserve the selected repair task across refresh. When `latestRunId` changes because of an
   automatic retry, promote the new run to the current focal attempt and keep the previous attempt
   in history.
3. The current attempt's status and fact blocks are read-only projections. A provider link is the
   only provider navigation; provider controls, workflow controls, target controls, and input forms
   are absent from the Dashboard surface.
4. The repair action is enabled only for a server-marked repairable `no_source` or `source_failed`
   disposition. While active, show the same-movie lock copy and current task link. After terminal
   repairable state, the fixed action reopens the confirmation flow with a fresh server read.
5. Cancel uses the inherited confirmation dialog and leaves task/run/log/receipt/source facts
   visible after the response. A cancel request displays `已请求取消` until provider/runner confirms
   its terminal result.
6. A provider `success` observation never closes the repair fact layer by itself. The UI waits for
   receipt validation and authoritative source readback, then shows `修复已验证` and the new source
   revision together.
7. A receipt identity/revision/readback mismatch renders `receipt 校验失败`, a bounded failure code,
   and the allowed next action. The state remains terminal and its attempt facts remain available.
8. Late/stale/duplicate/conflict events render on the originating older attempt. Current source
   projection and current attempt status retain their own visual hierarchy.
9. Use visible text for all actions. Icon-only refresh/disclosure controls need tooltip and
   `aria-label`; keyboard users can focus every task, disclosure, action, link, and modal control.
10. Use `aria-live="polite"` for current readback, `role="status"` for in-flight/loading state, and
    `role="alert"` for task-load, provider, reconciliation, or receipt failure.
11. Respect `prefers-reduced-motion`; Skeleton shimmer falls back to the existing pulse treatment.

---

## UI Considerations

> Shape-rooted state coverage for the production repair task surface. Copy is defined above in
> `## Copywriting Contract`; these rows state the visual/interaction truth for each lifecycle shape.

Applicable state considerations resolved: 15 covered, 0 backstop, 0 unresolved

| Category | Element(s) | Status | Resolution / Reason |
|----------|------------|--------|---------------------|
| empty | repair task collection | ✅ covered | Zero movie repair tasks render the documented empty heading/body and the fixed `发起生产修复` path. |
| empty | current-attempt focal | ✅ covered | A task without a reported run keeps movie identity visible and renders `等待 attempt 上报` with pending fact blocks. |
| loading | task collection and current detail | ✅ covered | Initial load uses `SkeletonCard`; visible refresh retains the last valid projection and shows the inline refresh note. |
| loading | repair confirmation and action | ✅ covered | Submission shows the existing busy CTA state and the confirmation dialog closes only after the fixed command response is consumed. |
| error | task collection/detail | ✅ covered | Task-load failure renders the documented `role="alert"` message with a refresh path while retaining prior valid detail. |
| error | provider/reconciliation/receipt facts | ✅ covered | Provider, reconciliation, and receipt failures render independent bounded outcomes and next actions; provider completion remains a provider fact. |
| populated | current-attempt focal | ✅ covered | `latestRunId` identifies the top focal attempt with identity, status, timeline, fact grid, source projection, and safe logs. |
| populated | source projection | ✅ covered | Ready, no-source, repairing, and source-failed projections show source revision, observedAt, eligible count, bounded source rows, and next action. |
| partial | provider/lease/reconciliation/receipt facts | ✅ covered | Missing lifecycle facts render `尚未上报` or `等待对账`, preserving known source/readback data and avoiding an inferred success state. |
| partial | receipt/source readback | ✅ covered | A receipt with incomplete or mismatched identity/revision/readback facts remains `receipt 校验失败` with the current projection and bounded reason. |
| overflow | older attempt history | ✅ covered | Older attempts use collapsed bounded rows; the expanded history uses allowlisted fields and a constrained vertical region. |
| overflow | safe structured logs | ✅ covered | Logs use the existing 448px max-height viewport, wrapped messages, horizontal structured-column overflow, and cursor pagination. |
| zero-one-many | attempt history | ✅ covered | Zero attempts show the pending identity state; one shows only the current focal state; many show current first and older attempts collapsed. |
| long-text | identity, failure codes, provider metadata, safe messages | ✅ covered | IDs and messages wrap at any character; codes and provider metadata preserve readable labels with bounded ellipsis/link text. |
| long-text | repair action/confirmation | ✅ covered | Movie title and bounded reason wrap inside the confirmation surface; action controls keep the 44px target and stable width. |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | none | not required; `components.json` is absent |
| Third-party registries | none | not applicable; existing `@starye/ui` components and local Vue markup are the implementation sources |

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending

---

## Contract Sources

| Source | Decisions used |
|--------|----------------|
| `23-CONTEXT.md` | D-01 through D-17: movie-only repair, existing workflow/provider boundary, one bounded automatic retry, late-event reconciliation, current-attempt focus, bounded attempt history, allowlisted provider summary, and same-movie identity |
| `23-PATTERNS.md` | Existing API/UI projection shape, 5-second visible polling, provider/readback separation, safe log cursor, responsive Dashboard patterns, and focused test expectations |
| `Crawlers.vue`, `Crawlers.test.ts`, `api.ts` | Existing task detail, readiness/source-health order, repair confirmation, same-movie link, provider summary, safe logs, typed API fields, and regression fixtures |
| `@starye/ui` and Dashboard styles | CSS variable tokens, Tailwind v4 utility conventions, 44px action targets, Skeleton/ConfirmDialog/Toast primitives, and reduced-motion treatment |
| `STATE.md`, `ROADMAP.md`, `REQUIREMENTS.md`, Phase 21/22 verification | REP-02/REP-03 success criteria and the production/provider/Viewer boundary carried into Phase 23 |

