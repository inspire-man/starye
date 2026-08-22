# Phase 26: Video Source And Magnet Availability - Research

**Researched:** 2026-08-12
**Domain:** Revision-bound video source probing, controlled magnet resolution, playback evidence, and availability projection
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

### Availability Status Hierarchy
- **D-01:** Movie detail and task-result surfaces always show metadata persisted, direct source, magnet source, and playback readiness as four independent layers. Success in one layer never hides failure or uncertainty in another.
- **D-02:** When a layer has multiple sources, its summary shows the best available result together with available and abnormal source counts. Individual source facts remain available below the summary.
- **D-03:** An expired observation preserves its last determinate result, observation time, and evidence identity but is marked `stale` with a recheck prompt. Staleness does not erase historical truth or silently imply current availability.
- **D-04:** The overall user-facing status is driven primarily by playback readiness. When playback is failed or unknown, the summary explains useful lower-layer facts such as source available but playback not yet verified.

### Direct Source Classification
- **D-05:** Direct sources use staged probing: URL validation, bounded HTTP redirects, a small Range request, then a controlled browser only for challenges, contradictory responses, or uncertain media type.
- **D-06:** `available` requires a successful final response plus credible media `Content-Type` or bounded byte evidence. Redirect count and response size must remain inside the active probe policy.
- **D-07:** Anti-hotlinking, CAPTCHA, JavaScript challenges, and required-header barriers are `blocked`, with the blocking reason retained. A result may upgrade to `available` only after the controlled browser loads media successfully.
- **D-08:** Timeouts, DNS failures, and probe infrastructure errors are `uncertain`, not source failure. Preserve the most recent determinate observation and mark it stale or pending recheck.

### Magnet And TorrServer Classification
- **D-09:** Magnet syntax, metadata, peer/download progress, stream readiness, and playback readiness are independent facts. Magnet syntax validity, resolver acceptance, metadata, or peers alone never establish user availability.
- **D-10:** Metadata success without a peer or download progress in the bounded window becomes `no_peer` or `stalled`, while preserving the metadata success fact and allowing a later recheck.
- **D-11:** A generated TorrServer stream endpoint is `stream_ready`; it becomes `playback_ready` only after controlled evidence of real player consumption.
- **D-12:** Aria2/TorrServer reachability, authentication, and resolver errors are provider failures such as `provider_unavailable`, `auth_failed`, or `resolver_failed`. They do not prove the magnet content is unavailable.

### Recheck And Repair Experience
- **D-13:** Each abnormal finding emphasizes one reason-specific action: recheck for `stale` or `uncertain`, repair for `blocked` or `source_failed`, and service-configuration guidance for provider failures.
- **D-14:** Recheck and repair progress stays inline with the finding and displays the receipt plus `queued`, `running`, and `readback` stages. Current projection changes only after authoritative readback for the same movie/source revision.
- **D-15:** A successful result for an old movie/source revision is retained in history, clearly labeled as old-revision evidence, and never promoted to current. The UI prompts a new check for the current revision.
- **D-16:** Findings default to a concise status, reason, freshness, revision, and receipt summary. Expanded detail is bounded and redacted: no full URLs, signed material, credentials, raw responses, cookies, or unbounded media samples.

### the agent's Discretion
- Exact freshness windows, retry counts, redirect limits, byte-sample sizes, timeout values, and browser escalation thresholds are planner/researcher decisions, provided they are bounded and policy-versioned.
- Exact component composition and labels may follow existing Dashboard and MovieDetail conventions while preserving the four-layer facts and reason-specific actions above.

### Deferred Ideas (OUT OF SCOPE)

None - discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| VID-01 | 分别查看 metadata、direct、magnet 和 playback readiness。 | 四层 projection、best result + counts、playback-first aggregate，且现有 readiness/playback evidence 可复用。 |
| VID-02 | 对每个 direct source 执行 URL/HTTP/Range/浏览器检查并分类。 | 分阶段 probe adapter、明确 200/206/416 与浏览器升级条件、bounded evidence policy。 |
| VID-03 | 经受控 Aria2/TorrServer 检查 metadata、peer/progress、stream 与播放。 | provider adapter 状态机、provider failure 与 content failure 分离、现有代理/客户端边界复用。 |
| VID-04 | 保存 revision-bound observation/current projection。 | 复用 Phase 25 append-first repository、CAS、policyVersion、authoritative readback 与旧 revision history。 |
| VID-05 | finding 发起幂等 recheck/repair，并经 receipt/同 revision 读回推进。 | 扩展 closed operation registry、reason-specific intent、inline progress、authoritative owner/readback 规则。 |
</phase_requirements>

## Summary

Phase 26 应作为 Phase 25 通用 availability control plane 上的视频领域适配层实现，而不是创建新的任务、观察、投影或缓存系统。现有仓库已经提供 server-owned operation snapshot、幂等 fingerprint、append-only `crawler_availability_observation`、CAS-protected `crawler_availability_current`、receipt/readback、旧 revision history、播放消费证据以及经过认证和 allowlist 的 Aria2 代理。新增工作集中在视频专用 operation/policy、逐 source probe 结果、四层聚合 projection 和两个 UI readback surface。[VERIFIED: codebase grep — `apps/api/src/domain/crawler-tasks/*`, `packages/db/src/schema.ts`, `apps/api/src/domain/playback-evidence/*`]

Direct source 要使用一个纯分类器驱动的 staged adapter：先拒绝不允许的 scheme/host/地址，再在固定 redirect、timeout 和 body budget 内发起单一 byte Range；`206` 应校验 `Content-Range`，`200` 表示服务端可能忽略 Range，必须在客户端主动截断读取，`416` 是明确的 range/content 异常而不是网络不确定。[CITED: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Range] 浏览器探测只处理挑战、矛盾响应或媒体类型不确定，输出允许的事件/状态代码；`HTMLMediaElement.readyState` 只表示缓冲准备程度，真正 `playback_ready` 仍要求 Phase 20-24 已建立的 `playing` 加 `currentTime` 前进证据。[CITED: https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/readyState] [VERIFIED: `apps/movie-app/src/views/Player.vue`]

Magnet 检查必须通过 provider adapter 读取 Aria2/TorrServer 的 bounded state，而不把 magnet 当 HTTP URL。Aria2 官方接口区分 magnet metadata-only、BitTorrent peers/download fields 和任务状态；仓库已有 JSON-RPC proxy 与 `tellStatus` 客户端。TorrServer 当前主要在浏览器侧生成 trusted stream URL，因此 Phase 26 需要将系统检查收口为受控 provider boundary，或把不可在 runner 环境证明的状态诚实标为 provider/stream unknown；endpoint 生成依然不构成播放消费证据。[CITED: https://aria2.github.io/manual/en/html/aria2c.html] [VERIFIED: codebase grep — Aria2 route/client and TorrServer client]

**Primary recommendation:** 按 contract/policy、direct adapter、magnet provider adapter、API/UI action/readback 四个计划实施；所有 probe 结果先 append，再由同 movie/source revision、policy 和 authoritative owner 的读回推进 current。

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Operation/policy registry | API / Backend | Runner | API 生成不可变 server-owned snapshot；runner 只执行已签名策略。 |
| Direct URL/HTTP/Range probe | Runner / Provider | API / Backend | 网络访问发生在受控执行环境；API 校验并持久化 bounded result。 |
| Controlled browser escalation | Runner / Provider | API / Backend | 浏览器属于既有 provider 执行边界，不在 Cloudflare Worker 内运行。 |
| Magnet/Aria2/TorrServer probe | Runner / Provider | API / Backend | provider 状态不能由浏览器输入自证；API 只接收 tuple-bound observation。 |
| Observation/current projection | Database / Storage | API / Backend | D1 append history 与 CAS current 是权威事实源。 |
| Playback readiness | Browser / Client | API / Backend | 浏览器产生真实消费事件，API 通过现有 evidence contract 验证并投影。 |
| Dashboard/MovieDetail display/actions | Browser / Client | API / Backend | UI 渲染服务端 projection，并提交 closed reason-specific command。 |

## Project Constraints (from AGENTS.md)

- 默认中文沟通、分析、验证和交付。
- Phase 实施必须走 `$gsd-execute-phase`；本研究只写 canonical phase research 文档。
- 当前约束以 `.planning/*` 为准；文档只改 canonical owner。
- 本地验收统一使用 `http://localhost:8080/...` Gateway，不把内部开发端口写成 canonical URL。
- 保留脏工作树，不回滚、覆盖、暂存或清理无关改动。
- 修改任何函数、类或方法前必须执行 GitNexus upstream impact analysis；HIGH/CRITICAL 先告警。
- 提交前必须执行 GitNexus `detect-changes`。
- D1 schema 变化必须同步 relations、生成 Drizzle migration、对 local D1 apply migration、构建 `@starye/api-types` 并执行 API type-check。[VERIFIED: `.agents/skills/starye-db-migration/SKILL.md`]
- API 新 endpoint 必须先定义 schema，再用 Hono route/middleware 挂载，并由前端 typed wrapper 消费；Vue component 不直接 raw fetch 新 admin API。[VERIFIED: `.agents/skills/starye-hono-rpc/SKILL.md`]
- UI 优先复用 `packages/ui` 和 shared Tailwind tokens，避免组件内硬编码独立色值。[VERIFIED: `.agents/skills/starye-ui-components/SKILL.md`]

## Standard Stack

### Core

| Library / Facility | Version | Purpose | Why Standard |
|--------------------|---------|---------|--------------|
| Existing TypeScript monorepo | Node 24.0.1 / pnpm 10.33.0 | Contracts, adapters, clients | Installed and used throughout repository; no runtime package addition needed. [VERIFIED: environment/package manifests] |
| Hono + existing schema validators | repository lockfile | Authenticated command/readback routes | Established typed API boundary. [VERIFIED: codebase] |
| Drizzle ORM + Cloudflare D1 | repository lockfile | Append observations/current projection | Phase 25 tables and repository already implement required CAS/readback semantics. [VERIFIED: codebase] |
| Existing crawler runner/provider protocol | repository source | Direct/browser/provider execution | Preserves GitHub Actions production-browser boundary and signed runner callback. [VERIFIED: CONTEXT/ROADMAP/codebase] |
| Existing Aria2 proxy/client | aria2 protocol docs 1.37.0 | Controlled magnet status | Auth, method allowlisting and bounded JSON-RPC boundary already exist. [CITED: https://aria2.github.io/manual/en/html/aria2c.html] |
| Existing TorrServer client/security utilities | repository source | Controlled torrent-to-stream state | Reuse trusted-origin and client semantics; do not accept arbitrary stream URLs. [VERIFIED: codebase] |
| Existing playback evidence repository | repository source | Real consumption proof | Already binds player evidence to task/run/attempt/provider/content/revision tuple. [VERIFIED: codebase] |

### Supporting

| Facility | Purpose | When to Use |
|----------|---------|-------------|
| Native `fetch` / runner HTTP client | Bounded Range probe | Direct sources only, with manual redirect and abort/body limits. |
| Existing controlled browser adapter | Challenge/contradiction/media-type escalation | Only after HTTP classifier returns an escalation reason. |
| Vitest / Playwright already in repo | Contract, adapter, UI and canonical evidence tests | Unit fixtures for classifiers; browser tests for visible state and actual playback events. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Phase 25 availability repository | New video tables/repository | Duplicates CAS, ownership, history and cache semantics; reject. |
| Existing runner browser boundary | Browser inside Worker/API | Contradicts deployment boundary and browser availability; reject. |
| Existing Aria2/TorrServer clients | New torrent library | Adds package/supply-chain and lifecycle complexity without solving provider truth; reject. |
| Native staged HTTP | Full media download | Produces storage, bandwidth and denial-of-service risk; reject. |

**Installation:** none. This phase should add no external package, so no Package Legitimacy Audit is required.

## Architecture Patterns

### System Architecture Diagram

```text
Dashboard / MovieDetail finding
        |
        v
typed recheck/repair command -> API auth + closed operation registry
        |                              |
        |                              v
        |                    immutable task snapshot
        |                              |
        v                              v
inline queued/running <------ existing task/run/attempt/provider control plane
                                       |
                     +-----------------+------------------+
                     |                                    |
                     v                                    v
             Direct probe adapter                  Magnet provider adapter
        URL guard -> HTTP -> Range             syntax -> metadata -> peer/progress
                     |                          -> stream endpoint
            uncertain/blocked?                           |
                     v                                   v
              controlled browser                  Aria2 / TorrServer
                     +-----------------+-----------------+
                                       |
                                       v
                         signed bounded observation
                                       |
                         API tuple/revision/policy checks
                                       |
                          append D1 observation history
                                       |
             same revision/policy/owner CAS accepted? -- no --> old/late history only
                                       |
                                      yes
                                       v
                        authoritative current readback
                                       |
                         cache invalidation after readback
                                       |
                    Dashboard/MovieDetail four-layer projection
                                       |
                              Player consumption events
                                       v
                     existing playback evidence projection
```

### Recommended Project Structure and Plan Ownership

```text
26-01 contract/policy
  apps/api/src/domain/crawler-tasks/operation-registry.ts
  apps/api/src/domain/video-availability/*              # domain unions, aggregation, policy
  packages/crawler/src/task-runner/*                    # signed runner payload extensions

26-02 direct adapter
  packages/crawler/src/video-availability/direct-probe.ts
  packages/crawler/src/video-availability/browser-probe.ts
  packages/crawler/src/video-availability/__tests__/*

26-03 magnet providers
  packages/crawler/src/video-availability/magnet-probe.ts
  apps/api/src/routes/aria2/*                            # only if allowlist/shape extension is required
  apps/movie-app/src/utils/torrServerClient.ts           # reuse/centralize trusted client semantics

26-04 API/UI/readback
  apps/api/src/schemas/crawler-tasks.ts
  apps/api/src/routes/admin/crawler-tasks/index.ts
  apps/dashboard/src/lib/api.ts
  apps/dashboard/src/views/Crawlers.vue
  apps/movie-app/src/lib/api-client.ts
  apps/movie-app/src/views/MovieDetail.vue
  apps/movie-app/src/views/Player.vue                    # evidence integration only
```

Exact new filenames may follow adjacent modules, but plans must keep file ownership non-overlapping across waves. Schema expansion belongs in 26-01 only if the existing generic evidence JSON cannot represent bounded per-source facts; prefer contract expansion without new tables.

### Pattern 1: Pure Probe Classification

**What:** I/O adapters collect a bounded raw fact object; a pure classifier converts it to a closed discriminated union. Persist only the union, counts and allowlisted samples.
**When to use:** Direct HTTP/browser and each provider stage.

```typescript
// Source: RFC 9110/MDN semantics plus project bounded-evidence pattern.
type DirectProbeResult =
  | { status: 'available'; reason: 'media_type' | 'byte_signature'; finalHostHash: string }
  | { status: 'blocked'; reason: 'hotlink' | 'captcha' | 'js_challenge' | 'required_header' }
  | { status: 'unavailable'; reason: 'invalid_url' | 'http_failed' | 'range_invalid' }
  | { status: 'uncertain'; reason: 'timeout' | 'dns_failed' | 'probe_failed' }
```

### Pattern 2: Preserve Determinate Fact on Transient Failure

**What:** A transient uncertain probe appends a new history fact and makes the last determinate result stale/pending; it does not overwrite the determinate status with a false content failure.
**When to use:** DNS, timeout, browser infrastructure and provider reachability failures.

### Pattern 3: Layered Magnet State

**What:** Project syntax, metadata, peer/progress, stream and playback fields independently. Compute a summary from them without collapsing evidence.
**When to use:** Every magnet/TorrServer finding.

```typescript
interface MagnetLayerProjection {
  syntax: 'valid' | 'invalid'
  metadata: 'available' | 'missing' | 'unknown'
  transfer: 'progressing' | 'no_peer' | 'stalled' | 'unknown'
  stream: 'ready' | 'missing' | 'unknown'
  playback: 'ready' | 'failed' | 'unknown'
  providerFailure?: 'provider_unavailable' | 'auth_failed' | 'resolver_failed'
}
```

### Pattern 4: Authoritative Readback Gate

**What:** Receipt, runner success or adapter success updates inline operation progress, but current availability changes only after repository readback confirms target/content/revision/policy and current owner. Supersede may transfer owner while original proof tuple remains history.
**When to use:** Recheck/repair completion and cache invalidation.

### Anti-Patterns to Avoid

- **HTTP 200 means available:** HTML challenges and ignored Range requests can return 200; require media type or bounded signature.
- **HEAD-only probe:** Servers/CDNs may treat HEAD differently and it gives no byte evidence; use bounded GET Range as the decisive transport stage.
- **Magnet over HTTP classifier:** Magnet is not an HTTP source and must go through Aria2/TorrServer.
- **Provider accepted means content available:** Acceptance/reachability is a provider fact only.
- **Stream URL means playback ready:** Endpoint generation proves `stream_ready`; only player consumption proves playback.
- **Uncertain overwrites known failure/success:** Retain the determinate observation and mark it stale/pending.
- **Client-supplied URL/header/provider config:** Registry and provider configuration remain server-owned; UI sends identity, reason and revision only.
- **New current cache/table:** Reuse generic current projection and existing cache invalidation ordering.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Task scheduling/retry | Video-specific scheduler | Phase 25 task/run/attempt/provider control plane | Already idempotent, auditable and CAS-protected. |
| Observation/current persistence | Parallel video repository | Phase 25 availability repository | Already handles duplicate/stale/late/conflict and authoritative readback. |
| Torrent engine | BitTorrent parser/downloader | Existing Aria2/TorrServer boundaries | Metadata, peer and streaming lifecycle are complex. |
| Browser orchestration | Browser in API Worker | Existing controlled runner/browser adapter | Preserves production execution boundary. |
| Playback proof | `canplay` or URL success heuristic | Existing playback evidence pipeline | Real consumption needs playing plus time progression. |
| URL security | Regex-only URL acceptance | Existing URL/trusted-origin guards plus DNS/address checks | SSRF, redirects and rebinding require staged enforcement. |

**Key insight:** This phase is primarily a truthful state-model and adapter problem. The difficult behavior is already represented by existing control-plane primitives; custom infrastructure would weaken evidence continuity.

## Common Pitfalls

### Pitfall 1: Range Response Body Escapes the Budget
**What goes wrong:** Origin ignores Range and sends a full movie with `200`.
**Why it happens:** Range support is optional; ignoring the header is permitted behavior.[CITED: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Range]
**How to avoid:** Abort the response after the configured sample budget regardless of status; never call unbounded `arrayBuffer()`.
**Warning signs:** Bytes read exceed policy, missing `Content-Range`, memory/network spikes.

### Pitfall 2: Redirect Bypasses URL Guard
**What goes wrong:** An allowed public URL redirects to loopback/private/link-local or an unsupported scheme.
**Why it happens:** Validation is performed only on the initial URL.
**How to avoid:** Manual redirect handling; revalidate every hop, cap hops, strip sensitive headers cross-origin, store only redacted host identity.
**Warning signs:** Private IP resolution, auth headers forwarded to new origin, redirect loops.

### Pitfall 3: Challenge Page Classified as Media
**What goes wrong:** 200 HTML/CAPTCHA is promoted to available.
**Why it happens:** Status-only logic or trusting extension.
**How to avoid:** Require allowlisted media Content-Type or bounded byte evidence; challenge signatures produce blocked/browser escalation.
**Warning signs:** `text/html`, tiny interstitial response, JS/meta refresh, login/CAPTCHA title.

### Pitfall 4: Metadata/Peer/Endpoint Collapsed into Playback
**What goes wrong:** A syntactically valid magnet or generated stream link becomes green playback status.
**Why it happens:** Provider success is easier to observe than real player consumption.
**How to avoid:** Keep five independent fields and join playback only through existing tuple-bound evidence.
**Warning signs:** `playback_ready` without `playing` and positive `currentTime` delta.

### Pitfall 5: Old Revision Wins Race
**What goes wrong:** Slow successful probe promotes after sources changed.
**Why it happens:** Completion is checked against task snapshot but not authoritative current revision/owner.
**How to avoid:** Repository CAS on revision, policy, tuple and projection version; old result history only; follow accepted supersede owner for readback.
**Warning signs:** current revision differs from receipt, projection owner differs from action response.

### Pitfall 6: UI Hides Layer-Specific Failure
**What goes wrong:** Metadata success or one healthy source masks abnormal sources/playback unknown.
**Why it happens:** Single aggregate badge replaces per-layer facts.
**How to avoid:** Four stable rows; best state plus available/abnormal counts; bounded expandable source detail and one reason-specific action.
**Warning signs:** no abnormal count, no freshness/revision, generic retry everywhere.

## Code Examples

### Bounded Range Probe Skeleton

```typescript
// Source: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Range
const response = await fetch(url, {
  headers: { Range: `bytes=0-${policy.sampleBytes - 1}` },
  redirect: 'manual',
  signal: AbortSignal.timeout(policy.timeoutMs),
})

// Read through a byte-budgeted stream helper. A 200 response may ignore Range.
const sample = await readAtMost(response.body, policy.sampleBytes)
```

### Browser Readiness Is Not Consumption

```typescript
// Source: https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/readyState
const buffered = media.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
const consumed = playingObserved && currentTimeAfter - currentTimeBefore >= 1
```

### Same-Revision Promotion Guard

```typescript
// Source: existing Phase 25 AvailabilityCasInput contract.
const result = await repository.appendAndPromote({
  observation,
  expectedSourceRevision: snapshot.sourceRevision,
  expectedPolicyVersion: snapshot.policyVersion,
  expectedProjectionVersion: current?.projectionVersion ?? 0,
  expectedTuple: snapshot.tuple,
})
// Render current only from result.authoritativeReadback.
```

## Recommended Probe Policy v1

These values are planner discretion and should be encoded in a named, immutable `video-source-probe/v1` policy rather than scattered constants. They are recommendations, not protocol facts.[ASSUMED]

| Control | Recommendation | Classification effect |
|---------|----------------|-----------------------|
| URL length/schemes | max 2 KiB; HTTPS/HTTP direct only | invalid -> `invalid_url` |
| Redirects | max 3, revalidate every hop | excess/unsafe -> `blocked` or `invalid_url` |
| Connect/response timeout | 5 s per HTTP stage, 12 s total direct path | timeout -> `uncertain` |
| Range sample | `bytes=0-65535`, read at most 64 KiB | enough for content-type/signature without media download |
| Browser escalation | max 15 s, one source at a time, no persisted cookies | timeout/infrastructure -> `uncertain` |
| Magnet metadata window | 30 s | absent -> `metadata_missing` or provider uncertainty by evidence |
| Peer/progress window | 60 s, sample every 5 s, require peer or positive completed-length delta | metadata + no peer -> `no_peer`; no delta with peers -> `stalled` |
| Freshness | direct 6 h; magnet/provider 30 min; playback remains tied to revision and evidence age | expired -> retain result + `stale` |
| Evidence | max 20 source rows, max 5 abnormal samples, no URL/body | excess -> truncate with count |

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| HEAD/status-only availability | bounded Range plus type/signature and controlled browser escalation | Avoids 200 challenge false positives and unbounded downloads. |
| Magnet syntax/resolver acceptance | layered metadata/peer-progress/stream/playback facts | Prevents premature availability claims. |
| Stream endpoint as success | tuple-bound player consumption evidence | Makes playback readiness user-observable and revision-specific. |
| Task-owned current forever | target-unique current with explicit authoritative-owner transfer | Readback follows legal supersede while preserving original history. |

**Deprecated/outdated:** Existing MovieDetail informational `sourceHealthRows` are derived from broad source readiness rather than Phase 26 transport observations; retain as compatibility UI until the new projection is authoritative, then map or replace deliberately.[VERIFIED: `apps/movie-app/src/views/MovieDetail.vue`]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Recommended timeout, sample, polling and freshness values are suitable defaults. | Recommended Probe Policy v1 | Too strict creates false uncertainty; too loose increases latency/cost. Keep policy-versioned and fixture-test boundary values. |
| A2 | Generic evidence JSON can hold bounded per-source detail without schema expansion. | Project Structure | If indexed querying becomes required, 26-01 may need a Drizzle migration and must follow the repository migration protocol. |
| A3 | TorrServer system probe can reuse/centralize existing client semantics in the runner/provider environment. | Standard Stack | If provider is only browser-local, system projection must report provider/stream unknown and rely on browser evidence rather than pretending reachability. |

## Resolved Open Questions

1. **Authoritative TorrServer probe location — RESOLVED.** Runner-owned, server-managed provider configuration is authoritative for system-wide TorrServer facts. Existing browser-local TorrServer configuration remains browser-scoped and may contribute bounded browser evidence only; it never promotes global provider or stream readiness. When the runner has no configured provider, the current fact remains `provider_unavailable` and the final live checkpoint remains unresolved.

2. **Per-source history persistence shape — RESOLVED.** Reuse the existing bounded observation/history JSON and receipt-backed rows. Phase 26 adds no speculative indexed columns or parallel current table. `appendStatement` writes the authoritative append-first fact, while concrete readback joins use the existing source identity/revision fields; a later indexed schema requires a demonstrated query contract in another phase.

3. **Direct media signature support — RESOLVED.** Use a small explicit allowlist: HLS manifests (`#EXTM3U`), DASH manifests (bounded XML containing an MPD root), and established media-container signatures for MP4/ISO-BMFF, WebM/Matroska, MPEG-TS, Ogg, and FLV. Content-Type and signature evidence must agree or be independently credible under policy; inconclusive bytes escalate to the bounded browser probe and remain `uncertain` if browser evidence is inconclusive.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | build/tests/runner | yes | 24.0.1 | none |
| pnpm | workspace commands | yes | 10.33.0 | none |
| Git | GSD and diff checks | yes | 2.39.2.windows.1 | none |
| curl | fixture/manual HTTP probes | yes | 8.21.0 | native fetch tests |
| Docker | optional local services | yes | 29.6.2 | run existing external service directly |
| aria2c service/CLI | live magnet provider proof | no process/CLI detected | — | mocked contract tests; live provider proof is a checkpoint |
| TorrServer service | live stream provider proof | no process detected | — | mocked client tests; live provider proof is a checkpoint |
| Project graph | semantic discovery | no graph built | — | GitNexus index and code grep were used |

**Missing dependencies with no fallback:** Live Aria2/TorrServer acceptance needs configured running providers; planner should make this a human/environment checkpoint rather than an automated unit-test prerequisite.

**Missing dependencies with fallback:** Contract, classifier, repository and UI tests can use existing mocks/fixtures. Canonical UI acceptance still runs through `http://localhost:8080`.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Existing admin/session auth on commands and provider configuration. |
| V3 Session Management | yes | Reuse current Gateway/session boundary; do not persist cookies in probe evidence. |
| V4 Access Control | yes | Operation registry permission resource and provider allowlist; server owns executable fields. |
| V5 Input Validation | yes | Exact-key schema validation, URL/redirect/DNS guard, closed enums, bounded arrays/strings/bytes. |
| V6 Cryptography | yes | Existing signed runner event/callback and secret storage; no custom crypto. |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SSRF through direct URL/redirect/DNS rebinding | Spoofing / Information Disclosure | Validate every hop and resolved address, deny private/link-local/metadata networks, manual redirects, egress policy. |
| Credential/header leakage on redirect | Information Disclosure | Server-owned minimal headers, strip on cross-origin hop, never persist them. |
| Large or endless media response | Denial of Service | AbortSignal, byte-budgeted stream read, total time/redirect/concurrency limits. |
| Malicious HTML/challenge stored as evidence | Tampering / XSS | Store reason codes and hashes/counts only; render as text; no raw body/HTML. |
| Forged provider/playback success | Spoofing / Tampering | Signed tuple-bound events, provider association, receipt validation and authoritative same-revision readback. |
| Arbitrary TorrServer stream URL | SSRF / Spoofing | Existing trusted-origin resolver plus server/provider-owned configuration; reject client-supplied origin. |
| Old callback overwrites new sources | Tampering | source revision/policy/projection CAS and old-revision history-only disposition. |
| Sensitive URL/magnet/cookie in UI/logs | Information Disclosure | Phase 25 evidence redaction, bounded hashes/codes/counts, D-16 forbidden-field tests. |

## Planner Task Boundaries

### 26-01 Video Operation Registry, Contract and Policy

- Extend the closed operation registry with explicit recheck and reason-specific repair intents; provider/template/entrypoint/headers remain server-owned.
- Define per-source discriminated unions, four-layer aggregate, status precedence, freshness, action mapping and policy v1.
- Extend signed runner/event schemas and bounded evidence validation before adapters exist.
- Decide whether existing generic persistence is sufficient; if schema changes, own all Drizzle migration work here.
- Tests: exact-key rejection, idempotency fingerprint, status precedence, counts, redaction, revision/policy mismatch.

### 26-02 Direct Transport and Browser Observation

- Implement URL guard, manual redirect loop, Range body budget, media type/signature classifier and browser escalation adapter.
- Keep network exceptions uncertain and last determinate state stale; do not mutate current outside repository path.
- Build deterministic HTTP fixtures for 206 valid/invalid Content-Range, 200 ignored Range, 416, redirects, HTML challenge, wrong type, timeout and DNS/provider failure.
- Browser fixture proves escalation and bounded event summary, not playback readiness.

### 26-03 Magnet, Aria2 and TorrServer Providers

- Inventory actual provider configuration first; define explicit provider-unavailable/auth/resolver results.
- Map magnet syntax, metadata, peers/progress, stream endpoint independently; bounded polling with cleanup/cancel semantics.
- Reuse authenticated Aria2 allowlist and trusted TorrServer origins; never expose provider secret or full magnet/stream URL.
- Tests: metadata-only, no peer, stalled, progressing, stream ready, provider failures, timeout, multi-file selection and cleanup.

### 26-04 Recheck/Repair API and UI Readback

- Add schema + authenticated Hono route + typed wrappers for operation creation and four-layer current/history readback.
- Dashboard task detail and MovieDetail show the same projection shape: best result/counts, abnormal rows, freshness/revision/receipt, old-revision history and exactly one primary action per finding.
- Inline progress is `queued -> running -> readback`; terminal provider success alone does not update the visible current projection.
- Reuse Player evidence; join it only when content/revision/tuple matches.
- Verify cache invalidation happens after authoritative current readback and follows an accepted supersede owner.
- Acceptance: focused tests/type checks, then one fresh redacted tuple through `http://localhost:8080` demonstrating direct or magnet observation, receipt, D1 readback, UI trace and cleanup.

## Sources

### Primary (HIGH confidence)

- Repository source: `apps/api/src/domain/crawler-tasks/*`, `apps/api/src/domain/movies/*`, `apps/api/src/domain/playback-evidence/*` — operation, availability, source and evidence contracts.
- Repository source: `packages/db/src/schema.ts` — source observations, generic availability observation/current and playback evidence storage.
- Repository source: `apps/api/src/routes/aria2/*`, `apps/movie-app/src/utils/aria2Client.ts`, `apps/movie-app/src/utils/torrServerClient.ts`, `apps/movie-app/src/utils/playerSecurity.ts` — provider and trust boundaries.
- Phase 25 summary/verification — authoritative owner transfer, same-revision readback, Gateway and redaction baseline.

### Secondary (MEDIUM confidence)

- https://www.rfc-editor.org/rfc/rfc9110.html — HTTP semantics and bounded defensive parsing.
- https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Range — Range, 206, 416 and ignored Range behavior; updated 2025-09-11.
- https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/readyState — media readiness states; updated 2024-06-27.
- https://aria2.github.io/manual/en/html/aria2c.html — aria2 1.37.0 magnet/BitTorrent/RPC semantics.

### Tertiary (LOW confidence)

- TorrServer upstream API documentation could not be reliably fetched during this session; implementation guidance is therefore based on the repository's existing client/tests and is captured as Open Question 1 rather than asserted externally.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; all recommended facilities are present in repository/environment.
- Architecture: HIGH — derived from locked decisions and verified Phase 25 control-plane/storage/readback code.
- Direct probe semantics: MEDIUM-HIGH — HTTP/media semantics cited; exact policy limits remain explicit assumptions.
- Magnet/TorrServer semantics: MEDIUM — aria2 official docs and repository code verified; live provider and TorrServer external docs unavailable.
- Pitfalls/security: HIGH — grounded in protocol semantics, code boundaries and locked redaction/revision rules.

**Research date:** 2026-08-12
**Valid until:** 2026-09-11; re-check provider APIs/configuration before 26-03 execution.
