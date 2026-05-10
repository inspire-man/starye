# Starye — 个人内容中台

## What This Is

一个自用的个人内容中台：集视频库（movie-app）、漫画库（comic-app）、博客（blog）、后台运管（dashboard）、爬虫（crawler）、认证（auth）、网关（gateway）、边缘 API（api）于一体，统一部署在 Cloudflare 边缘网络上，供作者一个人日常使用。

## Core Value

**"部署在公网、能稳定日常使用的个人内容中台"** —— 所有子应用在同一域名下协同工作，能长期保持可访问、可阅读、可观看。其他一切（特性完整度、多用户、正式审核流）都可以退让，但"能用、不崩"必须守住。

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

### Active

<!-- v1 的目标：让"部署可用、日常使用"这件事真正成立。 -->

- [ ] movie-app 播放页稳定性：消除"偶尔出错"，确保播放链路可靠
- [ ] comic-app 阅读进度：记录并恢复用户阅读位置（登录用户）
- [ ] dashboard 访问控制：强制登录 + 仅作者账号可进入
- [ ] 前台登录门控：收藏 / 观看进度 / 成人内容等敏感功能要求登录
- [ ] 认证全链路打通：gateway + api + 各前端统一读写同一会话
- [ ] 部署基础盘：确保所有子应用在 Cloudflare 生产环境下可一键部署、可回滚
- [ ] 基础可观测：关键错误可见（至少是 API / gateway / 播放失败）

### Out of Scope

<!-- 明确排除，附原因，避免以后再讨论。 -->

- 多用户 / 朋友共用 — 自用工具，不做用户隔离和配额
- dashboard 正式审核流 — "审核"语义作者尚未明确定义，待 v1 之后再立项
- 对外发布 / 运营 / SEO — 单用户内容中台，不面向陌生访客做增长
- 移动端原生应用 — 浏览器访问已够用，不做 iOS/Android 原生
- 实时协作 / 评论 / 点赞 — 单用户场景不需要
- 支付 / 会员体系 — 自用，无商业化

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

**已知风险区**：见 [`.planning/codebase/CONCERNS.md`](.planning/codebase/CONCERNS.md) —— v1 Active 需求会优先覆盖里面影响"日常使用"的问题。

## Constraints

- **技术栈**：沿用现有 Turborepo + Cloudflare Workers/Pages + Hono + Vue 3/Nuxt 4 + D1/R2/KV + Drizzle + Better Auth — 已有大量代码投入，不重写
- **预算**：维持在 Cloudflare 免费额度内（或接近免费） — 自用项目不愿承担月费
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
*Last updated: 2026-05-10 after initialization*
