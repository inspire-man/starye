# Starye RUNBOOK

单一正式运维手册。覆盖 Cloudflare Workers / Pages / D1 / GitHub Actions 的生产部署、回滚、迁移安全、可观测性和常见故障处理。

---

## 1. 运维入口总览

### 1.1 生产入口

| Surface | Production URL | Deploy Path | Rollback Path |
|---------|----------------|-------------|---------------|
| gateway | `https://starye.org` | `.github/workflows/deploy-gateway.yml` | `.github/workflows/rollback.yml` |
| api | `https://api.starye.org` | `.github/workflows/deploy-api.yml` | `.github/workflows/rollback.yml` |
| auth | `https://starye.org/auth/login` | `.github/workflows/deploy-auth.yml` | Cloudflare Pages deployment history |
| blog | `https://starye.org/blog/` | `.github/workflows/deploy-blog.yml` | Cloudflare Pages deployment history |
| dashboard | `https://starye.org/dashboard/` | `.github/workflows/deploy-dashboard.yml` | Cloudflare Pages deployment history |
| movie | `https://starye.org/movie/` | `.github/workflows/deploy-movie.yml` | Cloudflare Pages deployment history |
| comic | `https://starye.org/comic/` | `.github/workflows/deploy-comic.yml` | Cloudflare Pages deployment history |
| d1 migrations | n/a | `.github/workflows/deploy-migrations.yml` | forward-fix + D1 restore |

### 1.2 关键 Secrets / 环境变量

- GitHub Actions:
  - `CLOUDFLARE_API_TOKEN`
  - `CLOUDFLARE_ACCOUNT_ID`
  - `API_URL`
  - `CRAWLER_SECRET`
  - `R2_ACCESS_KEY_ID`
  - `R2_SECRET_ACCESS_KEY`
  - `R2_BUCKET_NAME`
  - `R2_PUBLIC_URL`
- Workers / Pages:
  - `ADMIN_GITHUB_ID`
  - `SENTRY_DSN`
  - `SENTRY_RELEASE`（Workers 可选）
  - `NUXT_PUBLIC_SENTRY_DSN`（Nuxt 可选，若不直接复用 `SENTRY_DSN`）
  - `VITE_SENTRY_DSN`（Vue apps）

### 1.3 本地验证入口

- 所有本地浏览器验证统一经由 Gateway：
  - `http://localhost:8080/dashboard/`
  - `http://localhost:8080/blog/`
  - `http://localhost:8080/movie/`
  - `http://localhost:8080/comic/`
  - `http://localhost:8080/auth/login`

---

## 2. Deploy 流程

### 2.1 日常 deploy 规则

- 现状保持双入口：
  - `push -> main` 自动部署
  - `workflow_dispatch` 手动补发
- Worker 与 Pages 保持独立 workflow，不合并成大一统流水线。
- `wrangler` 版本基线统一为 `^4.90.0` 以上。

### 2.2 手动触发 deploy

1. 打开 GitHub Actions。
2. 选择目标 workflow：
   - `deploy-api.yml`
   - `deploy-gateway.yml`
   - `deploy-auth.yml`
   - `deploy-blog.yml`
   - `deploy-dashboard.yml`
   - `deploy-movie.yml`
   - `deploy-comic.yml`
3. 点击 `Run workflow`。
4. 等待 workflow 成功。
5. 对应访问以下 smoke URL：
   - gateway: `https://starye.org`
   - api health: `https://starye.org/api/health`
   - auth: `https://starye.org/auth/login`
   - blog: `https://starye.org/blog/`
   - dashboard: `https://starye.org/dashboard/`
   - movie: `https://starye.org/movie/`
   - comic: `https://starye.org/comic/`

### 2.3 Deploy 后最低 smoke checklist

- API 返回 200：`GET /api/health`
- gateway 根路由会 301 到 `/blog/`
- dashboard 未登录仍跳 `/auth/login?next=...`
- movie/comic 至少能打开首页，不出现白屏
- auth/blog 能正常返回 HTML

---

## 3. Rollback 流程

### 3.1 Worker 回滚

适用：
- `api`
- `gateway`

统一入口：
- `.github/workflows/rollback.yml`

输入：
- `app`
- `version_id`

行为：
- `api` -> `wrangler rollback <version_id> --name starye-api`
- `gateway` -> `wrangler rollback <version_id> --name starye-gateway`

操作步骤：

1. 在 Cloudflare Worker Versions 页面或之前 deploy 记录中找到目标 `version_id`。
2. 打开 GitHub Actions -> `Rollback Deployment`。
3. 输入：
   - `app=api` 或 `gateway`
   - `version_id=<目标版本>`
4. 运行 workflow。
5. 验证：
   - `api`: `https://starye.org/api/health`
   - `gateway`: `https://starye.org/blog/`、`/auth/login`、`/movie/`、`/comic/`

### 3.2 Pages 回滚

适用：
- `auth`
- `blog`
- `dashboard`
- `movie`
- `comic`

当前策略：
- workflow 明确 fail-closed，不伪装成自动回滚。
- 实际回退走 Cloudflare Pages deployment history。

操作步骤：

1. 打开对应 Pages 项目：
   - `starye-auth`
   - `blog-pages`
   - `starye-dashboard`
   - `starye-movie`
   - `starye-comic`
2. 进入 Deployments。
3. 找到上一条稳定 deployment。
4. 使用 Cloudflare Pages 控制台的 rollback / promote 上一版本能力执行回退。
5. 验证对应 `https://starye.org/<app>/` 可用。

### 3.3 回滚优先级

1. 先回滚最外层入口故障：
   - `gateway`
2. 再回滚核心请求链路：
   - `api`
3. 最后回滚单个前端：
   - `auth/blog/dashboard/movie/comic`

---

## 4. D1 Migration Safety

### 4.1 标准顺序

生产 migration 必须严格遵循：

1. 检查本次 SQL 是否包含 destructive 语句
2. 如命中 destructive 模式，先完成 reviewer ack
3. 在远程 apply 前执行：
   - `wrangler d1 export starye-db --remote --output=<backup.sql>`
4. 上传 backup 到 R2：
   - `wrangler r2 object put <bucket>/ops/d1-backups/<backup.sql> --file=<backup.sql> --remote`
5. 上传 backup artifact 副本
6. 再执行：
   - `wrangler d1 migrations apply starye-db --remote`
7. apply 后立即做 smoke query / 业务 smoke

### 4.2 Dangerous SQL Gate

当前 gate 覆盖：

- `DROP COLUMN`
- `DROP TABLE`
- `ALTER TABLE ... DROP`

触发路径：

- `ci.yml`：检测本次 diff 是否包含危险 SQL
- `deploy-migrations.yml`：若命中，则进入 `production-migration-review` protected environment，需要 reviewer ack

### 4.3 备份与恢复

当前 workflow 行为：

- backup 在 apply 前导出为 SQL，并上传到 R2
- 同一份 SQL 额外保留为 GitHub Actions artifact
- artifact 保留 14 天
- 文件名格式：
  - `starye-db-<run_id>-<run_attempt>.sql`

恢复原则：

- 不做自动逆迁移
- 优先使用 Cloudflare D1 原生 restore / time-travel 能力恢复到最近健康点
- 结构问题优先 forward-fix 新 migration
- 导出的 SQL 备份（R2 object + artifact 副本）用作审计与兜底恢复材料

### 4.4 恢复路径

首选：

1. 在 Cloudflare D1 控制台确认故障时间点
2. 使用 `wrangler d1 time-travel restore` 或 Cloudflare 控制台对应恢复能力回到健康点
3. 重新验证：
   - schema 存在性
   - 关键表行数
   - 应用 smoke

次选：

1. 下载 workflow 导出的 SQL artifact
2. 如需交叉核对，确认 R2 中存在对应 `ops/d1-backups/...sql` 对象
3. 在隔离环境确认 SQL 内容
4. 通过 D1 手动恢复路径执行回灌或重建
5. 重新补 forward-fix migration

### 4.5 Migration Smoke

每次关键 schema 变更后至少确认：

- 目标新表/新列存在
- 旧表/旧索引是否按预期退场
- API 启动和基础 query 不报错
- 前台关键路径能读写新 schema

---

## 5. Observability

### 5.1 Sentry 接入矩阵

| Surface | SDK | 接入位置 |
|---------|-----|----------|
| api | `@sentry/cloudflare` | `apps/api/src/index.ts` |
| gateway | `@sentry/cloudflare` | `apps/gateway/src/index.ts` |
| movie | `@sentry/vue` | `apps/movie-app/src/main.ts` + `Player.vue` |
| comic | `@sentry/vue` | `apps/comic-app/src/main.ts` |
| dashboard | `@sentry/vue` | `apps/dashboard/src/main.ts` |
| blog | `@sentry/nuxt` | `apps/blog/nuxt.config.ts` + `sentry.client/server.config.ts` |
| auth | `@sentry/nuxt` | `apps/auth/nuxt.config.ts` + `sentry.client/server.config.ts` |

### 5.2 首轮噪音过滤

Worker `beforeSend` 第一轮过滤目标：

- `AbortError`
- `NetworkError`
- `Failed to fetch`
- `request timed out`
- 用户主动中止或离线类请求噪音

### 5.3 Video Failure Contract

`movie-app` 的播放器错误不上抛 crash，改为 message/event 级观测，至少带：

- `error.kind`
- `playback.mode`
- `movieCode`
- `movieTitle`
- `sourceUrl`
- `streamUrl`（若为 TorrServer 模式）
- `userAgent`
- `route`

### 5.4 生产事件 smoke

至少做以下 3 类：

1. Worker error:
   - 人为触发一条 5xx 或 proxy failure
2. Video failure:
   - 触发一个无效播放源 / 缓冲失败
3. Frontend exception:
   - 人为触发一个页面异常或 Promise rejection

验收标准：

- 事件进入同一 Sentry 项目
- 不包含 cookie / session token 等敏感信息
- 已知网络中止噪音不过量堆积

---

## 6. Crawler 告警

当前策略：

- 保持 GitHub Actions 默认失败邮件提醒
- 不新增 Slack / Discord / Telegram

现有 crawler workflows：

- `daily-movie-crawl.yml`
- `daily-manga-crawl.yml`
- `daily-actor-crawl.yml`
- `daily-publisher-crawl.yml`

运维动作：

1. 失败时先看对应 workflow run
2. 下载 artifact：
   - `crawler-logs-*`
   - `actor-crawler-logs-*`
   - `publisher-crawler-logs-*`
3. 检查：
   - API health
   - `CRAWLER_SECRET`
   - R2 credentials
   - 目标源站可访问性

---

## 7. 常见故障处理

### 7.1 API / Gateway 故障

现象：
- `https://starye.org/api/health` 不通
- 前台全部 502 / 504

处理顺序：

1. 看 `deploy-api` / `deploy-gateway` 最近 run
2. 若是最近 deploy 引入故障，先 rollback 对应 Worker
3. 检查 Cloudflare logs / traces
4. 再决定是否 forward-fix

### 7.2 Pages 单应用白屏

现象：
- 只有某一前端白屏，其他 app 正常

处理顺序：

1. 查对应 `deploy-*.yml`
2. 在 Pages deployment history 回退上一条稳定 deployment
3. 确认 gateway 路由未改坏

### 7.3 D1 Migration 失败

现象：
- migration workflow 失败
- API 启动后 schema/query 报错

处理顺序：

1. 不继续重复 apply
2. 保存失败 run 的 backup artifact 信息
3. 判断是否需要 D1 restore / time-travel
4. 用 forward-fix migration 修补

### 7.4 Sentry 没事件

检查顺序：

1. DSN 是否已配置到对应 app
2. Worker / Pages 是否已重新部署
3. `beforeSend` 是否把事件过滤掉
4. 浏览器 devtools / worker logs 是否确实触发错误

### 7.5 WAF / 登录受阻

先看：

- Cloudflare WAF rule
- `/api/auth/sign-in` 速率限制是否误伤
- `ADMIN_GITHUB_ID` 是否缺失或配置错误

---

## 8. WAF Rate Limiting 手配记录

**需求：** PUBSEC-03 — `/api/auth/sign-in` 限制 10 req/min/IP

**配置位置：** Cloudflare Dashboard → Security → WAF → Rate Limiting Rules

**规则配置：**

| 字段 | 值 |
|------|-----|
| 规则名 | `starye-signin-ratelimit` |
| 匹配条件 | URI Path equals `/api/auth/sign-in` AND Request Method equals `POST` |
| 阈值 | 10 requests per 1 minute per IP |
| 动作 | Block（返回 429 Too Many Requests） |
| 响应码 | 429 |
| 适用范围 | starye.org（主域名） |

**配置步骤：**

1. 登录 Cloudflare Dashboard → 选择 `starye.org` 域名
2. 进入 Security → WAF → Rate Limiting Rules
3. 点击 "Create rule"
4. 填写规则名：`starye-signin-ratelimit`
5. 在 "When incoming requests match..." 设置：
   - Field: URI Path，Operator: equals，Value: `/api/auth/sign-in`
   - 点击 "And"，Field: Request Method，Operator: equals，Value: `POST`
6. 在 "Rate limit" 设置：Requests: 10，Period: 1 minute，Characteristics: IP
7. 在 "Then take action..." 选择：Block
8. 保存规则

**验证方式：**

```bash
for i in $(seq 1 11); do
  curl -s -o /dev/null -w "%{http_code}\n" \
    -X POST https://starye.org/api/auth/sign-in \
    -H "Content-Type: application/json" \
    -d '{"email":"test@test.com","password":"wrong"}'
done
```

**配置日期：** _（配置完成后填写）_

**配置人：** _（填写）_

---

## 9. ADMIN_GITHUB_ID 白名单配置

**需求：** D-03, D-04 — 使用 GitHub 数字 ID 作为硬编码白名单，覆盖 DB 中的 `user.role`，用于个人自用场景。

**配置位置：** Cloudflare Workers → API Worker / Gateway Worker → Settings → Variables & Secrets

**步骤：**

1. 找到 GitHub 数字 ID
2. 在 API Worker 添加 Secret：
   - `ADMIN_GITHUB_ID`
3. 在 Gateway Worker 添加 Secret：
   - `ADMIN_GITHUB_ID`

CLI 示例：

```bash
cd apps/api
wrangler secret put ADMIN_GITHUB_ID

cd ../gateway
wrangler secret put ADMIN_GITHUB_ID
```

**效果：**

- API：命中白名单 session 通过 admin guard
- Gateway：命中白名单 session 可进入 `/dashboard/*`

**配置日期：** _（配置完成后填写）_

**配置人：** _（填写）_
