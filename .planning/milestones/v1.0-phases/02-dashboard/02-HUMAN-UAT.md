---
status: complete
phase: 02-dashboard
source: [02-VERIFICATION.md]
started: 2026-05-11
updated: 2026-05-14T11:11:22.3665979+08:00
---

## Current Test

[testing complete]

## Tests

### 1. WAF Rate Limiting (PUBSEC-03)
expected: Cloudflare Dashboard → Security → WAF → Rate Limiting Rules 下存在 `starye-signin-ratelimit` 规则，匹配 `/api/auth/sign-in` POST，阈值 10 req/min/IP，动作 Block。用 `for i in $(seq 1 11); do curl -X POST https://starye.org/api/auth/sign-in ...; done` 验证第 11 次返回 429。验证后回填 `RUNBOOK.md` 的"配置日期/配置人"。
result: pass

### 2. ADMIN_GITHUB_ID secret 注入（D-03/D-04）
expected: `wrangler secret put ADMIN_GITHUB_ID` 分别在 `apps/api` 和 `apps/gateway` 执行，值为作者的 GitHub 数字 ID（从 `https://api.github.com/users/<username>` 获取）。浏览器三路验证：
  - 匿名访问 `https://starye.org/dashboard/` → 302 到 `/auth/login?next=...`
  - 用非白名单 GitHub 账号登录 → 登录页顶部显示"此账号没有管理员权限"（`error=not_admin`）
  - 用白名单账号登录 → 正常进入 dashboard 首页
result: pass

### 3. pages.dev 301 重定向（PUBSEC-05）
expected: 下一次 Pages 部署后，浏览器访问以下 URL 应 301 到 `starye.org/<app>/`：
  - `https://starye-movie.pages.dev/` → `https://starye.org/movie/`
  - `https://starye-comic.pages.dev/` → `https://starye.org/comic/`
  - `https://starye-dashboard.pages.dev/` → `https://starye.org/dashboard/`
  - `https://starye-auth.pages.dev/` → `https://starye.org/auth/login`
  - `https://starye-blog.pages.dev/` → `https://starye.org/blog/`
result: pass

### 4. `/api/docs` 生产鉴权（PUBSEC-04）
expected: 部署后匿名访问 `https://starye.org/api/docs` 和 `https://starye.org/api/openapi.json` 均返回 401；用白名单账号登录后同样路径返回 200（Scalar UI 正常加载）。
result: pass

### 5. Open redirect 回归（CR-01 修复验证，D-14）
expected: 访问 `https://starye.org/auth/login?next=%252F%252Fevil.com`，登录后浏览器应停留在 `starye.org`（而非跳转到 evil.com）。
result: pass

## Summary

total: 5
passed: 5
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
