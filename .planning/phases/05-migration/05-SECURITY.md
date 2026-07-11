---
phase: 05
slug: migration
status: verified
threats_open: 0
asvs_level: 1
created: 2026-05-13
---

# Phase 05 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| GitHub Actions -> Cloudflare Workers / Pages / D1 | deploy、rollback、migration workflow 直接触达生产控制面 | `CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID`、Worker version、D1 远程 schema |
| Operator -> rollback workflow | 人工输入 `app` / `version_id` 决定生产回退目标 | Worker app 标识、目标版本号 |
| GitHub PR / reviewer -> migration gate | reviewer ack 是 destructive schema 变更进入生产前的最后人工边界 | SQL diff、protected environment approval |
| Worker / Browser runtime -> Sentry | Worker 错误、video failure message、前端异常会发往外部观测平台 | error message、route、source context、user-agent |
| Human operator -> RUNBOOK | deploy / rollback / migration / observability 的人工响应依赖 RUNBOOK 的准确性 | 手工操作步骤、恢复路径、事故响应顺序 |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-05-01 | Tampering | `.github/workflows/rollback.yml` workflow_dispatch inputs | mitigate | `app` 使用 choice 枚举，`version_id` 显式输入；workflow 在日志中输出目标 app/version_id，Worker 与 Pages 路径明确分流。 | closed |
| T-05-02 | Denial of Service | inconsistent wrangler capabilities across root/api/gateway | mitigate | root / `apps/api` / `apps/gateway` 的 `wrangler` floor 已统一到 `^4.90.0`，降低 deploy / rollback CLI 漂移风险。 | closed |
| T-05-03 | Repudiation | Pages rollback ambiguity | mitigate | `rollback.yml` 对 Pages 明确 fail-closed，并把人工回退职责交给 `RUNBOOK.md`，不伪装成自动 rollback。 | closed |
| T-05-04 | Repudiation | remote migration apply without backup | mitigate | `deploy-migrations.yml` 在 apply 前强制执行 `wrangler d1 export --remote --output=...`，先上传到 R2，再保留 backup artifact 副本。 | closed |
| T-05-05 | Tampering | destructive SQL lands silently | mitigate | `ci.yml` 和 `deploy-migrations.yml` 都检测 `DROP COLUMN` / `DROP TABLE` / `ALTER TABLE ... DROP`，并要求 `production-migration-review` reviewer ack。 | closed |
| T-05-06 | Denial of Service | failed migration leaves service unrecoverable | mitigate | `packages/db/MIGRATION.md` 与 `RUNBOOK.md` 明确 restore / time-travel / forward-fix 路径，并要求保留 R2 backup object key 与 artifact，禁止“自动逆迁移”幻想。 | closed |
| T-05-07 | Information Disclosure | Worker Sentry event payloads | mitigate | `apps/api/src/index.ts` / `apps/gateway/src/index.ts` 使用 `sendDefaultPii: false`，且 `beforeSend` 聚焦错误文本过滤，不主动附带 cookie/session。 | closed |
| T-05-08 | Denial of Service | Worker error noise flood | mitigate | Worker 入口统一 `beforeSend` 过滤 `AbortError` / `NetworkError` / timeout / fetch failure 等首轮噪音。 | closed |
| T-05-09 | Repudiation | playback failure invisible in production | mitigate | `apps/movie-app/src/views/Player.vue` 在统一错误路径调用 `Sentry.captureMessage('video failure: ...')`，让非 crash 播放失败可追踪。 | closed |
| T-05-10 | Information Disclosure | frontend telemetry payloads | mitigate | 前端入口统一接入 Sentry，配置 `sendDefaultPii: false`；UAT 已确认事件进入项目且不带 cookie / session 等敏感字段。 | closed |
| T-05-11 | Repudiation | undocumented manual ops during incident | mitigate | 根 `RUNBOOK.md` 已成为唯一正式运维手册，收口 deploy / rollback / migration / WAF / observability 人工路径。 | closed |
| T-05-12 | Availability | operator confusion during production incident | mitigate | `05-HUMAN-UAT.md` 将 deploy、rollback、migration、Sentry、crawler failure path 收口成显式 checklist，且 10/10 已通过。 | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

No accepted risks.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-05-13 | 12 | 12 | 0 | Codex (`$gsd-secure-phase 5`) |
| 2026-05-14 | 12 | 12 | 0 | Codex (`$gsd-validate-phase 5`) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-05-13
