---
phase: 02-dashboard
plan: 06
subsystem: infra
tags: [cloudflare-pages, waf, redirects, _redirects, runbook]

requires:
  - phase: 02-dashboard
    provides: API 白名单（02-02）、Gateway dashboard-guard（02-03）已就位；pages.dev 直链需要 301 回 starye.org 以强制走 Gateway
provides:
  - 5 个 Pages 应用的 _redirects 统一添加 *.pages.dev → starye.org/<app>/ 301! 规则（D-16）
  - RUNBOOK.md 新建，记录 WAF Rate Limiting 手配步骤（PUBSEC-03）和 ADMIN_GITHUB_ID 白名单 secret 配置步骤（D-03/D-04）
  - 人工 checkpoint 已通过：代码和文档交付正确，Cloudflare Dashboard 的 WAF 规则与 secret 配置延后到部署阶段执行
affects: [deploy, auth, dashboard, public-routes]

tech-stack:
  added: []
  patterns:
    - "Cloudflare Pages _redirects 语法：301! 强制重定向，顺序 在 SPA fallback 之前"
    - "RUNBOOK.md 集中记录所有需要在 Cloudflare Dashboard 手配的项目（WAF/secret/DNS）"

key-files:
  created:
    - apps/auth/public/_redirects
    - RUNBOOK.md
    - .planning/phases/02-dashboard/02-06-SUMMARY.md
  modified:
    - apps/movie-app/public/_redirects
    - apps/comic-app/public/_redirects
    - apps/dashboard/public/_redirects
    - apps/blog/public/_redirects

key-decisions:
  - "tavern app 目录不存在（PLAN 已预计），本次跳过；若将来创建需补同款规则"
  - "RUNBOOK.md 同时收录 ADMIN_GITHUB_ID secret 配置，避免散落在多处文档"
  - "WAF 规则本身不在本 plan 配置（需登录 Cloudflare Dashboard 手动操作），用户确认『代码和文档交付正确』后延后执行"

patterns-established:
  - "Pattern: 多 Pages app 的 301! 规则必须位于 `/* /index.html 200` 之前，否则 SPA fallback 会劫持"
  - "Pattern: user_setup 类 plan 通过 RUNBOOK.md 沉淀配置步骤，不依赖临时记忆"

requirements-completed:
  - PUBSEC-03
  - PUBSEC-05

duration: 5min
completed: 2026-05-11
---

# Plan 02-06 Summary

**5 个 Pages 应用的 `_redirects` 统一加 `*.pages.dev` → `starye.org/<app>/` 301! 规则；新建 `RUNBOOK.md` 记录 WAF 限速和 ADMIN_GITHUB_ID secret 手配步骤**

## Performance

- **Duration:** ~5 min（纯文本改动 + 新建文件）
- **Started:** 2026-05-11
- **Completed:** 2026-05-11
- **Tasks:** 3（Task 1 redirects + Task 2 RUNBOOK + Task 3 人工 checkpoint）
- **Files modified:** 5（4 modified + 2 created，含 SUMMARY）

## Accomplishments

- 5 个 Pages 应用（movie / comic / dashboard / auth / blog）的 `_redirects` 文件统一包含 `*.pages.dev` 直链 301 回 `starye.org/<app>/` 的强制重定向，闭合 D-16 的 defense-in-depth 要求
- `apps/auth/public/_redirects` 之前不存在，本 plan 新建，和 Nuxt 4 build 的 `.output/public/` 结构兼容
- `RUNBOOK.md` 新建，同时收录 PUBSEC-03 的 WAF Rate Limiting 配置（`/api/auth/sign-in` 10 req/min/IP）和 ADMIN_GITHUB_ID 白名单 secret 在 API/Gateway 两处的 wrangler 配置步骤
- 人工 checkpoint 通过：用户确认代码与文档交付正确，WAF 本身的 Cloudflare Dashboard 操作延后到部署阶段

## Task Commits

1. **Task 1: 5 个 Pages 应用 `_redirects` 更新** — `326a2ff` feat(02-06): add pages.dev to starye.org 301 redirects for 5 apps (D-16)
2. **Task 2: 新建 `RUNBOOK.md`** — `feeced3` docs(02-06): add RUNBOOK.md with WAF rate-limit + ADMIN_GITHUB_ID config (D-18)
3. **Task 3: 人工 checkpoint** — 通过（Approved）

**Plan metadata:** 本 SUMMARY 文件提交（见下文）

## Files Created/Modified

- `apps/movie-app/public/_redirects` — 首行追加 `https://starye-movie.pages.dev/* https://starye.org/movie/:splat 301!`
- `apps/comic-app/public/_redirects` — 同上，`comic`
- `apps/dashboard/public/_redirects` — 同上，`dashboard`
- `apps/blog/public/_redirects` — 首行追加 blog 301! 规则，保留原 `/blog/*` 路径规则
- `apps/auth/public/_redirects` — **新建**，包含 auth 的 301! 规则 + SPA fallback
- `RUNBOOK.md` — **新建**，WAF Rate Limiting 手配记录段落 + ADMIN_GITHUB_ID 白名单配置段落

## Decisions Made

- **tavern 跳过**：`apps/tavern` 目录不存在（gateway wrangler.toml 虽声明 `TAVERN_ORIGIN` 但实际 app 未实现）。PLAN 已预计该情况，本 plan 不补 tavern 的 `_redirects`；将来创建 tavern 时在本模板基础上补一条即可
- **RUNBOOK 合并记录**：本可拆成 `RUNBOOK-waf.md` 和 `RUNBOOK-secrets.md`，但当前规模很小（作者一人自用），集中在单文件更实用；将来超过 200 行再考虑拆分
- **WAF 不在代码层配置**：WAF 是 Cloudflare 平台资源，只能通过 Dashboard 手配；本 plan 只记录步骤，实际配置交给运维阶段，通过 RUNBOOK.md 指引完成

## Deviations from Plan

None — 计划执行与写明一致。

## Issues Encountered

None — 无问题。

## User Setup Required

**外部服务需要手动配置。** 配置内容见 `RUNBOOK.md`：

- Cloudflare Dashboard → Security → WAF → Rate Limiting Rules 创建 `starye-signin-ratelimit` 规则（PUBSEC-03）
- `wrangler secret put ADMIN_GITHUB_ID` 分别在 `apps/api` 和 `apps/gateway` 目录执行（D-03/D-04）

Plan 本身不阻塞在此类配置上；部署前完成即可。

## Next Phase Readiness

- Phase 02 全部 6 个 plan 交付完毕
- API/Gateway 的白名单逻辑（02-02/02-03）已能读取 `ADMIN_GITHUB_ID`，只等部署时 secret 注入即可生效
- `_redirects` 规则在下一次 Pages 部署时自动生效（Cloudflare Pages 识别 `public/_redirects`）

---
*Phase: 02-dashboard*
*Completed: 2026-05-11*
