---
phase: 5
slug: migration
status: verified
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-13
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for deploy baseline, rollback, migration safety, and observability bootstrap.

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | GitHub Actions workflow validation + workspace type checks + targeted grep assertions |
| **Primary surfaces** | `.github/workflows/*.yml`, `package.json`, `wrangler.toml`, app bootstrap files, `RUNBOOK.md` |
| **Quick run command** | `pnpm type-check` |
| **Workflow validation style** | source assertion + dry-run review + human checklist |
| **Estimated runtime** | local static validation ~30-90s; real deploy / rollback / Sentry verification requires human/CI runs |

## Sampling Rate

- **After every task commit:** run the narrowest static validation first
- **After every plan wave:** rerun root type-check + grep assertions for touched workflows/config
- **Before `$gsd-verify-work 5`:** confirm workflow files exist, root RUNBOOK updated, and human deploy/rollback checklist prepared
- **Manual latency tolerance:** production deploy / rollback / Sentry smoke can exceed quick local loop and must be tracked explicitly

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Secure / Stable Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|--------------------------|-----------|-------------------|-------------|--------|
| V-05-01A | 05-01 | 1 | DEPLOY-01, DEPLOY-02, DEPLOY-06 | deploy baseline and rollback entrypoint exist, wrangler version meets floor | source assertion | `rg -n "\"wrangler\": \"\\^4\\.(9[0-9]|[1-9][0-9]{2,})" package.json apps/api/package.json apps/gateway/package.json && rg -n "workflow_dispatch|rollback" .github/workflows` | ✅ | ✅ green |
| V-05-01B | 05-01 | 1 | DEPLOY-01 | all app deploy workflows still target main and remain executable | source assertion | `Get-ChildItem .github/workflows/deploy-*.yml | ForEach-Object { rg -n "push:|branches:|workflow_dispatch|wrangler" $_.FullName }` | ✅ | ✅ green |
| V-05-02A | 05-02 | 2 | DEPLOY-03, DEPLOY-04 | migrations export remote backup before apply, mirror it to R2, retain artifact copy, and gate destructive changes | source assertion | `rg -n "d1 export|r2 object put|upload-artifact|migrations apply|DROP COLUMN|ack|review" .github/workflows/deploy-migrations.yml .github/workflows/ci.yml` | ✅ | ✅ green |
| V-05-03A | 05-03 | 2 | OBS-01, OBS-03 | api/gateway initialize Worker Sentry and filter AbortError/NetworkError/media-noise paths | source assertion | `rg -n "@sentry/cloudflare|honoIntegration|beforeSend|AbortError|NetworkError|sendDefaultPii" apps/api/src/index.ts apps/gateway/src/index.ts` | ✅ | ✅ green |
| V-05-03B | 05-03 | 2 | OBS-04 | Player video failures emit non-crash Sentry messages with source context | typecheck + grep | `pnpm --filter @starye/movie-app exec vue-tsc --noEmit && rg -n "captureMessage|video failure|userAgent|streamUrl|sourceUrl" apps/movie-app/src/views/Player.vue` | ✅ | ✅ green |
| V-05-04A | 05-04 | 3 | OBS-02, DEPLOY-05 | frontend apps initialize Sentry and RUNBOOK documents deploy/rollback/migration response paths | typecheck + source assertion | `pnpm --filter @starye/movie-app exec vue-tsc --noEmit && pnpm --filter @starye/comic-app exec vue-tsc --noEmit && pnpm --filter blog exec nuxt typecheck && rg -n "@sentry/vue|@sentry/nuxt|Sentry|rollback|migration|deploy" apps/movie-app apps/comic-app apps/dashboard apps/blog apps/auth RUNBOOK.md` | ✅ | ✅ green |
| V-05-04B | 05-04 | 3 | DEPLOY-01..06, OBS-01..05 | production-adjacent deploy/rollback/monitoring paths verified by human operator | human | see `05-HUMAN-UAT.md` addendum and verify-work checklist | ✅ | ✅ green |

## Wave 0 Requirements

- [x] Existing deploy/migration workflows identified
- [x] Existing RUNBOOK location identified
- [x] Existing observability baseline audited (Cloudflare logs/traces only; no Sentry yet)
- [x] Validation paths for deploy / rollback / migration / Sentry split into static vs. human checks

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 生产 deploy 后服务可用 | DEPLOY-01 | 需要真实 GitHub Actions + Cloudflare 环境 | 在 verify-work 阶段按 app 触发 workflow_dispatch 并检查目标 URL |
| rollback 真实回退到指定版本 | DEPLOY-02 | 依赖真实 Cloudflare versions / Pages deployment history | 使用 `rollback.yml` 或 RUNBOOK 手册在非高峰时验证 |
| migration 备份文件真实落到 R2 | DEPLOY-03 | 需要真实 remote D1 / R2 凭据 | 触发 migration workflow 后检查 R2 中存在 `ops/d1-backups/starye-db-<run_id>-<run_attempt>.sql`，并确认 GitHub artifact 副本仍可下载 |
| destructive migration gate 真正拦截 PR | DEPLOY-04 | 依赖 GitHub PR / reviewer path | 用演示分支构造危险 migration diff 验证 |
| Sentry 事件真实进入项目 | OBS-01..04 | 依赖真实 DSN / 网络 / source map | 触发一条 Worker error、一条 video message、一条 frontend exception |

## Validation Sign-Off

- [x] All planned work has an automated or source-assertable verification path
- [x] Manual-only production-adjacent behaviors are explicitly listed
- [x] Wave 0 dependencies are covered by existing repo structure
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** verified 2026-05-14

## Validation Audit 2026-05-14

| Metric | Count |
|--------|-------|
| Gaps found | 3 |
| Resolved | 3 |
| Escalated | 0 |

- Fixed `V-05-01B` so deploy workflow enumeration works in the current PowerShell environment.
- Reconciled `DEPLOY-03` with the canonical requirement by adding an R2 upload step to `.github/workflows/deploy-migrations.yml` while retaining the GitHub artifact copy.
- Split the former `V-05-03A` into Worker Sentry (`OBS-01/03`) and Player telemetry (`OBS-04`) checks, and aligned frontend verification with the actual runnable typecheck surfaces.
