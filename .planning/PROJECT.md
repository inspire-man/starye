# Starye — 个人内容中台

## What This Is

一个自用的个人内容中台：集视频库（movie-app）、漫画库（comic-app）、博客（blog）、后台运管（dashboard）、爬虫（crawler）、认证（auth）、网关（gateway）、边缘 API（api）于一体，统一部署在 Cloudflare 边缘网络上，供作者一个人日常使用。

## Core Value

**"部署在公网、能稳定日常使用的个人内容中台"** —— 所有子应用在同一域名下协同工作，能长期保持可访问、可阅读、可观看。其他一切（特性完整度、多用户、正式审核流）都可以退让，但"能用、不崩"必须守住。

## Latest Archived Milestone: v1.5 爬虫运管与内容可用性闭环

**Closeout:** `override_closeout` on 2026-08-22. All 22 v1.5 requirements, 4 phase verifications and 23 plans passed; 11 inherited global artifact-audit items remain acknowledged as deferred in `.planning/STATE.md`.

**Delivered and deferred scope:**

- Phase 25-28 delivered the task control plane, video/magnet availability, comic chapter completeness, chapter image availability, Dashboard projections, bounded observations, canonical Gateway acceptance and production deployment evidence.
- Production SHA `184e294` passed all deployment/CI workflows. Manga Crawl `32536822682` succeeded and D1 readback proved a matching provider/run tuple.
- Production chapter `790-34389` passed 25/25 bounded image checks and the same source image decoded in a browser at `720x9074`.
- Production Reader UI evidence is explicitly bounded by R18 authentication; the full Reader tuple is retained in Phase 28 local Gateway verification.

- Phase 20-24 delivered the source readiness contract, bounded source health, local and production `repair_players`, eligibility-aware playback state, GitHub Actions reconciliation, and fresh Dashboard → Viewer → playback evidence.
- Metadata persisted, source transport/health, repair execution, receipt/readback, and actual playback remain independent fact layers; `SUN-064 players=0` is handled through an explicit disposition and repair boundary.
- Phase 24 completed the fresh tuple evidence chain with tuple-bound D1 persistence, redacted playback events, visible Play, positive `currentTime` progress, and 15/15 UAT.
- The global `audit-open` result still contains 11 historical or current debug sessions; they are tracked as follow-up context and are not v1.4 requirement gaps.
- The unrelated `@starye/config` CI lint baseline remains tracked as non-causal technical debt.

## Current Milestone: Planning Next Milestone

v1.5 已完成；下一里程碑将在 `$gsd-new-milestone` 中定义。

**Target features:**

- 爬虫任务增删改、详情、取消、重试、运行历史与审计状态形成统一运管入口。
- 视频元数据、播放源和磁链可用性分别检查、呈现并支持受控修复或复查。
- 漫画章节完整性覆盖缺章、重复章、顺序异常和抓取终态。
- 章节图片可用性覆盖缺图、失效 URL、加载失败、顺序与数量异常。
- 任务、检查结果、修复动作和脱敏证据通过 canonical Gateway 串成可验收链路。

## Current State

v1.5 已交付并部署。产品当前拥有可审计的 D1 crawler control plane、local/production runner、Dashboard task operations、视频和漫画可用性检查、revision/CAS projection、receipt/readback 与 bounded Gateway evidence。

**Latest archived milestone:** v1.5 爬虫运管与内容可用性闭环（2026-08-22，override closeout）

**Archive evidence:**

- `.planning/milestones/v1.5-MILESTONE-AUDIT.md` — 22/22 requirements, 4/4 phases, 23/23 plans, production and local evidence boundaries
- `.planning/milestones/v1.5-ROADMAP.md` — full v1.5 phase roadmap archive
- `.planning/milestones/v1.5-REQUIREMENTS.md` — archived v1.5 requirements and complete traceability
- `.planning/milestones/v1.5-phases/` — full v1.5 phase artifacts

**Deferred historical evidence:**

- The v1.2 selected-production Viewer terminal proof remains frozen at `canonical_viewer_unavailable` in the v1.2 archive.
- The global audit-open debug sessions acknowledged during the v1.4 backfill remain listed in `.planning/STATE.md` for future explicit triage.

<details>
<summary>Archived Milestone Focus - v1.1 存储成本控制与代码/文件整理</summary>

**Goal:** 把 Starye 的文件存储策略调整到免费额度优先、可审计、可回退：漫画章节正文图片只保存源站外链，R2 仅保留封面、头像、logo、fallback、手动上传等必要资产，同时瘦身文档入口和整理存储相关代码。

**Delivered capabilities:**

- 明确 Cloudflare 免费额度边界和 R2 使用策略，避免因章节正文图、Worker 图片代理或无限备份产生扣费。
- 漫画章节页链路改为源站图片 URL 存储与直连展示，Crawler/API/Reader 均不默认上传或代理正文图。
- R2 上传入口改成 purpose allowlist，只允许 cover/poster/avatar/logo/fallback/manual/temp 等必要资产。
- 增加 R2 prefix 审计、生命周期清理、预算提醒和运行手册，能快速发现并处理高成本对象。
- 将 AGENTS.md 精简为入口索引，把历史阶段文档归档/清理，保留当前开发真正需要读的文件。
- 围绕存储、爬虫、comic 阅读链路做小步代码整理和测试补强，不做跨产品大重写。

</details>

## Requirements

### Validated

<!-- 从现有代码库推断，已实现并在用的能力。 -->

- ✓ 视频浏览基础：movie-app 可刷视频 — existing
- ✓ 漫画浏览基础：comic-app 可阅读漫画 — existing
- ✓ 博客发文：blog 可发布 Markdown 文章 — existing
- ✓ 内容后台 CRUD：dashboard 可增删改查 — existing
- ✓ 边缘路由：gateway 按路径反代各子应用 — existing
- ✓ Hono API：暴露 /movies /actors /comics /admin /public 路由 — existing
- ✓ 爬虫抓取：crawler 每日三次（UTC 00/08/16）定时抓取入库 — existing
- ✓ 身份认证：Better Auth + GitHub OAuth 可登录（尚未全量接入访问控制） — existing
- ✓ 数据层：D1 + R2 + KV + Drizzle ORM 已搭建 — existing
- ✓ dashboard 访问控制：Gateway 前置拦截 + API `requireAuth` 短路，仅 `ADMIN_GITHUB_ID` 白名单可进入 — Validated in Phase 2
- ✓ 前台登录门控：收藏按钮 + 成人内容 R18 过滤（WHERE 层）接入 `useAuthGuard` + `buildAdultVisibilityCondition` — Validated in Phase 2
- ✓ 公网暴露面加固：`/robots.txt` + `X-Robots-Tag` + `*.pages.dev` 301! + `/api/docs` 鉴权；WAF 限速（PUBSEC-03）配置步骤写入 RUNBOOK，需部署时手配 — Validated in Phase 2
- ✓ 统一认证与会话基线：五端 session 互通、Nuxt SSR 读 session、Better Auth 1.6.10、Gateway auth/cache 安全边界、服务端登出失效 — v1.0
- ✓ 播放稳定化：movie-app 播放错误卡片、waiting 超时、同源重试、离线按钮反馈、R18 防线不回退 — v1.0
- ✓ 统一进度：`progress` 表支撑 movie/comic 的恢复、保存、完成态、pagehide flush 与历史消费面 — v1.0
- ✓ 部署与运维基础盘：deploy/rollback workflows、D1 backup-before-apply、destructive migration reviewer gate、Sentry、RUNBOOK — v1.0
- ✓ v1.1 存储成本控制：R2 只用于必要资产，章节正文图不进入 Cloudflare 存储或 Worker 代理。 — v1.1
- ✓ v1.1 漫画章节外链化：crawler 保存源站图片 URL，API 与 Reader 保持可读、可失败提示、可验证。 — v1.1
- ✓ v1.1 成本护栏：预算提醒、R2 prefix 审计、生命周期清理和运行手册可执行。 — v1.1
- ✓ v1.1 文档/入口瘦身：AGENTS.md、RUNBOOK、`.planning` 文档边界清楚，历史 phase 文件按 GSD 规则清理或归档。 — v1.1
- ✓ v1.1 存储相关代码整理：上传目的、R2 key、图片处理和 crawler 脚本策略统一，测试覆盖关键防线。 — v1.1
- ✓ v1.2 显式 TargetProfile、env 投影、target-first preflight 与 typed runtime/workflow contract。 — v1.2
- ✓ v1.2 Pages redirect、legacy-domain、RUNBOOK 与 30-row evidence-matrix 静态验证。 — v1.2
- ✓ v1.3 Phase 16 任务域基础：受控模板、D1 task/run/attempt/log/lease、审计状态机、task/run 授权、独立 HMAC 回调与日志脱敏。 — Validated in Phase 16

### Validated in v1.3

- ✓ 后台可创建视频、漫画的受控爬虫执行任务，并在本地与生产环境分别调度对应 runner。 — Phases 16-19
- ✓ 任务执行记录可持久化呈现排队、运行、成功、失败、取消和重试状态，并记录结构化日志。 — Phases 16-19
- ✓ 生产后台可受控编排 GitHub Actions，任务状态和最终入库结果会回写到后台。 — Phases 18-19
- ✓ 后台可在爬取入库后管理视频、漫画内容的增删改，并完成端到端验收。 — Phases 17, 19

### Validated in v1.4

- ✓ `SRC-01`, `SRC-03`: task detail/MovieDetail 分离 metadata persisted 与 playback readiness，并对 `SUN-064 players=0` 给出可读回的 no-source/repairable disposition。 — Phase 20
- ✓ `SRC-02`, `REP-01`: 受控播放源 health/readback 与固定模板 `repair_players` 操作通过 canonical local Gateway 串接。 — Phase 21
- ✓ `REP-02`, `REP-03`: production repair 的 attempt、lease、provider、signed callback、retry/reconciliation、receipt 和同 content readback 保持可追溯。 — Phase 23
- ✓ `PLAY-01`, `PLAY-02`, `PLAY-03`: MovieDetail、Dashboard 和 Player 提供 eligibility-aware 状态、受控路径、bounded retry/fallback 和状态反馈。 — Phase 22
- ✓ `EVID-01`, `EVID-02`, `EVID-03`: fresh production tuple 贯通 Dashboard → D1 → provider → receipt/source → Viewer → playback，并保存 bounded redacted evidence。 — Phase 24

### Validated in v1.5

- ✓ 爬虫任务运管：受控任务增删改、详情、运行历史、取消、重试和审计状态保持 task/run/attempt 一致。 — Phase 25
- ✓ 视频数据可用性：metadata、direct source、magnet source、playback readiness 分层检查并支持受控修复。 — Phase 26
- ✓ 漫画章节完整性：source snapshot、缺章/重复/顺序诊断、终态区分和 targeted repair。 — Phase 27
- ✓ 章节图片可用性：页身份、数量/顺序、bounded probe、失败样本和定向修复。 — Phase 28
- ✓ 全链路验收：Dashboard、runner、D1 projection、receipt、content readback 和 Reader evidence 形成可重复验证链路。 — Phase 28

### Out of Scope

<!-- 明确排除，附原因，避免以后再讨论。 -->

- 多用户 / 朋友共用 — 自用工具，不做用户隔离和配额
- dashboard 正式审核流 — "审核"语义作者尚未明确定义，待 v1 之后再立项
- 对外发布 / 运营 / SEO — 单用户内容中台，不面向陌生访客做增长
- 移动端原生应用 — 浏览器访问已够用，不做 iOS/Android 原生
- 实时协作 / 评论 / 点赞 — 单用户场景不需要
- 支付 / 会员体系 — 自用，无商业化
- Worker/Pages Function 代理漫画正文图 — 会把阅读流量转成 Cloudflare 请求/CPU 成本，默认禁止；仅允许短期诊断开关且必须有上限
- Cloudflare Images / Stream / Cache Reserve / Argo 等付费 add-on — v1.1 不启用，除非单独完成成本评估
- v1.2 selected-production Viewer terminal proof — 已冻结的 p13-66 不重试；仅在单独定义的新里程碑中以 fresh run 处理
- 后台任意命令、密钥、来源地址和定时策略编辑 — 任务仅使用受控视频/漫画模板，避免绕过既有 target-profile 与凭据边界

## Context

**Brownfield monorepo**：项目是一个已经运行一段时间的 Turborepo 单仓，结构成熟，多数能力"能用但有缺口"。见 [`.planning/codebase/`](.planning/codebase/) 下的 STACK / ARCHITECTURE / STRUCTURE / CONVENTIONS / TESTING / INTEGRATIONS / CONCERNS。

**部署形态**：

- Cloudflare Workers — `apps/api`（Hono + D1/R2/KV），`apps/gateway`（反向代理 + 缓存）
- Cloudflare Pages — `apps/dashboard`、`apps/movie-app`、`apps/comic-app`、`apps/blog`、`apps/auth`
- GitHub Actions — 定时调度爬虫

**关键路径**：gateway 作为单一入口 → 按 `/api` `/dashboard` `/movie` `/comic` `/blog` `/auth` `/tavern` 分发。

**最近动向**（摘自 git log）：

- `fdd6a4e` gateway cache invalidation + monitoring
- `0121cc9` dashboard 加 SillyTavern 入口
- `4cefbe6` movie-app advance search + personalized recommendation + new release

**当前状态（2026-08-05）**：

- v1.0 与 v1.1 都已完成并归档到 `.planning/milestones/`
- v1.1 已通过 milestone audit：5/5 phases complete，15/15 plans complete，22/22 v1 requirements satisfied
- v1.2 已以 override closeout 归档；其 selected-production Viewer proof 保持历史 deferred 状态
- v1.3 已以 override closeout 归档：18/18 requirements、4/4 phases、4/4 integration flows、4/4 end-to-end flows 均通过
- v1.4 已完成播放可用性、生产修复与 fresh production evidence，并归档其 phase artifacts
- v1.5 通过 `$gsd-new-milestone` 进入需求定义，聚焦爬虫运管、视频磁链、漫画章节和章节图片的数据可用性
- selected-production Viewer proof 的历史 Phase 13 carrier 继续冻结；v1.4 使用独立 fresh run 处理播放验收
- 已接受的历史归档债仍主要来自 v1.0：Phase 1 无 retroactive `01-SECURITY.md`；Phase 1/2 部分 metadata 滞后；下一次真实 migration workflow 需复核 R2 backup object path
- v1.1 已把 R2 必要资产边界、external/source image semantics、shared storage helper、policy-aware admin/script behavior 和 canonical doc ownership 一并收口
- v1.4 已完成 `SUN-064 players=0` 的播放源修复边界；`@starye/config` lint baseline 继续作为独立技术债

**已知风险区**：见 [`.planning/codebase/CONCERNS.md`](.planning/codebase/CONCERNS.md) —— v1 Active 需求会优先覆盖里面影响"日常使用"的问题。

## Constraints

- **技术栈**：沿用现有 Turborepo + Cloudflare Workers/Pages + Hono + Vue 3/Nuxt 4 + D1/R2/KV + Drizzle + Better Auth — 已有大量代码投入，不重写
- **预算**：维持在 Cloudflare 免费额度内（或接近免费） — 自用项目不愿承担月费
- **R2 使用**：R2 只允许必要资产和临时诊断文件；章节正文图、批量漫画页、长期 debug dump 默认禁止
- **外链风险**：漫画正文图使用源站 URL 会带来失效、防盗链和加载速度风险，需要 Reader 失败状态与可重抓策略兜底
- **单用户**：作者一人使用，不做多租户隔离、配额、计费
- **包管理**：pnpm 10.33.0（lockfile 已锁，workspace 配置已定）
- **分支策略**：主干 `main`，功能在分支（worktree）开发后合入
- **中文注释 / 文档**：作者使用中文作为主交流语言

## Key Decisions

<!-- 项目生命周期中做出的关键决策。 -->

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| 全栈 Cloudflare 生态（Workers + Pages + D1 + R2 + KV） | 边缘低延迟、成本低、已有积累 | ✓ Good |
| Better Auth + GitHub OAuth 作为唯一登录方案 | 单用户场景不需要多 provider；GitHub 作者已有账号 | — Pending（v1 需要全链路打通） |
| 爬虫走 GitHub Actions 定时任务而非 Cron Trigger | 自由控制调度 + 复用 Actions 额度 | ✓ Good |
| Hono + hono-openapi 生成 API 文档 | 类型安全 + 自动生成 Scalar UI | ✓ Good |
| "审核"流程延后到 v1 之后 | 语义未明确，先不做 | — Pending |
| Monorepo 用 Turborepo + pnpm workspace | 多应用共享 packages/ui、packages/db | ✓ Good |
| R2 不做视频宿主，漫画详情图片逐步迁出 R2 | 存储 + 出站成本相对价值不划算；单用户内容中台优先使用现有 magnet / TorrServer / 外链路径，后续图片也逐步回到更轻的直链方案 | ✓ Good |
| v1.0 归档接受 metadata tech debt | final audit 无 unsatisfied runtime requirements；剩余为 summary/traceability/security-artifact 归档债 | ✓ Accepted |
| 漫画章节正文图只保存源站 URL | Cloudflare 免费额度优先，章节正文图体量最大且可重新抓取；R2 只保留封面等必要资产 | ✓ Validated in Phase 7 |
| shared storage semantics 保持为 `@starye/api-types` 纯 helper 层 | 需要 API 和 crawler 共用一套 contract，但不引入跨 Worker/Node 的 shared runtime service | ✓ Validated in Phase 10 |
| 合法 external image URL 是允许的终态，不再以 “是否 R2” 代替业务正确性判断 | Phase 7 已把正文图外链化，Phase 10 继续把 admin heuristics 与 legacy scripts 拉回 policy-aware 语义 | ✓ Validated in Phase 10 |
| R2 上传改为 purpose allowlist | 通用 `images/` 上传路径无法表达成本边界，必须从 API 与 crawler 双侧阻止正文图误入 R2 | ✓ Validated in Phase 8 |
| AGENTS.md 只保留入口级规则 | 当前文件过长，容易埋没真正必须执行的 repo 边界；细节迁入 RUNBOOK/.planning 或专题文档 | ✓ Validated in Phase 9 |
| 文档 owner 固定为 README / AGENTS / RUNBOOK / `.planning` / `docs` / `docs/archive` / `openspec` | 避免 root docs 和旧存储文档继续漂移成多份 source of truth | ✓ Validated in Phase 9 |
| v1.2 以 Cloudflare 账户/域名切换与真实全链路验证为主线 | 需要证明部署与数据链路可迁移、可复现、可验收，而不是继续扩大存储/文档整理 scope | ✓ Accepted at v1.2 closeout |
| v1.2 证据矩阵以当前 verifier 为状态源 | 历史 summary 和 checkbox 仅表明 ownership；`SATISFIED`、`PARTIAL`、`FAILED/CHECKPOINT` 必须保留原始语义 | ✓ Validated in Phase 15 |
| v1.2 以 override closeout 归档 | 生产 Viewer 终态证明未达成，用户接受将其与 8 个历史 debug sessions 记录为延期项 | ✓ Accepted at v1.2 closeout |
| v1.3 生产 crawler 继续由 GitHub Actions 执行 | Cloudflare API 负责受控编排与状态汇总，Node/Puppeteer crawler 保持在现有 GitHub Actions 执行环境 | ✓ Validated in Phase 19 |
| v1.3 task/run 控制面以 D1 为唯一可审计事实 | 本地 runner 与 GitHub Actions 需共享同一状态、attempt、日志和受限 command 语义 | ✓ Validated in Phase 16 |
| v1.3 生产成功必须绑定完整 provider tuple | 只有匹配的 D1 task/run/attempt、provider run、签名事件、validated receipt 与既有编辑器 CRUD readback/restore 才能标记生产通过 | ✓ Validated in Phase 19 |
| v1.3 receipt 复用既有内容编辑器 | 生产验收沿用 `primaryContentId` 进入现有 Dashboard/API/remote D1 CRUD，不新增第二套编辑器 | ✓ Validated in Phase 19 |
| v1.3 以 override closeout 归档 | 8 个历史 artifact-audit items 被明确记录为 deferred；`SUN-064 players=0` 与 lint baseline 保留为非阻塞技术债 | ✓ Accepted at v1.3 closeout |
| v1.4 将 metadata、source health、repair、receipt/readback 与 actual playback 分成独立事实层 | 单项成功不能掩盖来源不可用、旧 revision、失败回调或未验证播放 | ✓ Validated in Phases 20-24 |
| v1.4 repair 只接受 server-owned operation snapshot 和 revision-bound intent | 继续复用 D1 control plane，拒绝任意 URL、命令、workflow、凭据和无界证据 | ✓ Validated in Phases 21-23 |
| v1.4 生产浏览器继续由 GitHub Actions 承担 | Cloudflare Worker 只负责编排、鉴权、回调和 readback，不在 Worker 内运行完整 crawler/browser | ✓ Validated in Phase 23 |
| v1.4 `playback_verified` 必须通过显式播放事件与正向 progress gate | fixture、按钮可见、provider success 或 metadata success 单独不构成实际播放证明 | ✓ Validated in Phase 24 |
| v1.4 fresh production proof 使用独立 tuple | 历史 Phase 13 carrier 保持 frozen，新的 task/run/attempt/provider 必须可单独追溯 | ✓ Validated in Phase 24 |
| v1.4 以 override closeout 补归档 | 归档发生在 v1.5 kickoff 后；全局 audit-open 项作为非 v1.4 requirement 的 deferred context 保存 | ✓ Accepted at v1.4 archive |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-08-22 after v1.5 milestone closeout*
