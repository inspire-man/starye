---
phase: 24
slug: fresh-production-dashboard-viewer-playback-proof
status: draft
shadcn_initialized: false
preset: none
created: 2026-08-08
---

# Phase 24 - UI Design Contract

> Visual and interaction contract for the fresh production Dashboard -> Viewer -> playback proof.
> The operator must be able to distinguish provider progress, repair/receipt validation, source
> readiness, and actual browser playback from one bounded, redacted trace.

## Design System

| Property | Value |
|----------|-------|
| Tool | none - manual `@starye/ui` system |
| Preset | not applicable; `components.json` is absent |
| Component library | `@starye/ui` shared Vue components; existing Tailwind v4 token system |
| Icon library | `lucide-vue-next` |
| Font | `system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif` |

### Existing system contract

- Import the existing `@starye/ui/globals.css` boundary and use token classes or
  `hsl(var(--token))`; do not add hardcoded component-local colors.
- Reuse `SkeletonCard`, `ConfirmDialog`, `Toast`/`useToast`, existing Dashboard task-detail
  markup, MovieDetail source cards, and Player media-state presentation.
- Use `lucide-vue-next` icons with visible labels. Icon-only refresh, disclosure, or back controls
  require an `aria-label` and tooltip. Use familiar icons such as `Play`, `RefreshCw`, `CircleCheck`,
  `CircleAlert`, `LoaderCircle`, `Clock3`, `History`, `ShieldCheck`, `ExternalLink`, `Wrench`,
  and `TimerOff`.
- Keep Dashboard content at the existing 1400px maximum width and 1023px single-column
  breakpoint. The Gateway origin `http://localhost:8080` is the canonical local route.
- This phase has no third-party registry blocks and introduces no second player or evidence UI
  system. Existing Vue surfaces remain the implementation boundary.

### Locked visual boundary

- Use one fresh production `task/run/attempt/provider` tuple. Show the tuple identity in the
  Dashboard task detail and carry the same content ID and source revision through MovieDetail and
  Player.
- Keep provider success, repair/receipt success, source state, and actual playback as four
  separate fact blocks. A single overall success badge is prohibited.
- The Dashboard command exposes only the server-owned movie identity, bounded reason, and target
  intent. Never render URL, command, workflow input, secret, cookie, token, signature material, or
  raw runner JSON.
- The historical Phase 13 carrier is not a current attempt, is not a selectable proof source, and
  must not appear as a production-pass shortcut.

## Spacing Scale

Declared values (must be multiples of 4):

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Icon-to-label gaps, status dot gaps, event separators |
| sm | 8px | Badge padding, fact-row gaps, compact control spacing |
| md | 16px | Surface padding, fact grid gaps, source-row padding |
| lg | 24px | Section padding, fact-group separation, Viewer state panel separation |
| xl | 32px | Page content gaps, Dashboard header-to-detail and MovieDetail-to-player gaps |
| 2xl | 48px | Major evidence/history breaks |
| 3xl | 64px | Page-level breathing room at wide desktop widths |

Exceptions: 44px minimum height for every Play, repair, refresh, disclosure, link, and modal
control; 1px token borders; 448px maximum height for structured logs/evidence details; 1023px
breakpoint for single-column layout.

### Layout contract

- Dashboard desktop order: identity strip -> current attempt -> provider facts -> repair/receipt
  facts -> current source projection -> playback evidence summary -> bounded logs -> older attempts.
- MovieDetail order: movie identity/readiness -> source cards -> playback proof boundary -> source
  action. The selected source card must visibly identify the same content ID and source revision.
- Player order: player frame -> explicit Play control -> media state -> bounded retry/fallback
  status -> compact evidence summary. The Play control must remain visible until the user clicks it.
- At or below 1023px, all fact grids become one column, metadata wraps, action rows become full
  width, and evidence/log regions retain bounded vertical height with horizontal overflow for
  structured columns.
- Use framed panels only for the task-detail focal surface, source cards, Player state/evidence,
  and expandable attempt rows. Keep the surrounding page as an unframed layout band.
- IDs, hashes, failure codes, safe messages, and artifact references use `overflow-wrap: anywhere`.
  Links remain short and human-readable even when their destination is long.

## Typography

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Body | 14px | 400 | 1.5 |
| Label | 12px | 600 | 1.2 |
| Heading | 20px | 600 | 1.2 |
| Display | 28px | 600 | 1.15 |

Weights are limited to regular 400 and semibold 600. Use 12px labels for tuple IDs, provider,
source type, event names, timestamps, and state metadata. Use 14px for bounded reasons and user
actions. Use 20px for section headings and 28px only for the Dashboard task/movie title or the
Viewer title at the existing page hierarchy.

## Color

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `hsl(var(--background))` (light fallback `#ffffff`) | Page canvas, player surround, large whitespace |
| Secondary (30%) | `hsl(var(--muted))` (light fallback `#f1f5f9`) | Fact panels, history rows, pending/loading surfaces, evidence timeline background |
| Accent (10%) | `hsl(var(--primary))` | Current-attempt outline, selected source, visible Play CTA, current evidence focus, same-movie link |
| Destructive | `hsl(var(--destructive))` | Media error, receipt mismatch, terminal failed/checkpoint callout, proof reallocation confirmation |

Accent reserved for: the current attempt focus ring, the selected eligible source, the primary
`发起生产修复` action, the visible `播放` action, the current evidence section, active refresh, and
the server-owned same-movie navigation link. Accent must not merge provider, repair, source, and
playback states into one visual status.

### Status encoding

- Every state uses icon + text + semantic role; color never carries the only meaning.
- `queued`/`running` use `Clock3`/`LoaderCircle`; provider acceptance uses `ShieldCheck`; validated
  receipt uses `CircleCheck`; source ready uses `CircleCheck`; playback verified uses `CircleCheck`
  plus the explicit `播放已验证` label; failed/error uses `CircleAlert`; retry uses `RefreshCw`;
  stale/late/ignored uses `History` or `TimerOff`; the Play action uses `Play`.
- `canplay` is labeled `可开始播放`, `playing` is labeled `播放已开始`, and currentTime progress
  is labeled `播放进度已推进`. None of these labels may be inferred from page load, HTTP status,
  player DOM presence, screenshot, or provider success.

## Copywriting Contract

| Element | Copy |
|---------|------|
| Primary CTA | `发起生产修复` |
| Empty state heading | `暂无可追溯的播放证据` |
| Empty state body | `先从可修复的 no_source 或 source_failed 影片发起生产修复；完成同一 fresh tuple 后，Dashboard 会显示 Viewer 与播放证据。` |
| Error state | `播放证据未完成：保留当前 attempt 和脱敏证据。请检查前置条件或媒体错误后，重新分配 fresh task。` |
| Destructive confirmation | `重新分配 fresh proof：当前 task/run/attempt/provider 的失败或 checkpoint 证据会保留，不会覆盖历史；确认后创建新的生产验证 tuple。` |

### State and action labels

| Fact or state | Required copy |
|---------------|---------------|
| Provider | `Provider 已受理` / `Provider 运行中` / `Provider 已完成` / `Provider 未受理` |
| Repair/receipt | `修复待校验` / `修复已验证` / `receipt 已验证` / `receipt 校验失败` |
| Source | `ready · 有可用播放源` / `no_source · 暂无可用播放源` / `repairing · 修复进行中` / `source_failed · 来源读取失败` |
| Playback | `播放未验证` / `播放准备中` / `可开始播放` / `播放已开始` / `播放已验证` / `播放失败` |
| Playback evidence | `canplay：已观察` / `playing：已观察` / `waiting：未观察` / `stalled：未观察` / `error：未观察` / `currentTime 推进：已验证` |
| Missing fact | `尚未上报` for provider/receipt/source facts; `等待浏览器证据` for playback |
| Checkpoint | `checkpoint：前置条件或证据写入未满足` |
| Failed | `failed：完整 tuple 在有界窗口内终态失败` |
| Viewer action | `打开影片` -> source card -> `播放` |
| Bounded retry | `重试当前来源（第 1/2 次）` / `切换下一个可用来源` / `进入 TorrServer/Aria2 路径` |
| Evidence artifact | `查看脱敏证据摘要` / `artifact reference` |
| History | `旧 attempt 历史` / `late` / `stale` / `ignored` / `duplicate` / `conflict` |

Copy stays factual and concise. Technical identity fields such as `taskId`, `runId`, `attempt`,
`providerRunId`, `contentId`, `sourceRevision`, `currentTimeBefore`, `currentTimeAfter`, and
`delta` remain visible as bounded code/data labels when they are the source-of-truth identifiers.

## Phase Surface Contract

### 1. Dashboard fresh tuple and current-attempt focus

- The identity strip shows movie title/code, `contentId`, `repair_players`, task ID, current
  application attempt, `runId`, provider run/attempt, target label, and `sourceRevision`.
- Pin the current attempt from the server's current/latest attempt projection. When a bounded retry
  creates a new attempt, move it to the focal position and keep the previous attempt collapsed in
  history.
- The attempt timeline is explicit: `Dashboard command -> queued -> provider accepted -> provider
  running -> repair/receipt -> source readback -> Viewer -> playback evidence`.
- Each timeline step has its own status, timestamp, and tuple match. A missing step renders
  `尚未上报` or `等待浏览器证据`; it never upgrades to success from a later step alone.

### 2. Separate fact blocks

Render four independently titled blocks in a stable desktop grid:

| Block | Required visible facts |
|-------|------------------------|
| Provider | provider label, numeric provider run ID/attempt, status/conclusion, bounded provider link, target label |
| Repair / receipt | repair result, receipt validation, authoritative readback, content identity match, source revision match |
| Source | disposition, source revision, observedAt, eligible count, bounded source type/health/reason rows |
| Actual playback | Viewer path, selected source type, canplay/playing/waiting/stalled/error observations, currentTime before/after/delta, playback result |

Provider acceptance or green Actions completion advances only the Provider block. Validated
receipt/readback advances only Repair/receipt. `ready` advances only Source. `playing` plus at
least 1 second of currentTime progress advances Actual playback. A proof pass requires all four
blocks on the same fresh tuple, content ID, and source revision.

### 3. MovieDetail source handoff

- `打开影片` returns to the same server-owned movie identity, never a second movie editor or a
  search result.
- MovieDetail keeps metadata persisted, source readiness, receipt/source summary, and playback
  proof visually separate. A `ready` source card can still say `播放未验证`.
- The chosen source card shows source type (`direct`, `magnet`, `TorrServer`, or `Aria2`), bounded
  health, eligibility, observedAt, source revision, and the current tuple reference. Do not render
  raw source URL or signed query material.
- Prefer the first eligible `direct` source. Only when no eligible direct source exists, show the
  controlled TorrServer/Aria2 route. The actual selected type is carried into the evidence summary.

### 4. Player and visible Play contract

- `autoplay` remains false. The player frame must expose a visible, keyboard-focusable `播放` button
  with `Play` icon and text. The proof runner clicks this button; it does not call `evaluate().play()`
  or inject `readyState`.
- Before click, show `播放未验证` and `等待用户播放`; after click, show `播放准备中` until
  `canplay`, then `可开始播放`, then `播放已开始` on `playing`.
- After `playing`, show `currentTimeBefore` and wait in a bounded observation window for
  `currentTimeAfter - currentTimeBefore >= 1s`. Only then show `播放已验证`.
- `waiting`, `stalled`, and non-terminal buffering remain visible as observed event rows. A terminal
  `error`, invisible Play button, ineffective click, policy block, or timeout shows `播放失败` or
  `checkpoint` with the actual bounded reason and next action.
- Retry the current source at most twice. On exhaustion, expose the next eligible source or the
  controlled TorrServer/Aria2 path. Once all candidates are exhausted, stop and show a bounded
  repair/report action; never loop back to the same source.

### 5. Evidence summary and redaction

- Show an allowlisted event timeline with explicit observed/not-observed rows for `canplay`,
  `playing`, `waiting`, `stalled`, and `error`, plus event time and source attempt number.
- Show `currentTimeBefore`, `currentTimeAfter`, and `delta` as numbers, and show the bounded
  observation window and terminal result. Do not show full media, raw network logs, response HTML,
  cookies, authorization, tokens, signed URLs, HMAC/signature data, or raw runner JSON.
- Dashboard reads the D1 bounded summary and artifact reference only. The JSON artifact is the
  canonical evidence source; Markdown is its deterministic projection. Neither is treated as a
  second playback fact.
- Duplicate payloads show `duplicate`; conflicting payloads show `conflict`; late/stale evidence
  stays in rejection/history and never changes the current playback projection.
- Show artifact status (`已写入脱敏 JSON/Markdown` or `artifact 写入失败`) and reference, never a
  public media or signed artifact URL.

### 6. Failure and checkpoint semantics

- Missing signed session, selected target, run allocation, evidence root, authenticated route,
  tuple match, or artifact/D1 persistence is `checkpoint`. Preserve partial facts and show the
  next precondition.
- A complete tuple that reaches a bounded provider/repair/browser terminal failure is `failed`.
  Preserve provider/repair/source successes and show playback failure separately.
- Proof failure ends the current tuple. The only next proof action creates a new fresh
  task/run/attempt/provider tuple; never overwrite or reuse the failed tuple.
- A late or stale old attempt is visible as `late`/`stale`/`ignored` and leaves the current attempt,
  source projection, and `playback_verified` projection unchanged.

## Interaction Contract

1. Start the proof only from the authenticated Dashboard `repair_players` command. The confirmation
   summary shows movie identity, bounded reason, target label, and the current repairable disposition.
2. On visible mount, load task list/detail and refresh the visible task every 5 seconds. Stop polling
   when hidden or unmounted. Keep the last valid projection visible during refresh and show a small
   `正在更新` status.
3. Preserve current-attempt focus across polling. A new current attempt is promoted; older attempts
   remain collapsed and immutable in bounded history.
4. Enable `打开影片` only when the server projection has a same-movie identity and source revision.
   Navigate through the existing Dashboard -> MovieDetail -> source card -> Player path.
5. Do not start media automatically. The visible Play button is the only proof trigger and must
   remain usable by keyboard and real browser click.
6. Drive Player status from media events and time readings. Do not infer playback from navigation,
   DOM presence, HTTP 2xx/206, source string existence, `canplay` alone, screenshot, trace, or
   provider success.
7. Keep current-source retry bounded at two attempts, record each source attempt, and expose the
   next allowed fallback. All candidate failure ends in a stable state with an actionable next step.
8. Submit one tuple-bound terminal evidence summary through the server-owned authenticated endpoint.
   Identical payloads return stable `duplicate/accepted`; conflicts return `conflict`; current
   projection remains the first valid fact.
9. Use `aria-live="polite"` for polling/readback and media progress, `role="status"` for loading or
   in-flight playback, and `role="alert"` for provider, receipt, source, media, checkpoint, and
   persistence failures. Respect `prefers-reduced-motion`.
10. Keep all actionable controls at 44px minimum height. Icon-only controls require tooltip and
    `aria-label`; focus order follows the visual chain from tuple -> current attempt -> source ->
    Play -> evidence -> history.

## Projection Allowlist

| Projection group | Fields rendered |
|------------------|-----------------|
| Fresh tuple identity | taskId, runId, attempt, providerRunId, providerRunAttempt, targetLabel, contentId, movie code/title, operation, sourceRevision |
| Provider summary | provider label, status, conclusion, bounded provider link, observedAt, bounded outcome code |
| Repair/receipt | repair status, receipt status, readback status, movieId/contentId match, sourceRevision match, observedAt, bounded source summary |
| Source projection | disposition, sourceRevision, observedAt, eligible count, source type, health, eligibility, bounded reason code |
| Viewer path | Dashboard task detail route, MovieDetail route, source card identity, Player route, selected source type |
| Playback evidence | canplay/playing/waiting/stalled/error observed flags/timestamps, currentTimeBefore, currentTimeAfter, delta, bounded window, playback result |
| Evidence artifact | redacted JSON/Markdown pair status, tuple-bound artifact reference, duplicate/conflict/stale outcome |
| History | older attempt ID/run ID, terminal status, bounded failure code, provider/repair/source/playback summaries, late/stale/ignored result |

The projection boundary excludes raw source URL, signed query, token, cookie, Authorization,
session/nonce/signature material, workflow/command payload, secret, full media, response HTML,
network log, and raw runner JSON.

## Component Inventory

| Surface | Existing/recommended implementation | Contract |
|---------|--------------------------------------|----------|
| Dashboard task detail | Existing `Crawlers.vue` current-attempt/task-detail patterns | Identity and current attempt lead; four fact layers remain separate |
| Current attempt | Existing current-attempt focal/timeline pattern | Pin latest server attempt; keep retries/history bounded |
| Provider/receipt/source facts | Existing `fact-grid`, `readiness-grid`, `source-health-row` patterns | Separate titles, status icons, bounded fields, no overall success badge |
| Viewer handoff | Existing MovieDetail source card and same-movie route | Carry content ID/source revision and selected source type |
| Player | Existing `Player.vue` xgplayer lifecycle and media-state UI | `autoplay: false`, visible Play, event-driven status, bounded retry |
| Play control | Existing tokenized button style with `lucide-vue-next/Play` | 44px target, visible label, focusable, stable size before/after click |
| Evidence timeline | Local Vue markup using semantic list/table | Allowlisted events, observed/not-observed state, numeric time delta |
| Loading | `@starye/ui` `SkeletonCard` plus inline refresh note | Preserve prior data during polling; shape matches fact blocks |
| Confirmation | `@starye/ui` `ConfirmDialog` | Confirm repair command and new fresh tuple allocation; no destructive history deletion |
| Feedback | `@starye/ui` `Toast`/`useToast` | Short accepted/checkpoint/duplicate feedback; detailed facts stay in the surface |
| Attempt history | Native accessible disclosure | Older attempts collapsed; stale/late/conflict facts stay on originating row |
| Logs/artifact reference | Existing safe-log scroller and bounded artifact reference | 448px max viewport; no raw runner or signed material |
| Status iconography | `lucide-vue-next` | Icon + text + semantic role; no hand-drawn SVG |

## UI Considerations

> Shape-rooted state coverage for the Dashboard, MovieDetail, Player, and evidence surfaces. Copy
> is defined above; these rows state the concrete visual and interaction truth for each shape.

Applicable state considerations resolved: 20 covered, 0 backstop, 0 unresolved

| Category | Element(s) | Status | Resolution / Reason |
|----------|------------|--------|---------------------|
| empty | evidence collection | ✅ covered | Zero evidence renders `暂无可追溯的播放证据` and the documented repair/start path. |
| empty | source projection | ✅ covered | No eligible source keeps `no_source`/`source_failed`, bounded reason, and repair action visible. |
| loading | Dashboard task/detail | ✅ covered | Initial load uses SkeletonCard; polling preserves last valid facts and shows `正在更新`. |
| loading | MovieDetail/Player | ✅ covered | Source and player shells show pending state without claiming ready or playback. |
| loading | evidence timeline | ✅ covered | Events render `等待浏览器证据` until observed; no success inferred from empty timeline. |
| error | provider/repair/receipt | ✅ covered | Each block reports its own bounded error; provider success never advances repair/receipt by itself. |
| error | source/media | ✅ covered | `source_failed` and `播放失败` show reason, bounded retry/fallback, and repair/report next action. |
| error | evidence persistence | ✅ covered | Artifact/D1 failure renders checkpoint, preserves partial evidence, and blocks pass. |
| populated | current attempt | ✅ covered | Fresh tuple, identity, status timeline, four facts, Viewer path, and evidence summary are visible. |
| populated | actual playback | ✅ covered | `canplay`, `playing`, two currentTime values, delta, selected source type, and terminal result are shown. |
| partial | provider/receipt/source | ✅ covered | Missing facts show `尚未上报` or `等待浏览器证据` and retain known facts without success inference. |
| partial | playback events | ✅ covered | `waiting`, `stalled`, and `error` explicitly show observed or `未观察`; absent events are not omitted ambiguously. |
| partial | tuple match | ✅ covered | ID/revision mismatch shows `checkpoint`/`receipt 校验失败` and blocks playback projection update. |
| overflow | older attempts | ✅ covered | Older rows are collapsed and bounded; expanded history uses allowlisted fields only. |
| overflow | logs/evidence | ✅ covered | Structured viewport is max 448px, messages wrap, columns scroll horizontally, and history is paginated. |
| zero-one-many | attempts/sources | ✅ covered | Zero shows pending/no-source; one focuses current; many keep current first and old attempts collapsed. |
| zero-one-many | playback retries | ✅ covered | One source gets at most two attempts; many sources advance without revisiting; all exhausted ends stable. |
| long-text | IDs/reasons/artifact refs | ✅ covered | Values wrap anywhere; visible links remain short and controls keep stable width. |
| long-text | movie title/confirmation | ✅ covered | Text wraps inside the confirmation and detail surfaces without pushing actions below the viewport. |
| accessibility | Play and state updates | ✅ covered | Play is visible/focusable; event and polling updates use live regions; errors use alert semantics. |

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | none | not required; `components.json` is absent |
| Third-party registries | none | not applicable; existing `@starye/ui` and local Vue components are the sources |

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending

## Contract Sources

| Source | Decisions used |
|--------|----------------|
| `24-CONTEXT.md` | D-01 through D-29: fresh tuple, selected target/session checkpoint, direct-first source policy, visible Play, bounded media evidence, current-attempt focus, separate fact layers, redaction, immutable artifacts, checkpoint/failed, stale/late handling |
| `ROADMAP.md`, `REQUIREMENTS.md`, `STATE.md` | EVID-01/EVID-02/EVID-03, Phase 13 carrier freeze, Gateway route, production Puppeteer boundary, current Phase 24 planning state |
| `SUMMARY.md`, `STACK.md`, `PITFALLS.md` | Vue/xgplayer/Playwright stack, `playing` + currentTime threshold, Gateway canonical URL, evidence allowlist, media failure and false-success pitfalls |
| Phase 23 UI-SPEC and existing `Crawlers.vue` | Current-attempt focal layout, 5-second polling, fact-grid/source-health patterns, bounded history, provider/receipt separation, 44px controls, safe logs |
| `packages/ui/src/assets/globals.css`, `packages/ui/tailwind.config.ts`, `starye-ui-components` | CSS variable tokens, Tailwind v4 conventions, shared component boundaries, icon and interaction rules |
