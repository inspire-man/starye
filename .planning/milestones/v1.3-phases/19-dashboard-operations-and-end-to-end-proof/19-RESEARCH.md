# Phase 19: Dashboard Operations and End-to-End Proof - Research

**Researched:** 2026-08-01
**Domain:** Vue 3 Dashboard task operations, Hono/Valibot/D1 crawler read models, receipt-to-CRUD handoff, Gateway evidence, GitHub Actions production proof
**Confidence:** HIGH for repository architecture and phase contracts; MEDIUM for external framework documentation

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

### 任务历史、详情与刷新

- **D-01:** Dashboard 按视频和漫画模板分组展示完整 task 历史，不再只显示每个模板的最新 task；每个 task 保留全部 attempt 历史。
- **D-02:** 点击 task 后在同一页面打开详情面板，显示 attempt 切换、状态、failure code、receipt、provider 摘要和分页日志；不新增独立详情路由或抽屉。
- **D-03:** task 列表、当前详情和当前日志在页面可见时每 5 秒刷新；页面隐藏时暂停，恢复可见后立即刷新，并始终保留手动刷新。
- **D-04:** task 历史按更新时间倒序，以稳定游标和“加载更多”逐步读取；日志继续沿用最新 50 条加 sequence 游标加载更早安全日志，不增加实时流式传输。

### 权限、取消、重试与 provider 信息

- **D-05:** 无权限模板在 Dashboard 完全隐藏；有权限模板才显示列表、创建、取消、重试和 receipt 操作。API 继续按 template 的 movie/comic resource 做最终会话与 403 校验。
- **D-06:** 取消请求成功后立即显示 `cancel_requested` 的“等待 runner 确认”状态，保留当前 attempt 与日志，并禁用取消/重试等冲突操作；Dashboard 不提前伪造 `cancelled` 终态。
- **D-07:** 重试确认必须展示原终态、failure code 或取消原因和 attempt 编号，明确说明会创建新的 attempt 且历史不覆盖；确认成功后切换到新 attempt。
- **D-08:** 生产 task 详情显示脱敏 provider 状态、`GITHUB_RUN_ID`、provider attempt、commit SHA 和 provider run URL；不显示 secret、认证头或原始 callback payload。

### Receipt 与既有内容 CRUD 交接

- **D-09:** 只有 `succeeded` 且 receipt 已通过 API 校验的 run 才显示内容管理链接；链接按 `primaryContentId` 直接进入既有 Movies/Comics 管理路由并自动打开现有编辑器。
- **D-10:** receipt handoff 额外携带受控的 task ID、run ID 和 attempt 来源参数，用于返回 task 详情与 evidence 关联；编辑器只使用 `primaryContentId` 加载内容，URL 不携带原始 receipt JSON。
- **D-11:** TEST-01 对本次真实 receipt 内容执行模板化、可回退的增删改：电影更新元数据并新增/删除一个播放源；漫画更新元数据并新增/删除一个章节或等价受控子项；最后恢复原始元数据和清理验收子项。
- **D-12:** receipt 目标在当前资源权限下才可交接；403/404 或 lookup 失败时显示受控错误，保留返回 task 详情入口，不退回无关列表、不自动重试到无限等待。

### Evidence、凭据与 RUNBOOK

- **D-13:** 每次验收生成固定 tuple 的 JSON 与 Markdown evidence，至少包含 mode、target、template、workflow、repository/ref/Environment、D1 run/attempt、provider run/attempt/SHA/URL（生产）、callback event IDs/nonces、validated receipt、Gateway URL、CRUD mutation/readback/restore 结果、命令与时间戳。
- **D-14:** 本地与生产 evidence 使用独立 run tuple 和清晰标签；本地 fixture/contract 结果不得写成 credentialed provider production success。
- **D-15:** GitHub App 与 `starye-org` Environment 的 RUNBOOK 只记录 secret 名称、消费者、权限、Environment、preflight 和轮换步骤。secret 值留在受管 secret store；evidence 只记录存在性与脱敏 metadata。
- **D-16:** 延续 Phase 16 留存契约：task、attempt、终态、failure code 和 receipt 摘要长期保留，明细安全日志保留 90 天；RUNBOOK 必须给出清理、核验和失联排查步骤。
- **D-17:** 失联、取消、失败或部分入库后先冻结新 mutation 并保留 tuple、日志和 receipt；按 provider、API/D1、workflow、内容层分类处理。部署或配置回滚后以新 attempt 重跑；已入库内容不自动删除，必要修正走既有 CRUD。
- **D-18:** 生产 sign-off 记录一个模板的一条真实 provider-backed 成功 tuple；本地则对 movie 和 manga 两个模板都完成 Gateway、validated receipt 和可回退 CRUD 证据。

### the agent's Discretion

- task 列表/详情的组件拆分、每页数量、游标 DTO、provider 摘要字段布局、受控来源 query 参数名称、具体可回退元数据字段、漫画等价受控子项、evidence 文件名和测试工具由研究与规划决定。
- 上述实现必须复用现有 Hono/Valibot/D1、Vue 资源权限、ConfirmDialog、Movies/Comics 编辑器、Gateway 和 Phase 16-18 状态机/provider/receipt 契约。

### Deferred Ideas (OUT OF SCOPE)

- 实时流式日志、通知策略、后台 schedule 编辑、额外 crawler 模板、多任务并发和自动业务重试继续属于未来需求。
- 第二个模板的 credentialed production provider tuple 可作为后续强化证据；Phase 19 sign-off 只锁定一条真实 production tuple。
- 独立 receipt 详情页和第二套电影/漫画编辑器保持排除。
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DASH-01 | Dashboard 支持创建、列表、详情、分页日志和状态自动刷新。 | 扩展现有 `Crawlers.vue`/`api.ts` 模式为按模板的 keyset task history、attempt detail、provider-safe projection、5 秒 visibility-aware refresh 和 sequence log cursor。 |
| DASH-02 | Dashboard 支持确认后的取消/重试，并继承现有视频/漫画资源权限。 | 保持 API `requireSessionUser`、`requireTemplateAccess`、`requireTaskRunAccess` 与 `useResourceGuard` 双层边界；确认文案展示终态/failure/attempt，服务器状态决定最终状态。 |
| DASH-03 | 成功 receipt 链接到现有视频/漫画内容 CRUD，管理员可完成增删改。 | 只投影 validated `primaryContentId`，以受控 task/run/attempt 来源参数跳转既有 Movies/Comics 编辑器，复用既有 update/player/chapter API 并做 readback/restore。 |
| OPS-02 | 为 GitHub 凭据、日志留存、失联 run、取消、重试和回滚更新 canonical RUNBOOK。 | RUNBOOK 是长期 owner；补充 GitHub App/Environment metadata、90 天日志清理与核验、失联/取消/部分入库冻结和新 attempt 回滚流程。 |
| TEST-01 | 本地与生产路径均具备从任务创建到入库后内容 CRUD 的可重复验收证据。 | 本地 movie/manga 使用 Gateway 8080、local runner、validated receipt 和可回退 CRUD；生产只签一条 credentialed fixed tuple，证据 JSON/Markdown 严格分离。 |
</phase_requirements>

## Summary

Phase 19 的实现基础已经存在：`Crawlers.vue` 有固定 movie/manga CTA、页面内详情、5 秒可见性轮询、ConfirmDialog、sequence 日志分页和 validated receipt 链接；API 已有 Hono + Valibot session/template guard、D1 task/run/log 查询、取消/重试、receipt projection；Movies/Comics 已能从 `?receipt=<primaryContentId>` 加载并打开现有编辑器。[VERIFIED: `apps/dashboard/src/views/Crawlers.vue`, `apps/api/src/routes/admin/crawler-tasks/index.ts`, `apps/dashboard/src/views/Movies.vue`, `apps/dashboard/src/views/Comics.vue`]

当前缺口是完整 task history read model，而不是重写入口：列表调用仍按模板 `limit: 1`，API list 没有 `nextCursor`，游标只按 `id < cursor` 却按 `created_at` 排序；detail 仅返回 runs，未左联 `crawler_run_provider_association` 的脱敏摘要；receipt URL 只有 content ID，尚未携带受控 task/run/attempt 来源。[VERIFIED: `Crawlers.vue` lines 80-105, `apps/api/src/routes/admin/crawler-tasks/index.ts` list/detail handlers, `apps/dashboard/src/lib/api.ts` crawler DTOs]

主要建议是沿现有边界增量补齐：API 负责稳定 `(updated_at,id)` keyset、完整 task/attempt/provider read model 和权限；Dashboard 负责按模板分组、同页 task/attempt 切换、可见时刷新与冲突操作禁用；receipt 继续只信 API validated projection 并交给既有 CRUD。证据分为本地双模板 Gateway tuple 与一条 production provider tuple，不能互相替代。[VERIFIED: 19-CONTEXT.md D-01..D-18, Phase 17/18 summaries and coverage]

**Primary recommendation:** 先补 API read model 和安全 DTO，再实现 Dashboard 完整历史/attempt 操作，随后扩展 receipt handoff 与证据编排，最后在 RUNBOOK 稳定回写后分别执行本地双模板和单条生产 tuple sign-off。

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Task history, attempt and provider read model | API / Backend | Database / Storage | API 必须执行 session/template 403、allowlist projection 和 keyset；D1 保存 task/run/provider 真相。[VERIFIED: admin route, schema, 16/18 contracts] |
| Task/run/log persistence and retention | Database / Storage | API / Backend | `crawler_task`, `crawler_run`, provider association and log tables are D1 control-plane facts; cleanup keeps detail logs 90 days while terminal facts persist.[VERIFIED: `packages/db/src/schema.ts`, 16-CONTEXT D-10..D-13] |
| Visibility-aware polling and same-page selection | Browser / Client | API / Backend | Browser owns timer/listener and selected task/attempt; API remains source of truth and must prevent stale state from being fabricated.[VERIFIED: `Crawlers.vue`; CITED: https://vuejs.org/api/composition-api-lifecycle.html; CITED: https://developer.mozilla.org/en-US/docs/Web/API/Document/visibilitychange_event] |
| Resource permission and cancel/retry authorization | API / Backend | Browser / Client | Browser hides inaccessible templates for usability, but API `requireTemplateAccess`/`requireTaskRunAccess` is final security boundary.[VERIFIED: `useResourceGuard.ts`, admin crawler route] |
| Receipt handoff and content editing | Browser / Client | API / Backend, Database / Storage | Browser routes only validated `primaryContentId` into existing Movies/Comics editors; existing APIs and D1 own mutation/readback.[VERIFIED: Movies.vue, Comics.vue, admin API methods] |
| Local crawler execution and evidence | Node runner / Crawler | Gateway / Browser, API / D1 | Node runner executes fixed adapters; Gateway 8080 is the only local observation origin; API validates receipt.[VERIFIED: `scripts/local-task-runner.e2e.ts`, Phase 17-03 summary, AGENTS.md] |
| Credentialed production execution | GitHub Actions / Provider | API / D1 | Fixed Actions workflows run Puppeteer and signed callbacks; D1 requires provider state + callback + validated receipt before success.[VERIFIED: 18-CONTEXT, 18-COVERAGE, workflow files] |
| Stable operational procedures | Documentation (`RUNBOOK.md`) | `.planning/phases/` evidence | Phase rules stay in `.planning` while active; durable credential/retention/rollback steps belong in RUNBOOK.[VERIFIED: `docs/documentation-ownership.md`, RUNBOOK.md] |

## Standard Stack

### Core

| Library / boundary | Repository version | Purpose | Why Standard |
|--------------------|--------------------|---------|--------------|
| Vue | `^3.5.32` | Dashboard Composition API and view state | Existing Dashboard stack; registry returned `3.5.40` on 2026-08-01, so keep the locked repository range rather than upgrade for this phase.[VERIFIED: `apps/dashboard/package.json`; VERIFIED: npm registry] |
| Hono | `^4.12.14` | API route composition and middleware | Existing Worker API boundary; official validation docs describe validator middleware for typed request values.[VERIFIED: `apps/api/package.json`; CITED: https://hono.dev/docs/guides/validation] |
| Valibot | `^1.3.1` | Strict create/list/detail/log/cancel/retry DTO validation | Existing crawler schemas reject free-form fields before command logic.[VERIFIED: `apps/api/src/schemas/crawler-tasks.ts`; VERIFIED: npm registry] |
| Drizzle ORM + Cloudflare D1 | `drizzle-orm 0.45.2` | Schema/migration and D1 control-plane queries | Existing task/run/provider/log schema and migrations are the source of lifecycle truth.[VERIFIED: `packages/db/src/schema.ts`, migrations] |

### Supporting

| Library / boundary | Repository version | Purpose | When to Use |
|--------------------|--------------------|---------|-------------|
| Vitest | `^4.1.4` | API and Vue component tests with deterministic mocks/fake timers | Every DTO/read-model and Dashboard state change.[VERIFIED: package manifests; VERIFIED: current focused runs passed 6 and 9 tests] |
| `@vue/test-utils` | `^2.4.6` | Mount `Crawlers.vue`, Movies and Comics with API/permission mocks | Extend existing component contract tests rather than browser-only tests.[VERIFIED: `apps/dashboard/src/views/__test__`] |
| Playwright | `^1.59.1` | Gateway browser CRUD proof | Use only with `BASE_URL=http://localhost:8080` or the existing Gateway evidence observer; do not treat the default `5173` dev server as canonical evidence.[VERIFIED: `playwright.config.ts`, AGENTS.md] |
| Existing provider/read-model helpers | workspace source | `template-registry`, provider snapshot, receipt validation, state machine, HMAC/nonce | Reuse for all new projections and evidence; no second state machine or provider client.[VERIFIED: Phase 16-18 files and summaries] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `(updated_at,id)` keyset | Offset pagination | Offset can skip/duplicate tasks during refresh and does not meet D-04 stable cursor.[VERIFIED: D-04 and current API ordering] |
| Existing page polling | SSE/WebSocket | Explicitly out of scope; adds stream lifecycle and sensitive log exposure.[VERIFIED: D-03/D-04 and REQUIREMENTS future scope] |
| Existing Movies/Comics editors | New receipt editor | Violates D-09 and duplicates CRUD/mutation authorization.[VERIFIED: D-09 and Phase 17-03] |
| Derived fixed provider URL | Arbitrary URL field/input | A URL derived from server-owned repository + numeric provider run ID avoids URL injection and schema migration; arbitrary URL input violates closed provider boundary.[RECOMMENDED: based on D-08 and provider snapshot] |

**Installation:** No new external package is required. Keep existing workspace lockfile and versions.[VERIFIED: Phase 19 scope and package manifests]

## Package Legitimacy Audit

This phase reuses already installed workspace packages and adds no external dependency. Package legitimacy gate is therefore not applicable; no package is recommended for installation.[VERIFIED: phase scope, package manifests]

## Architecture Patterns

### System Architecture Diagram

```text
Admin browser (Gateway :8080)
  -> session-bound GET/POST /api/admin/crawler-tasks
  -> Hono + Valibot + resource guard
  -> D1 task/run/provider/log read model
       ^                         |
       | signed runner events    | validated receipt projection
Local Node runner                v
fixed movie/manga adapters   Dashboard task/attempt detail
                                  |
                    succeeded + validated primaryContentId only
                                  v
                    existing Movies.vue / Comics.vue editor
                                  |
                     existing CRUD API -> D1 readback/restore

Production path: Dashboard -> API fixed provider snapshot -> GitHub Actions
  -> provider_started/progress/terminal signed callbacks -> D1 triple-success gate
  -> one credentialed provider tuple evidence (separate from local evidence)
```

### Recommended Project Structure

```text
apps/api/src/routes/admin/crawler-tasks/
  index.ts                 # list/detail/log/cancel/retry projection and permission
  __tests__/               # DTO, cursor, provider redaction, cross-template 403
apps/api/src/domain/crawler-tasks/
  types.ts                 # read-model DTOs and provider-safe summary
  provider-association.ts  # fixed provider identity and safe URL derivation
  repository.ts            # D1 read queries; existing CAS/state machine stays owner
apps/dashboard/src/lib/api.ts          # typed list/detail/provider/receipt source DTO
apps/dashboard/src/views/Crawlers.vue  # grouped history, attempts, refresh and actions
apps/dashboard/src/views/Movies.vue    # receipt query + existing editor CRUD
apps/dashboard/src/views/Comics.vue    # receipt query + existing editor CRUD
scripts/local-task-runner.e2e.ts       # local task/runner/receipt tuple extension
scripts/data-chain-surface-observation.ts # Gateway-bound browser evidence pair
.planning/phases/19-dashboard-operations-and-end-to-end-proof/
  19-RESEARCH.md, local/*.json, production/*.json, *.md
RUNBOOK.md                              # stable ops owner after phase closeout
```

### Pattern 1: Stable Task Keyset Read Model

**What:** Return `{ tasks, nextCursor }`; order by `updated_at DESC, id DESC`; encode both values in an opaque cursor. Decode and validate cursor server-side, and use `(updated_at < cursor.updatedAt OR (updated_at = cursor.updatedAt AND id < cursor.id))`.

**When to use:** Every task history page and refresh. The current `id < cursor` query is not stable against a different `created_at` ordering and must not be extended as-is.[VERIFIED: current admin route and D-04]

**Example:**

```ts
type TaskCursor = { updatedAt: number, id: string }
// projection: task + latest run summary; only server-owned fields
SELECT task.id, task.template_key, task.latest_run_id, task.created_at, task.updated_at,
       run.status AS latest_status, run.attempt_number AS latest_attempt
FROM crawler_task AS task
LEFT JOIN crawler_run AS run ON run.id = task.latest_run_id
WHERE (? IS NULL OR task.template_key = ?)
  AND (? IS NULL OR task.updated_at < ?
       OR (task.updated_at = ? AND task.id < ?))
ORDER BY task.updated_at DESC, task.id DESC
LIMIT ?
```

### Pattern 2: Safe Detail Projection

**What:** Detail returns task plus every attempt sorted by `attempt_number DESC`; each run carries failure code, validated receipt, and a safe provider summary. Read provider association by run ID and map only `provider`, status/conclusion, numeric provider run ID/attempt, SHA, and a derived fixed run URL. Never expose `safe_facts_json`, callback payload, headers, or tokens.

**When to use:** Task selection and every visible refresh. The D1 association remains the source of provider facts; Dashboard DTOs are not a second persistence model.[VERIFIED: `ProviderAssociationSummary`, schema, 18-04/18-06]

### Pattern 3: Visibility-Aware Refresh with Selection Preservation

**What:** `onMounted` starts one refresh and registers `visibilitychange`; visible state runs a 5-second interval, hidden state clears it, and a visible transition immediately refreshes. `onUnmounted` always clears interval/listener. Guard overlapping loads and reconcile selected task/run by IDs so a new attempt or a stale response cannot replace the selected history.[CITED: https://vuejs.org/api/composition-api-lifecycle.html; VERIFIED: current `Crawlers.vue`]

**When to use:** Task list, selected detail and selected run logs. Manual refresh remains available and failures retain the last good projection.[VERIFIED: D-03, existing component behavior]

### Pattern 4: Receipt Handoff as a Controlled Route Contract

**What:** Build a route with `receipt=<primaryContentId>` plus controlled `taskId`, `runId`, `attempt` (and a bounded source marker). Movies/Comics validate the ID format, call existing `getMovie`/`getComic`, and open the existing editor. On 403/404/lookup error, show a controlled error and a return-to-task link; never fall back to an unscoped list or raw receipt JSON.[VERIFIED: D-09..D-12, existing Movies.vue/Comics.vue]

### Pattern 5: Evidence Pair and Provenance Gate

**What:** Emit one JSON and one Markdown file per exact tuple. Validate tuple fields, status, source (`local_runner`/`remote_provider`), callback IDs/nonces, receipt, Gateway URL (local only), CRUD mutation/readback/restore, command and UTC timestamp. Local evidence must be `target=local` and never include provider credential metadata; production evidence must contain one fixed provider tuple and no secret values.[VERIFIED: D-13/D-14, `data-chain-evidence.ts`, 18-COVERAGE]

### Anti-Patterns to Avoid

- **Latest-only card query:** `limit: 1` per template hides prior tasks and violates D-01; use task pages and a selected task detail.[VERIFIED: current `Crawlers.vue`]
- **ID-only cursor:** UUID lexical order is not the same as update time; use a signed/opaque `(updated_at,id)` cursor.[VERIFIED: current route and D-04]
- **Client-only permission:** hidden buttons are not authorization; every task/run route must re-check the template resource and session.[VERIFIED: D-05, route tests]
- **Receipt optimism:** show content links only on `succeeded` with API-validated receipt; never use runner candidate IDs.[VERIFIED: Phase 17-02/03]
- **Provider success shortcut:** dispatch accepted, workflow exit code, or GitHub success alone is not success; require provider + signed terminal event + validated receipt.[VERIFIED: 18-CONTEXT D-11]
- **Refresh overwrite:** stale polling responses can revert a newly selected attempt; compare task/run IDs and sequence before replacing state.[RECOMMENDED: browser concurrency risk]
- **Live log stream:** SSE/WebSocket violates scope and increases redaction/retention surface; retain 50-row sequence pagination.[VERIFIED: D-03/D-04]
- **RUNBOOK secret dump:** record names/consumers/environment and rotation/preflight only, never values.[VERIFIED: D-15, RUNBOOK ownership]
- **Mutate after failure/partial ingest:** freeze new content mutation, preserve evidence, classify provider/API/D1/workflow/content, then recover with a new attempt; never auto-delete already ingested rows.[VERIFIED: D-17]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Lifecycle correctness | New task state machine or ad-hoc status writes | Existing `state-machine.ts` + repository CAS/lease/retry | Existing contracts cover sequence, terminal irreversibility, cancel race and leases.[VERIFIED: Phase 16/18] |
| Receipt trust | Client-side receipt parsing or candidate ID lookup | API `receipt-validation.ts` + `projectReceipt` | API re-queries template-owned content and allowlists counts/ID.[VERIFIED: Phase 17-02] |
| Provider identity | User-entered workflow/URL/secret | `template-registry` + `createProviderSnapshot`/fixed run URL | Closed movie/manga registry prevents provider drift and URL injection.[VERIFIED: Phase 18] |
| Callback integrity | New HMAC/nonce implementation | Existing runner-event auth, event client and event tables | Reuse timing window, key rotation, nonce/event idempotency and sequence.[VERIFIED: Phase 16/18] |
| Content editor | Receipt-specific CRUD UI | Existing Movies.vue/Comics.vue and admin API | Avoids duplicated validation, authorization and restore behavior.[VERIFIED: D-09] |
| Browser evidence integrity | Free-form evidence JSON | `data-chain-evidence.ts` schema/validator and surface observer | Enforces tuple, canonical paths, source/capture and integrity hash.[VERIFIED: `packages/config/src/deployment-target/data-chain-evidence.ts`] |
| Log retention | New cleanup worker | Existing crawler log cleanup/reconciliation schedule | D1 indexes and 90-day contract already exist.[VERIFIED: schema, 18-04 summary] |

**Key insight:** Phase 19 is a read-model, handoff and proof closure over the Phase 16-18 control plane. Duplicating state, receipt validation, provider identity or editors would create competing truths and weaken the evidence boundary.[VERIFIED: phase contexts and summaries]

## Common Pitfalls

### Pitfall 1: Cursor/order mismatch
**What goes wrong:** Rows disappear or repeat while tasks update.[VERIFIED: current list SQL]
**Why it happens:** Current cursor compares `id` but order is `created_at`; D-04 requires `updated_at` order.[VERIFIED: route and context]
**How to avoid:** Opaque `(updated_at,id)` cursor, deterministic tie-breaker, invalid-cursor 400 test.[RECOMMENDED]
**Warning signs:** `nextCursor` returns tasks already visible or skips a same-timestamp task.

### Pitfall 2: Provider data leaks into Dashboard
**What goes wrong:** Token, callback payload, auth header, or raw safe facts appears in JSON/UI.[VERIFIED: provider tests and D-08/D-15]
**How it happens:** Joining `crawler_run_provider_association` and serializing the full row.
**How to avoid:** Explicit DTO projection and tests asserting forbidden strings/keys are absent.
**Warning signs:** `safe_facts_json`, private key, `Authorization`, `Cookie`, or callback body in response.

### Pitfall 3: Authorization drift between templates
**What goes wrong:** `movie_admin` reads or mutates manga task/run.[VERIFIED: route tests]
**How it happens:** list filtering only in Vue or checking task ID without template join.
**How to avoid:** `requireTemplateAccess` for template/list and `requireTaskRunAccess` for every detail/log/cancel/retry.
**Warning signs:** UI hides manga but direct API request succeeds.

### Pitfall 4: Cancellation UI lies about terminal state
**What goes wrong:** UI shows `cancelled` before signed runner/provider terminal event.[VERIFIED: D-06, Phase 17]
**How it happens:** Optimistic local mutation after POST.
**How to avoid:** Render server `cancel_requested`, disable conflicting actions, refresh and wait for terminal confirmation.
**Warning signs:** cancel request followed by a success receipt or missing attempt logs.

### Pitfall 5: Retry overwrites history
**What goes wrong:** Original failure/receipt/logs disappear.[VERIFIED: D-07, Phase 16 D-08]
**How it happens:** Replacing selected run instead of selecting a new immutable attempt.
**How to avoid:** API creates a new run under the same task; detail returns all attempts; UI switches to returned run ID.
**Warning signs:** attempt number does not increase or old failure code is lost.

### Pitfall 6: Receipt handoff loses provenance
**What goes wrong:** Editors open an ID with no way back to the task/evidence.[VERIFIED: D-10]
**How it happens:** Existing `?receipt=` link is extended with raw JSON or omitted source IDs.
**How to avoid:** Add bounded task/run/attempt source params; keep editor lookup keyed only by primary ID; preserve return link on errors.
**Warning signs:** URL contains serialized receipt/callback data or navigates to generic list after 404.

### Pitfall 7: Manga CRUD proof has no existing add-chapter route
**What goes wrong:** TEST-01 claims add/delete without an executable reversible operation.[VERIFIED: `apps/api/src/routes/admin/chapters/index.ts` has GET/DELETE/bulk-delete only]
**How it happens:** Assuming the editor supports chapter creation because it supports chapter listing/deletion.
**How to avoid:** Resolve the controlled equivalent in planning; snapshot an existing chapter and use an existing owner path for delete/restore, or add a narrowly scoped tested route only if explicitly accepted. Keep mutation/recovery bounded and clean up.
**Warning signs:** Evidence records only metadata changes while claiming chapter add/delete.

### Pitfall 8: Local evidence is called production
**What goes wrong:** Fixture or contract run is presented as provider-backed success.[VERIFIED: 18-COVERAGE and 17-03 evidence boundary]
**How it happens:** Reusing one evidence schema without `mode/source/target` assertions.
**How to avoid:** Separate local and production directories/tuples and reject missing provider fields in production sign-off.
**Warning signs:** Local evidence contains `remote_provider`, `GITHUB_RUN_ID`, or a provider URL without a real Actions run.

### Pitfall 9: Remote proof starts before preflight
**What goes wrong:** Credentials/configuration drift produces an untraceable run.[VERIFIED: RUNBOOK target-first procedure]
**How it happens:** Dispatching workflow before target profile, Environment and callback secret metadata checks.
**How to avoid:** Run selected-target validation/preflight first; stop on missing metadata; use a new tuple after recovery.
**Warning signs:** `provider_not_configured`, `provider_lost`, callback 401, or missing D1 association.

### Pitfall 10: RUNBOOK duplicates phase truth
**What goes wrong:** Operators follow stale or conflicting procedures.[VERIFIED: `docs/documentation-ownership.md`]
**How it happens:** Writing durable rules to multiple root docs before closeout.
**How to avoid:** Keep active evidence and unresolved decisions in `.planning/phases/19...`; write stable credential/retention/rollback procedure only to RUNBOOK at closeout.
**Warning signs:** Same secret matrix or rollback steps diverge across README, phase docs and RUNBOOK.

## Files and Module Impact

| Area | Files / modules | Planned responsibility |
|------|-----------------|------------------------|
| API task read model | `apps/api/src/routes/admin/crawler-tasks/index.ts`, `apps/api/src/schemas/crawler-tasks.ts`, `apps/api/src/domain/crawler-tasks/types.ts`, `repository.ts`, `provider-association.ts` | Add validated cursor DTO/`nextCursor`, latest-run list summary, all-attempt detail with safe provider projection and fixed provider URL; preserve existing command/state-machine owners.[VERIFIED: current files] |
| API tests | `apps/api/src/routes/admin/crawler-tasks/__tests__/crawler-tasks.route.test.ts`, domain receipt/provider/repository tests | Cover ordering/tie cursor, invalid cursor, template 403/404, provider redaction, cancel_requested and retry history, receipt-only success.[RECOMMENDED] |
| Dashboard client | `apps/dashboard/src/lib/api.ts` | Extend task/list/detail/run/provider DTOs and methods; no raw fetch from views.[VERIFIED: current `api.ts`, Hono project skill] |
| Dashboard view | `apps/dashboard/src/views/Crawlers.vue` | Replace latest-only cards with grouped task pages, same-page detail/attempt selection, provider summary, dynamic retry confirmation, visibility/manual refresh and conflict-action disabling.[VERIFIED: D-01..D-08] |
| Dashboard component tests | `apps/dashboard/src/views/__test__/Crawlers.test.ts` | Fake timer and visibility tests for pages, selection preservation, stale responses, permission hiding, cancel_requested, retry explanation, provider redaction and receipt source URL.[RECOMMENDED] |
| Existing editors | `apps/dashboard/src/views/Movies.vue`, `Comics.vue`, their tests | Parse controlled source params, retain receipt-only lookup, provide return-to-task error state, and prove reversible mutation/readback/restore via existing APIs.[VERIFIED: current editor code and D-09..D-12] |
| Local evidence | `scripts/local-task-runner.e2e.ts`, `scripts/data-chain-surface-observation.ts`, `packages/config/src/deployment-target/data-chain-evidence.ts` | Bind task/run/attempt/template/validated receipt to local Gateway browser CRUD for both templates; emit separate JSON/Markdown pair and retain real-crawl `receipt_missing` as a distinct fact.[VERIFIED: Phase 17-03 and current scripts] |
| Production evidence | Phase 19 evidence script/artifacts; `.github/workflows/daily-movie-crawl.yml`, `.github/workflows/daily-manga-crawl.yml` read-only consumption | Capture one exact credentialed provider tuple with provider run ID/attempt/SHA/URL, callback IDs/nonces and validated receipt; no workflow redesign or arbitrary inputs.[VERIFIED: 18-COVERAGE] |
| Operations docs | `RUNBOOK.md`, `.planning/phases/19.../*.json|*.md` | Add stable GitHub App/Environment metadata, 90-day cleanup/verification, lost/cancel/retry/partial-ingest/rollback runbook; keep phase evidence separate until closeout.[VERIFIED: docs ownership, D-13..D-17] |

## Dependencies and Recommended Order

1. **API contract first:** finalize `(updated_at,id)` cursor, list/detail DTOs, provider-safe projection and tests. Dashboard cannot implement complete history against the current latest-only/shape-limited contract.[VERIFIED: current route/client]
2. **Dashboard history second:** implement grouped pages, selection, attempt switching, provider summary, 5-second visible refresh, manual refresh, and confirmed cancellation/retry; keep `useResourceGuard` while API remains final authority.[VERIFIED: D-01..D-08]
3. **Receipt handoff third:** add controlled task/run/attempt source query and return link; update Movies/Comics tests and resolve the manga child-subitem operation before writing evidence.[VERIFIED: D-09..D-12; manga route inventory]
4. **Evidence harness fourth:** extend local runner/evidence pair for movie and manga Gateway CRUD, then add a production tuple validator that rejects local source or missing provider fields.[VERIFIED: D-13/D-14, 17-03, 18-COVERAGE]
5. **RUNBOOK fifth:** write stable operations only after implementation/evidence field names are final; include target-first preflight, secret-name metadata, retention, failure freeze, recovery classification, new-attempt retry and existing-content preservation.[VERIFIED: docs ownership and D-15..D-17]
6. **Sign-off last:** run focused tests/types, local two-template proof, and only then a separately authorized one-template credentialed Actions tuple. Any failed/checkpoint/pending tuple stops and requires a new tuple after recovery.[VERIFIED: RUNBOOK 2.4/2.5 and 18-COVERAGE]

## Validation Architecture

`workflow.nyquist_validation` is explicitly `false` in `.planning/config.json`; the map below is a phase-specific validation plan requested by the phase, not a generated Wave 0 mandate.[VERIFIED: `.planning/config.json`]

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.4 for API/Vue; Playwright 1.59.1 for Gateway browser proof.[VERIFIED: manifests and environment probes] |
| Config | `apps/dashboard/vitest.config.*`, `apps/dashboard/playwright.config.ts`; API Vitest config in `apps/api`.[VERIFIED: repository] |
| Focused API | `pnpm --filter api exec vitest run src/routes/admin/crawler-tasks/__tests__/crawler-tasks.route.test.ts src/domain/crawler-tasks/__tests__/repository.test.ts src/domain/crawler-tasks/__tests__/receipt-validation.test.ts` |
| Focused Dashboard | `pnpm --filter dashboard test --run src/views/__test__/Crawlers.test.ts src/views/__test__/Movies.test.ts src/views/__test__/Comics.test.ts` |
| Type checks | `pnpm --filter api type-check; pnpm --filter dashboard type-check; pnpm --filter @starye/crawler type-check` |
| Local proof | `$env:TASK_RUNNER_E2E_CONFIG='...ignored...'; pnpm local:task-runner:e2e --target local`, followed by Gateway browser observation with `http://localhost:8080`.[VERIFIED: Phase 17-03 command/evidence] |

### Phase Requirements -> Test Map

| Req | Behavior | Test type | Automated/manual evidence |
|-----|----------|-----------|---------------------------|
| DASH-01 | Complete grouped task history, all attempts, logs cursor, visible 5-second refresh and manual refresh | API route + Vue component | API route test; `Crawlers.test.ts` fake timers/visibility/cursor assertions; Gateway smoke for real DTO |
| DASH-02 | Permission hiding, API 403, confirmed cancel and retry with immutable history | API integration + Vue component | Existing role tests extended for movie/comic; component confirmation tests; verify `cancel_requested` is rendered before terminal state |
| DASH-03 | Validated receipt opens existing editor and reversible CRUD readback/restore | Vue unit + Gateway browser | Movies/Comics route tests; Gateway browser mutation/readback/restore for both templates |
| OPS-02 | Durable secret metadata, retention, lost/cancel/retry/rollback instructions | Static/manual review | RUNBOOK section checks plus reviewer verifies no values/URLs/accounts/secrets; runbook commands use target placeholders |
| TEST-01 | Distinct local two-template proof and one credentialed provider tuple | Script/integration + human gate | JSON/Markdown validator; local Gateway run; production tuple only after target preflight and credentialed Actions confirmation |

### Sampling Rate

- Per API/UI task: focused Vitest command and affected package type-check.
- Per integration wave: API + Dashboard + crawler/config type-checks and `git diff --check`.
- Phase gate: local movie and manga evidence pair plus reviewer-checked production tuple; failed/checkpoint/pending evidence is not sign-off.[VERIFIED: RUNBOOK 2.4]

## State of the Art

| Old approach | Current approach | When changed | Impact |
|-------------|------------------|--------------|--------|
| Latest task per template | Stable cursor-paged task history with all attempts | Phase 19 D-01/D-04 | Operators can audit retries and older failures without overwriting history.[VERIFIED: context] |
| Dispatch/exit code as success | Provider status + signed terminal event + API-validated receipt | Phase 18 D-11 | Production evidence must carry all three facts.[VERIFIED: 18-CONTEXT] |
| Generic receipt query | Server-projected primary ID plus controlled task/run/attempt source | Phase 19 D-09/D-10 | Existing editor remains owner while evidence remains traceable.[VERIFIED: context] |

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Session-based `requireSessionUser`; Gateway session boundary; reject service-token substitution.[VERIFIED: admin route tests] |
| V3 Session Management | yes | Use existing auth cookie/session; do not copy cookies into evidence or provider payloads.[VERIFIED: AGENTS, Phase 16] |
| V4 Access Control | yes | Server `requireTemplateAccess` and `requireTaskRunAccess`; client `useResourceGuard` only mirrors visibility.[VERIFIED: route and composable] |
| V5 Input Validation | yes | Strict Valibot schemas for template, cursor, limit, task/run IDs and retry confirmation; reject arbitrary command/URL/workflow/secret fields.[VERIFIED: crawler schemas and tests] |
| V6 Cryptography | yes | Reuse runner-event HMAC, nonce, sequence, timestamp window and key rotation; do not implement custom signing.[VERIFIED: Phase 16/18] |
| V7 Error Handling/Logging | yes | Project safe logs only, cap 4 KiB/500 rows, redact headers/Cookies/query secrets, retain detail 90 days.[VERIFIED: 16-CONTEXT D-10..D-13 and schema] |
| V9 Communications | yes | Local evidence origin is `http://localhost:8080`; production provider URL is derived from fixed server-owned repository/run ID and never user supplied.[VERIFIED: AGENTS, provider snapshot] |

### Known Threat Patterns for Hono/Vue/D1/Actions

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Task/run IDOR | Elevation/Tampering | Join task template on every run endpoint and re-run resource check; 403/404 tests.[VERIFIED: route tests] |
| Cursor tampering or query abuse | Tampering/DoS | Opaque bounded cursor, Valibot max length/limit, deterministic query and invalid-cursor rejection.[RECOMMENDED] |
| Raw receipt/log XSS or secret leak | Information disclosure | Allowlist DTO fields, escaped Vue rendering, receipt ID regex, redacted structured logs.[VERIFIED: current projection/tests] |
| Callback replay/ordering | Tampering | Existing HMAC timestamp, event ID/nonce idempotency, sequence/CAS and stale audit path.[VERIFIED: Phase 16/18] |
| Provider spoof/mismatch | Spoofing | Server-owned snapshot and exact provider association binding; no latest/unrelated workflow scan.[VERIFIED: 18-04] |
| Mutation after partial ingest | Tampering/Data loss | Freeze new mutation, retain tuple/receipt/logs, classify and recover with new attempt; existing CRUD only for correction.[VERIFIED: D-17] |
| Evidence provenance confusion | Repudiation | Separate local/production roots, explicit source/mode/target, JSON+Markdown tuple validation and timestamp.[VERIFIED: D-13/D-14, evidence schema] |

## Environment Availability

| Dependency | Required by | Available | Version | Fallback / blocker |
|------------|-------------|-----------|---------|--------------------|
| Node.js | Dashboard/API/crawler scripts | yes | 24.0.1 | — [VERIFIED: probe] |
| pnpm | workspace tests and scripts | yes | 10.33.0 | — [VERIFIED: probe] |
| Vitest | focused API/UI tests | yes | 4.1.4 | — [VERIFIED: probe/package scripts] |
| Playwright | Gateway browser proof | yes | 1.59.1 | Use existing surface observer if browser runner is unavailable; canonical origin remains Gateway 8080.[VERIFIED: probe] |
| Wrangler | local D1/target preflight | yes | 4.90.1 | — [VERIFIED: probe] |
| Docker | optional local service fallback | yes | 29.6.1 | Existing service supervisor is preferred.[VERIFIED: probe] |
| Local Gateway/API/Dashboard | local evidence | healthy | Gateway 8080, API 8787, Dashboard 5173 | Browser evidence still uses only `http://localhost:8080`.[VERIFIED: `pnpm check:services` on 2026-08-01] |
| GitHub App + `starye-org` Environment metadata/secrets | production tuple | not exposed to research process | — | Blocking for credentialed sign-off; run target validation/preflight and human credential gate before dispatch. Local contract evidence remains usable.[VERIFIED: 18-COVERAGE, RUNBOOK secret matrix] |

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|-------|---------|---------------|
| A1 | Derive provider run URL as the fixed repository URL plus numeric provider run ID instead of adding a free-form URL column/input. | Standard Stack / Pattern 2 | If provider requires a canonical URL field, DTO/schema design may need a narrow migration; accepting arbitrary URL would violate D-08. |
| A2 | The existing controlled path for the manga child-subitem proof will be selected after planner verifies available fixture/sync ownership; the current admin chapter API has no add route. | Pitfall 7 / Open Questions | TEST-01 could remain incomplete if a reversible add/restore path is not explicitly chosen. |

## Open Questions

1. **Which reversible manga child-subitem operation satisfies D-11?**
   - What we know: `Comics.vue` can list/delete chapters and bulk-delete; `apps/api/src/routes/admin/chapters/index.ts` exposes GET/DELETE/bulk-delete but no add-chapter route.[VERIFIED: repository]
   - What's unclear: Whether a controlled existing sync/fixture path is accepted as the add/restore owner, or whether an equivalent bounded subitem must be selected.
   - Recommendation: Decide before evidence work. Prefer an existing owner path with a snapshot/readback/restore contract; do not invent an untested direct D1 insert.

2. **Persist or derive provider run URL?**
   - What we know: provider association stores repository and numeric `provider_run_id`, while D-08 requires a provider URL.[VERIFIED: schema/types/context]
   - What's unclear: Whether UI/evidence needs a persisted URL or can derive the fixed GitHub URL.
   - Recommendation: Derive from server-owned repository + numeric ID, expose only after provider binding, and test exact host/path; add a schema field only if an authoritative provider response requires it.

3. **How much task detail should refresh fetch?**
   - What we know: D-02 requires all attempts; logs are separately sequence-paged.[VERIFIED: D-02/D-04]
   - What's unclear: Whether very large attempt histories need a future attempt cursor.
   - Recommendation: Return all attempts for this phase (attempts are normally small); keep log pagination separate and leave attempt pagination as future scope unless fixture data demonstrates a bound problem.

4. **What exact evidence filenames are stable?**
   - What we know: evidence must be JSON + Markdown and the existing evidence schema binds mode/target/run.[VERIFIED: D-13, `data-chain-evidence.ts`]
   - What's unclear: final phase-local directory/name convention.
   - Recommendation: Use separate `local/` and `production/` roots under the Phase 19 directory, names containing template + application run ID, and validate JSON/Markdown equality before sign-off.

## Recommended Plan Split

### Wave 0: Contract and test fixtures

- Freeze read-model DTOs, cursor encoding, provider-safe fields, receipt source params and evidence pair schema.
- Add fixtures for two templates, multiple tasks, repeated timestamps, attempts, provider statuses, redaction and permission roles.[RECOMMENDED]

### Wave 1: API read model

- Implement keyset list + `nextCursor`, latest summary, detail attempts/provider projection and stable log DTO.
- Preserve Hono/Valibot/session/template guard and existing repository/state-machine/receipt validation.
- Verify route, domain and type-check suites before UI work.[RECOMMENDED]

### Wave 2: Dashboard operations

- Implement grouped full history, same-page detail and attempt switching, provider summary, visibility-aware 5-second refresh, manual refresh, dynamic retry confirmation and cancel conflict states.
- Extend `Crawlers.test.ts` with fake timers, visibility, cursor pages, stale-response and permission cases.[RECOMMENDED]

### Wave 3: Receipt and CRUD proof

- Add controlled task/run/attempt source params and return link to existing Movies/Comics routes.
- Verify movie metadata + player add/delete/restore; resolve manga controlled child-subitem path, then metadata + child mutation/readback/restore.
- Keep all browser evidence on Gateway 8080.[RECOMMENDED]

### Wave 4: Evidence and operations

- Extend local runner/evidence pair for movie and manga and validate source separation.
- Add one production tuple capture/validator gated by target preflight and credentialed GitHub App/Environment; do not dispatch during planning.
- Update RUNBOOK durable owner with secret metadata, retention/cleanup, lost/cancel/retry/partial-ingest and rollback.[RECOMMENDED]

## Project Constraints (from AGENTS.md)

- 默认中文沟通、分析、验证和交付；研究文档保持中文。[VERIFIED: `AGENTS.md`]
- 修改仓库前按 GSD 工作流；本阶段实现应由 `$gsd-execute-phase` 执行，研究只写本文件。[VERIFIED: `AGENTS.md`]
- 当前 phase 约束优先信 `.planning/*`；稳定运维规则 closeout 后才写回 RUNBOOK。[VERIFIED: `AGENTS.md`, `docs/documentation-ownership.md`]
- 本地验证 canonical URL 必须是 `http://localhost:8080/...`，不得把 5173/8787 等直连端口当证据。[VERIFIED: `AGENTS.md`, RUNBOOK.md]
- 文档只修改 canonical owner；RUNBOOK 承担长期生产运维/rollback/storage policy。[VERIFIED: `AGENTS.md`, documentation ownership]
- 保留脏工作树中的无关改动，不做 repo-wide 清理或回滚。[VERIFIED: `AGENTS.md`]
- 修改代码 symbol 前先做 GitNexus impact；若 HIGH/CRITICAL 先告警；提交前运行 GitNexus detect-changes。[VERIFIED: `AGENTS.md`]
- 不引入任意命令、URL、workflow、secret 输入，不在 Worker 运行 Puppeteer，不增加实时日志、schedule 编辑、额外模板、自动重试或第二套编辑器。[VERIFIED: 19-CONTEXT, REQUIREMENTS]

## Sources

### Primary (HIGH confidence)

- `.planning/phases/19-dashboard-operations-and-end-to-end-proof/19-CONTEXT.md` — locked scope, UI/read-model, evidence, provider and RUNBOOK decisions.
- `.planning/phases/16-task-domain-foundation/16-CONTEXT.md` — task/attempt state machine, HMAC, log limits and retention.
- `.planning/phases/17-local-runner-vertical-slice/17-CONTEXT.md` and `17-03-SUMMARY.md` — local runner, receipt validation, Gateway CRUD and evidence boundary.
- `.planning/phases/18-github-actions-production-orchestration/18-CONTEXT.md`, `COVERAGE.md`, `18-06-SUMMARY.md` — fixed provider snapshots, triple-success gate and production tuple handoff.
- `apps/api/src/routes/admin/crawler-tasks/index.ts`, `apps/api/src/schemas/crawler-tasks.ts`, `apps/api/src/domain/crawler-tasks/{types,provider-association,repository}.ts` — current API/D1 contracts.
- `apps/dashboard/src/views/Crawlers.vue`, `apps/dashboard/src/lib/api.ts`, `useResourceGuard.ts`, `Movies.vue`, `Comics.vue` and focused tests — current UI/read/handoff patterns.
- `packages/db/src/schema.ts`, `.github/workflows/daily-{movie,manga}-crawl.yml`, `scripts/local-task-runner.e2e.ts`, `packages/config/src/deployment-target/data-chain-evidence.ts`, `RUNBOOK.md` — persistence, workflows, evidence and operations.

### Secondary (MEDIUM confidence)

- [CITED: https://vuejs.org/api/composition-api-lifecycle.html] — `onMounted`/`onUnmounted` lifecycle semantics.
- [CITED: https://developer.mozilla.org/en-US/docs/Web/API/Document/visibilitychange_event] — document visibility transition semantics.
- [CITED: https://hono.dev/docs/guides/validation] and [CITED: https://hono.dev/docs/guides/middleware] — Hono validator/middleware concepts; implementation follows repository patterns.
- npm registry checks on 2026-08-01 for `vue`, `hono`, `valibot`, `vitest`, `@vue/test-utils`, `@playwright/test`, `drizzle-orm`, `wrangler` — package existence/current registry metadata only, not upgrade recommendations.

### Tertiary (LOW confidence)

- None used for architectural decisions. The websearch provider was unavailable (`BRAVE_API_KEY` absent); repository evidence and official docs were used instead.[VERIFIED: tool output]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — existing manifests and focused npm registry probes; no new package proposed.
- Architecture: HIGH — current source, D1 schema, phase contracts and GitNexus execution-flow query agree.
- Pitfalls: HIGH for contract/security risks; MEDIUM for the unresolved manga child-subitem operation.

**Research date:** 2026-08-01
**Valid until:** 2026-08-31 for repository architecture; 2026-08-08 for provider/registry details.
