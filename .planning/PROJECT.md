# Starye — 个人内容中台

## What This Is

一个自用的个人内容中台：集视频库（movie-app）、漫画库（comic-app）、博客（blog）、后台运管（dashboard）、爬虫（crawler）、认证（auth）、网关（gateway）、边缘 API（api）于一体，统一部署在 Cloudflare 边缘网络上，供作者一个人日常使用。

## Core Value

**"部署在公网、能稳定日常使用的个人内容中台"** —— 所有子应用在同一域名下协同工作，能长期保持可访问、可阅读、可观看。其他一切（特性完整度、多用户、正式审核流）都可以退让，但"能用、不崩"必须守住。

## Current Milestone: v1.1 存储成本控制与代码/文件整理

**Goal:** 把 Starye 的文件存储策略调整到免费额度优先、可审计、可回退：漫画章节正文图片只保存源站外链，R2 仅保留封面、头像、logo、fallback、手动上传等必要资产，同时瘦身文档入口和整理存储相关代码。

**Target features:**
- 明确 Cloudflare 免费额度边界和 R2 使用策略，避免因章节正文图、Worker 图片代理或无限备份产生扣费。
- 漫画章节页链路改为源站图片 URL 存储与直连展示，Crawler/API/Reader 均不默认上传或代理正文图。
- R2 上传入口改成 purpose allowlist，只允许 cover/poster/avatar/logo/fallback/manual/temp 等必要资产。
- 增加 R2 prefix 审计、生命周期清理、预算提醒和运行手册，能快速发现并处理高成本对象。
- 将 AGENTS.md 精简为入口索引，把历史阶段文档归档/清理，保留当前开发真正需要读的文件。
- 围绕存储、爬虫、comic 阅读链路做小步代码整理和测试补强，不做跨产品大重写。

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

### Active

- [ ] v1.1 存储成本控制：R2 只用于必要资产，章节正文图不进入 Cloudflare 存储或 Worker 代理。
- [ ] v1.1 漫画章节外链化：crawler 保存源站图片 URL，API 与 Reader 保持可读、可失败提示、可验证。
- [ ] v1.1 成本护栏：预算提醒、R2 prefix 审计、生命周期清理和运行手册可执行。
- [ ] v1.1 文档/入口瘦身：AGENTS.md、RUNBOOK、.planning 文档边界清楚，历史 phase 文件按 GSD 规则清理或归档。
- [ ] v1.1 存储相关代码整理：上传目的、R2 key、图片处理和 crawler 脚本策略统一，测试覆盖关键防线。

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

**当前状态（2026-07-11）**：

- v1.0 "部署可用、日常使用态" 已完成并归档到 `.planning/milestones/`
- 5/5 phases verified，24/24 plans complete，最终 audit 无 unsatisfied requirements
- 活动 `REQUIREMENTS.md` 已归档，下一 milestone 需要重新定义 requirements
- 已接受的归档债：Phase 1 无 retroactive `01-SECURITY.md`；Phase 1/2 部分 summary anchors 与 traceability metadata 滞后；下一次真实 migration workflow 需复核 R2 backup object path
- v1.1 研究确认：R2 免费层适合少量必要资产，不适合漫画章节正文图；D1 存 URL 成本低；Worker/Pages Function 不应作为图片代理默认路径

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
| R2 不做视频宿主，漫画详情图片逐步迁出 R2 | 存储 + 出站成本相对价值不划算；单用户内容中台优先使用现有 magnet / TorrServer / 外链路径，后续图片也逐步回到更轻的直链方案 | — New |
| v1.0 归档接受 metadata tech debt | final audit 无 unsatisfied runtime requirements；剩余为 summary/traceability/security-artifact 归档债 | ✓ Accepted |
| 漫画章节正文图只保存源站 URL | Cloudflare 免费额度优先，章节正文图体量最大且可重新抓取；R2 只保留封面等必要资产 | — New |
| R2 上传改为 purpose allowlist | 通用 `images/` 上传路径无法表达成本边界，必须从 API 与 crawler 双侧阻止正文图误入 R2 | — New |
| AGENTS.md 只保留入口级规则 | 当前文件过长，容易埋没真正必须执行的 repo 边界；细节迁入 RUNBOOK/.planning 或专题文档 | — New |

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
*Last updated: 2026-07-11 after v1.1 milestone start*
