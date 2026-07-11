---
status: complete
phase: 05-migration
source: [05-VALIDATION.md]
started: 2026-05-13
updated: 2026-05-13T12:52:00+08:00
---

## Current Test

[testing complete]

## Tests

### 1. 手动触发 Worker deploy
expected: 手动运行 `deploy-api.yml` 或 `deploy-gateway.yml` 后，`workflow_dispatch` 成功，`https://starye.org/api/health` 与主页路由可访问。
result: pass

### 2. 手动触发 Pages deploy
expected: 手动运行任一 `deploy-auth/blog/dashboard/movie/comic.yml` 后，对应正式入口返回正常页面，不白屏、不 404；其中 auth 的正式入口为 `https://starye.org/auth/login`。
result: pass

### 3. Worker rollback
expected: 在 `rollback.yml` 输入 `app=api|gateway` + 有效 `version_id` 后，workflow 成功，服务 1 分钟内恢复到目标版本。
result: pass

### 4. Pages rollback fail-closed
expected: 在 `rollback.yml` 输入 `app=movie|comic|blog|auth|dashboard` 时，workflow 不尝试伪自动 rollback，而是明确失败并提示按 RUNBOOK 手动回退。
result: pass

### 5. Migration backup-before-apply
expected: 运行 `deploy-migrations.yml` 时，先生成 `d1-backup-*` artifact，再执行 `wrangler d1 migrations apply`。
result: pass

### 6. Destructive migration reviewer ack gate
expected: 构造包含 `DROP COLUMN` / `DROP TABLE` 的 migration diff 后，CI 不会静默放行；需要 `production-migration-review` reviewer ack 后才能继续执行 migration workflow。
result: pass

### 7. Worker Sentry event
expected: 人为触发一条 API 5xx 或 gateway proxy failure 后，Sentry 收到 Worker 事件；`AbortError` / `NetworkError` 噪音不过量涌入。
result: pass

### 8. Video failure message event
expected: 在 `http://localhost:8080/movie/.../play` 制造无效源或超时后，Player 仍显示原有错误卡片，同时 Sentry 收到 `video failure: <kind> - <message>` message 事件，字段包含 source context / user-agent。
result: pass

### 9. Frontend Sentry event
expected: 在 `movie/comic/dashboard/blog/auth` 任一端人为触发前端异常后，Sentry 收到对应前端事件，且不带 cookie / session 等敏感字段。
result: pass

### 10. Crawler failure alert path
expected: 任一 `daily-*-crawl.yml` 失败时，沿用 GitHub Actions 默认邮件通知路径；无需额外 Slack/Discord 集成。
result: pass

## Summary

total: 10
passed: 10
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none yet]

## Validation Addendum 2026-05-14

- `DEPLOY-03` 在 validation audit 中发现实现与 requirement 漂移：原 workflow 只保留 GitHub artifact，未把 D1 backup 上传到 R2。
- 已补齐 `.github/workflows/deploy-migrations.yml` 的 R2 上传步骤。
- 需要在下一次真实 `deploy-migrations.yml` 运行时，重新执行第 5 项，额外确认：
  - R2 中存在 `ops/d1-backups/starye-db-<run_id>-<run_attempt>.sql`
  - GitHub artifact 副本仍可下载
