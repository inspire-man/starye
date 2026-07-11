---
phase: 05-migration
plan: 04
subsystem: frontend-observability-and-ops
tags: [sentry, vue, nuxt, runbook, uat]
requirements-completed:
  - OBS-02
  - OBS-05
  - DEPLOY-05
completed: 2026-05-13
---

# Phase 5 Plan 04 Summary

## Accomplishments

- `movie-app` / `comic-app` / `dashboard` 接入 `@sentry/vue`
- `blog` / `auth` 接入 `@sentry/nuxt`，并补 `sentry.client.config.ts` / `sentry.server.config.ts`
- 根 `RUNBOOK.md` 扩写为正式 deploy / rollback / migration / observability 运维手册
- 新建 `05-HUMAN-UAT.md`，把 deploy / rollback / migration / Sentry / crawler 告警核验收口为人工 checklist

## Verification

- `pnpm --filter @starye/movie-app exec vue-tsc --noEmit` 通过
- `pnpm --filter @starye/comic-app exec vue-tsc --noEmit` 通过
- `rg -n "@sentry/vue|@sentry/nuxt|Sentry" apps/movie-app apps/comic-app apps/dashboard apps/blog apps/auth`
- `rg -n "rollback|migration|Sentry|WAF|deploy" RUNBOOK.md`
- `rg -n "workflow_dispatch|rollback|Sentry|crawler|migration" .planning/phases/05-migration/05-HUMAN-UAT.md`

## Known Blockers

- `pnpm --filter blog exec nuxt typecheck` 在当前环境未报本轮 Sentry 配置错误
- `pnpm --filter starye-auth exec nuxt typecheck` 仍被既有 `radix-vue` 依赖缺失阻塞，不是本轮新增

## Notes

- RUNBOOK 继续保留并吸收了 Phase 2 的 WAF 与 `ADMIN_GITHUB_ID` 配置知识
- crawler 告警维持 GitHub Actions 默认邮件，不新增新告警渠道
