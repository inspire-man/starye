# Phase 24: Fresh Production Dashboard -> Viewer -> Playback Proof - Context

**Gathered:** 2026-08-08
**Status:** Ready for planning

<domain>
## Phase Boundary

本阶段用一个独立的 fresh production `task/run/attempt/provider` tuple，证明从已认证 Dashboard `repair_players` command 到 validated receipt、source observation、Gateway MovieDetail/Player 和实际浏览器播放的完整日常使用链路。验收必须绑定同一 content ID、source revision 和 tuple，并生成可追溯的脱敏 playback evidence。

本阶段只覆盖 production proof、bounded playback evidence、Dashboard 追溯和失败/checkpoint 语义。生产 Puppeteer 继续运行在 GitHub Actions；本地统一入口保持 `http://localhost:8080`；历史 Phase 13 carrier 不构成 v1.4 production evidence。provider success、repair/receipt success、source state 和 actual playback 继续作为独立事实层。

</domain>

<decisions>
## Implementation Decisions

### Fresh tuple 与 production target
- **D-01:** production proof 使用已入库且当前为 `no_source` 或 `source_failed` 的 movie。fresh 约束落在全新的 task/run/attempt/provider tuple，不要求创建新 content identity。
- **D-02:** fresh tuple 必须从已认证 Dashboard repair command 开始。Dashboard 提交 server-owned movie identity、bounded reason 和 target intent，随后轮询同一个 task detail；不使用 API/runner 预创建 task 或旧 task 的新 attempt 代替 Dashboard command。
- **D-03:** 使用服务端 registry 已登记的 selected production target profile。deployment target、Gateway origin、Actions workflow/repository/ref/environment 由 registry 绑定；evidence 只保存非敏感 target 标识。
- **D-04:** dispatch 前检查 signed Dashboard session、registry target、当前 movie disposition 可修复、同电影无 active repair 和 evidence root 可写。dispatch 后必须拿到新的 run/attempt/provider tuple；任一前置条件或 run allocation 缺失都停在 `checkpoint`。

### Playback source 与 actual playback pass
- **D-05:** Viewer 优先使用 source projection 中第一个 eligible `direct` source；没有 eligible direct 时才走现有受控 TorrServer/Aria2 路径，并把实际 `sourceType` 记录到 evidence。
- **D-06:** actual playback pass 需要在 bounded observation window 内观察到 `canplay`、`playing`，并采集两次 `currentTime`；`currentTimeAfter - currentTimeBefore >= 1s` 且无终态媒体错误才算通过。
- **D-07:** evidence 记录 allowlisted event timeline。`canplay`/`playing` 必须出现；`waiting`、`stalled`、`error` 按实际观察记录，未发生的事件显式表示未观察；终态 `error` 使 playback 失败。
- **D-08:** 沿用 Phase 22 的 bounded source retry：当前 source 最多尝试 2 次，仍失败后切换下一个 eligible source 或受控 TorrServer/Aria2 路径；所有尝试和最终 source 都进入 evidence，达到上限仍失败则为 `checkpoint/failed`。
- **D-09:** Viewer 保持 Player 当前 `autoplay: false`，Playwright 必须通过可见 Play button click 触发播放。导航覆盖 Dashboard task detail -> 同电影 MovieDetail -> source card -> Player -> Play，并记录各段 path 与选中 source。
- **D-10:** 点击后采用媒体事件驱动的 bounded wait；等待 `canplay`/`playing`，记录 `currentTimeBefore`，在限定窗口内等待至少 1 秒推进后记录 `currentTimeAfter`。Play button 不可见、点击无效、播放策略阻断、media error 或超时都保留实际 evidence 并停在 `checkpoint/failed`，不使用 autoplay、`evaluate().play()`、readyState 注入或人工接管绕过。

### Playback evidence projection 与 Dashboard 追溯
- **D-11:** D1 保存 task/run/attempt 绑定的 bounded playback summary，同时生成脱敏 JSON/Markdown artifact pair。D1 summary 与 artifact 不替代 receipt/source observation，三层状态继续分开。
- **D-12:** D1 evidence 字段限于 task/run/attempt/provider、content ID、source revision/type、provider/repair/playback 分层状态、Viewer path、allowlisted event observation/time、`currentTimeBefore/After/delta` 和 artifact reference。artifact 保留 allowlisted event timeline；raw source URL、token、cookie、session/signature material、原始 runner JSON 和完整媒体不进入 evidence。
- **D-13:** Dashboard task detail 以 current attempt 为焦点，独立展示 provider、repair/receipt 和 actual playback evidence 区块；展示同一 content ID、source revision、Viewer path 和 artifact reference；旧 attempts 保留为可展开 bounded history，不使用单一 overall success badge。
- **D-14:** JSON 是 canonical evidence source，Markdown 是确定性 projection。文件名绑定 task/run/attempt，写入前执行 schema、redaction 和 JSON/Markdown pair 一致性校验。
- **D-15:** 成功的 playback evidence 只有在 task/run/attempt、content ID 和 source revision 全部匹配时，才更新当前 bounded `playback_verified` projection；不改变 source health/receipt。失败 evidence 只保留在 task/evidence history。

### Browser evidence write boundary
- **D-16:** Playwright/Viewer 通过 server-owned、带 task/run/attempt/content/source revision 绑定的受控 endpoint 提交 bounded terminal summary；API 负责 schema validation、redaction、idempotency、CAS 和 D1 projection。verifier 不直接写 privileged D1，普通用户播放不产生本阶段 proof telemetry。
- **D-17:** evidence endpoint 复用同一 Gateway authenticated session cookie，并额外校验 tuple 绑定；session、nonce、signature material 不保存到 evidence。
- **D-18:** endpoint 接受一次 tuple 绑定的 bounded terminal summary，allowlisted event timeline 作为同一 evidence pair 处理。相同 payload 返回稳定 `duplicate/accepted`，冲突 payload 返回 `conflict`，不覆盖首个已验证事实。

### Artifact ownership、retention 与写入顺序
- **D-19:** JSON/Markdown pair 写入本次验证明确传入的 phase/CI evidence root，D1 只保存 artifact reference；本阶段不新增 R2 evidence storage 边界。
- **D-20:** 每个 task/run/attempt/provider tuple 生成不可覆盖的 pair，failed/checkpoint pair 也保留；不覆盖同一 movie 的旧 proof，不生成公开媒体 URL 或签名 URL。
- **D-21:** Dashboard 只展示 D1 bounded summary；JSON/Markdown 原件留在验证 workspace/CI artifact，由验证报告引用，生产应用不直接读取本地文件系统。
- **D-22:** 先构造、redact、校验并写入不可变 artifact pair，再提交 D1 summary/reference。任一步失败都不标记 pass；D1 提交失败时保留 artifact 并记录 `checkpoint`。

### Failure, retry 与 late evidence
- **D-23:** provider、repair/receipt、source 和 playback 是独立事实层。只有同一 fresh tuple 的各层全部满足要求且 playback 达标，才允许标记 production pass；provider/repair 成功但 Viewer 失败时保留前层成功，并将 playback 标为 failed/checkpoint。
- **D-24:** proof-level 失败后只允许使用 Player 内已锁定的 bounded retry；当前 tuple 停止并保留失败 evidence，下一次必须重新分配新的 task/run/attempt/provider tuple，不覆盖或复用当前 proof。
- **D-25:** 缺少 signed session、target、run allocation、evidence output、认证/Viewer 入口，或 tuple/content/source revision 不一致、evidence redaction/persistence 失败时记 `checkpoint`。完整 tuple 在 bounded provider/repair/browser 窗口内终态失败时记 `failed`；两者都保留部分 evidence。
- **D-26:** canonical verifier 必须检查同一 fresh tuple 的 task/run/attempt/provider、content/source revision、validated receipt、Viewer path、allowlisted event timeline、至少 1 秒 `currentTime` 推进、D1/artifact redaction 和 Dashboard trace；全部通过后才是 production pass，人工只复核脱敏摘要。
- **D-27:** 旧 attempt 的 playback evidence 通过 current task/run/attempt、content ID 和 source revision CAS；旧事件可保留为 `late/stale/ignored` 历史，但不更新 current projection。
- **D-28:** 只有对应 repair run 达到允许的 terminal/readback 状态、source revision 仍匹配且处于 bounded evidence window 内，playback evidence 才能影响 current projection。超时或 revision 变化只记 `late/stale`，不自动创建新的 repair attempt。
- **D-29:** duplicate/stale/late/conflict 返回稳定 outcome code 并保留 bounded rejection history；current projection 不变，Dashboard 同时展示当前 evidence 和 rejection history。

### the agent's Discretion
- bounded event timestamp、evidence identity/hash、window duration、API route naming、D1 schema/migration、CAS SQL 和 artifact filename 的具体实现，只要满足 D-01 至 D-29。
- evidence endpoint 的内部 DTO 拆分、错误码 allowlist、Dashboard section 布局、Playwright fixture/trace 组织和 production target 的非敏感 label，只要保持 server-owned、脱敏、可审计和同 tuple 约束。

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope, requirements and state
- `.planning/ROADMAP.md` §Phase 24 — fresh production Dashboard -> Viewer -> playback proof 的目标、成功标准和 Phase 13 carrier frozen 边界。
- `.planning/REQUIREMENTS.md` §Production Evidence / Traceability — EVID-01、EVID-02、EVID-03 的 tuple、事件、脱敏和 Dashboard trace 要求。
- `.planning/PROJECT.md` §Current Milestone / Out of Scope — GitHub Actions 执行边界、Gateway、server-owned template 和 v1.4 范围。
- `.planning/STATE.md` — Phase 24 当前 planning position、selected target/session/run allocation checkpoint 和 production evidence concerns。

### Prior phase contracts and verification
- `.planning/phases/23-github-actions-production-repair-and-reconciliation/23-CONTEXT.md` — provider association、repair receipt/source revision、current attempt、late callback 和 Phase 24 boundary。
- `.planning/phases/23-github-actions-production-repair-and-reconciliation/23-VERIFICATION.md` — Phase 23 provider/repair/reconciliation 已验证事实与 fresh browser proof 的 deferred boundary。
- `.planning/phases/22-dashboard-moviedetail-and-player-state-closure/22-CONTEXT.md` — source selection、bounded retry、Dashboard polling、MovieDetail handoff 和 Player 状态边界。
- `.planning/phases/22-dashboard-moviedetail-and-player-state-closure/22-VERIFICATION.md` — Phase 22 Gateway MovieDetail/Player/UI 验证和 media proof 尚未完成的边界。
- `.planning/phases/21-source-health-and-local-repair-players-vertical-slice/21-CONTEXT.md` — local repair_players、source observation、receipt、retry 和 stale-event 基线。

### Research and evidence patterns
- `.planning/research/SUMMARY.md` §Phase 24 — fresh tuple、D1/source/readiness/playback 分层和 artifact evidence 目标。
- `.planning/research/STACK.md` §E2E Evidence / §Fresh production proof — Playwright、Gateway、event timeline、currentTime delta 和 redacted evidence schema。
- `.planning/research/PITFALLS.md` — 不把 HTTP 200、DOM、截图、Actions success 或 canplay 单独当作 actual playback pass 的失败模式。
- `packages/config/src/deployment-target/data-chain-evidence.ts` — 既有 evidence pair、redaction、deterministic JSON/Markdown 和 checkpoint 语义模式。
- `scripts/phase19-evidence.ts` — 既有 canonical JSON + Markdown evidence pair、safe-field 校验和文件输出模式。
- `scripts/local-task-runner.e2e.ts` — 既有 `--evidence-dir`、Gateway E2E、repair readback 和 evidence redaction 组织方式。

### Current implementation and integration points
- `apps/api/src/domain/movies/source-contract.ts` — `PlaybackEvidence`、`PlaybackProjection`、`derivePlaybackProof` 和 bounded `playback_verified` projection。
- `apps/api/src/routes/admin/crawler-tasks/index.ts` — task detail/readback projection、current attempt、repair source projection 和 Dashboard DTO 边界。
- `apps/api/src/domain/crawler-tasks/types.ts` — provider/task/run/attempt/receipt contracts and bounded projections。
- `apps/api/src/domain/crawler-tasks/repository.ts` — task/run/attempt/lease/CAS、idempotent callback、history 和 current projection source of truth。
- `apps/api/src/routes/internal/crawler-runs/index.ts` — signed callback and lifecycle event validation boundary to reuse for tuple binding.
- `apps/dashboard/src/views/Crawlers.vue` — task polling、current-attempt focus、repair action、history、same-movie navigation and bounded provider/source display。
- `apps/dashboard/src/lib/api.ts` — typed Dashboard task/readiness/playback projections。
- `apps/movie-app/src/views/MovieDetail.vue` — readiness/source-health display、source card routing、same-movie handoff and playback proof projection display。
- `apps/movie-app/src/views/Player.vue` — xgplayer lifecycle、`autoplay: false`、media events、bounded retry、source fallback and currentTime progress hooks。
- `.github/workflows/daily-movie-crawl.yml` — production GitHub Actions browser execution boundary and server-owned workflow inputs。

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/api/src/domain/movies/source-contract.ts` already derives a bounded `playback_verified` projection only from explicit `playing` plus positive `currentTime`; use it as the public projection boundary, not as the full event log.
- `apps/movie-app/src/views/Player.vue` already owns xgplayer construction, `autoplay: false`, `canplay`/`playing`/`waiting`/`error`/`timeupdate` handling, bounded retry and source fallback behavior.
- `apps/movie-app/src/views/MovieDetail.vue` already renders readiness/source health, source-type actions and the separate playback proof section; use its same-movie/source-card route rather than inventing a second Viewer entry.
- `apps/dashboard/src/views/Crawlers.vue` already polls the task panel, focuses the latest run, preserves history, creates repair tasks and links a repair task back to the same movie.
- `apps/api/src/routes/admin/crawler-tasks/index.ts` already projects bounded task detail, repair source readback, provider/receipt/reconciliation summaries and current-attempt history.
- `scripts/phase19-evidence.ts` and `packages/config/src/deployment-target/data-chain-evidence.ts` provide canonical JSON/Markdown pair generation, deterministic rendering, redaction checks and evidence-root output patterns.

### Established Patterns
- D1 task/run/attempt/lease/provider/receipt/source-revision facts are authoritative; callbacks and browser observations are inputs to validated projections, never standalone success proofs.
- Current source projection is CAS-gated and append-only observations/history remain queryable; late/stale/duplicate/conflict outcomes are bounded and replay-safe.
- Gateway `http://localhost:8080` is the canonical local route; direct app/API ports are implementation details and do not constitute proof.
- Production Puppeteer remains in GitHub Actions with registry-owned workflow/target/environment; Dashboard and evidence must not expose URL, command, workflow, token, secret or signature material.
- Existing Player retry and source policy are bounded; score/order does not substitute for eligibility or actual playback.
- JSON canonical plus deterministic Markdown, immutable tuple-bound filenames, redaction and pair validation are the established evidence pattern.

### Integration Points
- The admin repair command and task detail route must carry the fresh tuple and bounded playback evidence reference without merging provider/repair/playback statuses.
- The authenticated Gateway session must span Dashboard, MovieDetail and Player so the evidence endpoint can bind the browser submission to the same task/run/attempt/content/source revision.
- The Movie readiness/public projection, evidence endpoint and source-revision CAS must reject stale playback evidence while allowing a matching successful observation to expose `playback_verified`.
- The Playwright/browser proof runner must navigate the existing Dashboard -> MovieDetail -> source card -> Player path, collect event/time evidence, write the artifact pair, then submit the D1 summary.
- The canonical verifier must compare D1 summary, artifact pair, task detail and live Viewer observations before claiming production pass; missing preconditions remain checkpoint artifacts.

</code_context>

<specifics>
## Specific Ideas

- A stable existing repairable movie is preferred so the proof isolates the fresh production tuple and browser playback boundary instead of introducing metadata-ingest variability.
- The accepted source path is eligibility-first: direct first, controlled TorrServer/Aria2 only when direct is unavailable, with actual source type and all bounded attempts visible in evidence.
- A real visible Play click is part of the proof. `canplay` is readiness, `playing` is start, and at least one second of currentTime progress is the terminal browser fact.
- A single success badge is explicitly rejected. Provider acceptance, validated receipt, current source state and actual playback must remain visually and machine-auditable as separate facts.
- `SUN-064` may be used as a candidate only when it is currently repairable; its historical carrier or any prior Phase 13 evidence must not be reused as the Phase 24 fresh tuple.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within Phase 24 scope. Broader user playback telemetry, public artifact hosting, R2 evidence lifecycle, automatic unbounded retries and additional content-type repair templates remain outside this phase.

</deferred>

---

*Phase: 24-fresh-production-dashboard-viewer-playback-proof*
*Context gathered: 2026-08-08*
