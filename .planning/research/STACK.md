# Technology Stack — v1 Gap Research

**Project:** Starye — 个人内容中台
**Researched:** 2026-05-11
**Scope:** 仅针对 v1 的 5 个缺口。已锁定的基础栈（Turborepo / pnpm / Cloudflare Workers+Pages / Hono / Vue 3+Nuxt 4 / D1+R2+KV / Drizzle / Better Auth / Puppeteer）不再调研，详见 `.planning/codebase/STACK.md`。
**Overall confidence:** HIGH

---

## Gap 1: Video Playback Stability on Cloudflare Edge

### 当前状况
- `apps/movie-app` 已用 `xgplayer` `^3.0.24`
- 视频文件在 R2 (`starye-media` bucket)，封面也在 R2
- `CONCERNS.md` 指出"偶尔播放出错"，未明确根因
- 过去踩过的坑：Stack Overflow 上有报告 Worker 代理 R2 视频流会导致 Android MediaPlayer 和 Safari 崩溃（源自 Worker proxy 层把 Range 请求吃掉、只返回完整 body）

### 推荐方案（按优先级）

| 选择 | 版本 | 用途 | 理由 |
|------|------|------|------|
| **R2 Custom Domain + Cloudflare CDN** | — | 视频字节传输主通道 | R2 绑自定义域名（如 `media.starye.org`），直接走 Cloudflare CDN 层，原生支持 Range，免费带宽，零 Worker 计费，最稳 |
| **R2 Cache Rules (edge cache)** | — | 缓存 200/206/304 响应 | `developers.cloudflare.com/cache/interaction-cloudflare-products/r2/` 指明 R2 可挂到 CDN 缓存规则（`cacheEverything: true`, `cacheTtlByStatus.200-299: 31556952`） |
| **xgplayer** | `^3.0.24`（保持） | 播放器 | 已有代码；支持原生 MP4 `<video>` + HLS 插件 |
| **签名 URL（仅敏感内容）** | `@aws-sdk/s3-request-presigner` `^3.1029.0`（已有） | 私有视频的短期访问令牌 | 单用户场景下，公开 bucket + obscure URL 已足够；只对成人/登录门控内容启 presign |

### 具体落地姿势

**主路径（推荐，MP4 直连）**：
```
movie-app <video src="https://media.starye.org/videos/<key>.mp4">
            ↓（浏览器自动发 Range: bytes=0-）
          Cloudflare CDN（命中缓存直接返 206）
            ↓（miss）
          R2 Custom Domain → R2 bucket（原生 Range 支持）
```

**不要做的事**（反模式）：
- ❌ **不要**在 Hono Worker 里 `env.BUCKET.get(key)` 然后把 body 塞进 `new Response()` 返回给视频标签。会遇到 3 类问题：
  1. Worker CPU time / subrequest 计费（每个 seek 一次请求）
  2. Range 头需要手动透传 + 手动返回 206 Partial Content + `Content-Range` header，写错就导致 Safari/Android 失败（参见 `https://stackoverflow.com/questions/73908883`）
  3. R2 free tier 的 Class B 操作（get）计费会被放大
- ❌ **不要**上 Cloudflare Stream。Stream 按分钟存储+分钟播放双重计费，对自用体量是浪费。预算约束（"维持在免费额度内"）不允许。
- ❌ **不要**首 v1 就上 HLS 转码。转码本身不是 Workers/Pages 能做的事（需要 ffmpeg 或 Stream），引入外部转码链对"部署可用"是负债。原始 MP4 + 浏览器内置 `<video>` 对单用户体量够用。

### 签名 URL（可选，分阶段）
已有代码：`apps/api/src/lib/r2.ts` 调 `getSignedUrl` 1 小时有效期。v1 保留给"成人内容 / 登录门控视频"使用，不铺开。

### Confidence: **HIGH**
依据：Cloudflare 官方 R2 + CDN 缓存规则文档、Workers cache-using-fetch 官方示例明确给出 `m4s|mp4|ts|mkv|webm` 正则 + `cacheTtlByStatus`。R2 从 2022-05-19 起原生支持 Range（Cloudflare changelog）。

---

## Gap 2: Comic Reading Progress Storage

### 问题
阅读进度：`{userId, comicId, chapterId, page, updatedAt}`，每用户每本漫画每翻页都可能写一次。

### 对比

| 维度 | D1 | KV | Durable Objects |
|------|-----|-----|-----|
| 写入一致性 | 强一致（同 region） | **最终一致（~60s TTL）** | 强一致 |
| 写入限额 | ~1000/s 每库 | Free tier 1000/day 写 | 无硬限 |
| 读取延迟 | 1-5ms 同 region | <5ms（热） / ~100ms（冷） | ~5-10ms |
| JOIN 能力 | ✅ SQL | ❌ key 查找 | ❌ |
| 已接入 | ✅ Drizzle ORM | ✅ gateway 缓存已用 | ❌（未使用） |
| 自用读写量估算 | <10 写/分钟 | <10 写/分钟 | — |

### 推荐：**D1 + Drizzle（单表 + 复合索引）**

**Schema（追加到 `packages/db/src/schema.ts`）**：
```ts
export const comicReadProgress = sqliteTable(
  'comic_read_progress',
  {
    userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
    comicId: text('comic_id').notNull(),
    chapterId: text('chapter_id').notNull(),
    page: integer('page').notNull().default(0),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.comicId] }),
    lastRead: index('idx_comic_progress_updated').on(t.userId, t.updatedAt),
  }),
)
```

### 理由
1. **最终一致性是硬伤**：KV 读缓存 TTL 60s，用户刚翻页立即返回漫画列表可能看到旧进度 —— 这是最容易被感知的 bug
2. **SQL JOIN 有用**：首页"继续阅读"需要 `comicReadProgress JOIN comic`，KV 做不到
3. **单用户体量 D1 完全够**：10 写/分钟 vs 1000 写/秒限额，6 个数量级余量
4. **与现有 Drizzle + migrations 流水线同构**，零新工具引入
5. **KV 写免费额度 1000/天**，一天翻页几百次就可能触顶；D1 写免费额度 5M 行/天

### NOT 做
- ❌ **不用 KV**：最终一致性 + 免费写额度太紧
- ❌ **不用 Durable Objects**：单用户场景每用户一个 DO 实例是过度架构；成本模型复杂
- ❌ **不在 localStorage 单独维护**：设备间无法同步；`CONCERNS.md` 已经指出 "Unsafe JSON Parsing" 和 "localStorage Size" 问题在 movie-app 出过事
- ⚠️ **可选**：前端加 IndexedDB 做乐观 UI（先本地后同步），但 v1 不做，D1 直接写延迟已经 <20ms

### Confidence: **HIGH**
依据：Cloudflare 官方 KV 文档明确 "eventually consistent, ~60s read cache"；D1 文档明确写限额；项目已有 Drizzle + 迁移链路。

---

## Gap 3: Better Auth 跨子应用会话共享

### 当前状况（从 `.planning/codebase/INTEGRATIONS.md`）
- `better-auth` `^1.6.2`（当前代码锁定版）
- 最新稳定：`better-auth@1.6.10`（2026-05-09 发布）
- 架构：`gateway.starye.org` 统一入口 → 按路径分发到 `/api` `/dashboard` `/movie` `/comic` `/blog` `/auth` `/tavern`
- 所有前端的 `baseURL = window.location.origin + '/api/auth'` → **实际所有流量同源（`starye.org`）**
- 现 cookie 配置：`sameSite: 'lax'`, `domain` 从 `WEB_URL` host 推导并 strip `www.`，`path: '/'`

### 关键洞察
**这个项目不是真正的跨子域名场景**。因为 gateway 把所有子应用都挂在 `starye.org` 同一个 host 下、不同 path，cookie 只要 `path: '/'` + `domain: starye.org` 就自动对所有子应用可见。**不需要 `crossSubDomainCookies` 插件**。

真正要解决的是：
1. **各子应用前端如何读取 session**（当前只有 dashboard 用 `better-auth/vue` 客户端，其他前端没接）
2. **SSR 场景下 session 传递**（blog/auth 是 Nuxt 4，SSR 时需要把 cookie 转发到 `/api/auth/get-session`）
3. **gateway 缓存对 `Set-Cookie` 的透传**（gateway cache middleware 可能污染 auth 响应）

### 推荐方案

| 组件 | 版本 | 用途 | 理由 |
|------|------|------|------|
| **better-auth** | `^1.6.10`（升级） | 认证核心 | 当前 1.6.2 过于保守；1.6.10 的 minor 没有 breaking change |
| **better-auth/vue** | 同上，sub-export | Vue SPA 客户端（dashboard/movie-app/comic-app） | 已有使用 |
| **better-auth/client** | 同上，sub-export | Nuxt SSR 侧（blog/auth）+ 浏览器 | Nuxt SSR 传 `Cookie` header 时用 `$fetch` 透传即可 |
| **`useSession` composable** | 项目内封装 | 三个 Vue SPA 共用 | 放到 `packages/ui` 或新建 `packages/auth-client` 让三端共享 |

### 落地要点（全链路）

1. **保持同源（通过 gateway）**：维持 `cookieDomain = 'starye.org'`（非 `.starye.org`，避免和 `api.starye.org` 第三方 cookie 冲突）。所有前端请求都经 `starye.org/api/auth/...`，**前端不要直连 `api.starye.org`**
2. **gateway cache middleware 显式排除 `/api/auth/*`**：cookie 对缓存是污染源。参照 `apps/gateway/src/cache-middleware.ts` 加白名单跳过
3. **Nuxt SSR session 获取**：
   ```ts
   // 在 server middleware / route middleware 里
   const cookie = useRequestHeaders(['cookie']).cookie
   const { data } = await $fetch('/api/auth/get-session', { headers: { cookie } })
   ```
4. **SPA 端统一 composable**：`useAuth()` 封装 `better-auth/vue` 的 `signIn.social({ provider: 'github' })`, `signOut()`, `useSession()`；三端共享，避免重复实现
5. **CORS / trustedOrigins 收敛**：`apps/api/src/config.ts` 的 `getAllowedOrigins` 目前有一堆 localhost 端口硬编码 —— 生产环境收敛到 `[WEB_URL]` 一个即可
6. **（可选）`secondaryStorage` 用 KV 加速 session 读**：
   - 价值：session 读命中率高，走 D1 每次 1-5ms，走 KV 热数据 <1ms
   - 代价：KV 写额度（登录/注销时写）；eventual consistency 可能让 signOut 生效延迟
   - **v1 判断：不做**。单用户读写量太小，D1 直读够快，这属于 premature optimization

### NOT 做
- ❌ **不加 `crossSubDomainCookies` 插件**：同源架构下多余
- ❌ **不迁到 `api.starye.org` 直连模式**：一旦跨域就触发 SameSite=None + third-party cookie 问题，Safari ITP 会每 7 天清 cookie
- ❌ **不用 Better Auth 的 `multiSession` 插件**：单用户不需要并行 session
- ❌ **不配 `OAuth Proxy` 插件**：只用 GitHub 一家，不需要

### Confidence: **HIGH**
依据：`better-auth` 官方 `concepts/cookies.mdx`、`integrations/hono.mdx`（Context7 拉取）、项目现有 `apps/api/src/lib/auth.ts` 配置。

---

## Gap 4: 轻量级错误监控 / 可观测性

### 对比

| 方案 | 成本（自用体量） | 接入工作量 | 能看到什么 | 适配度 |
|------|------|------|------|------|
| **@sentry/cloudflare** `10.52.0` | Free tier: 5K errors/月，够用 | 中（Worker + 前端共 6 个 app） | 堆栈 / 面包屑 / 用户 / source map / 性能 | ★★★★★ |
| **Cloudflare Workers Logs + Tail Workers** | 免费（含在 CF 账号内） | 低（API 已启用 `[observability.logs]`） | 原始日志 / invocation 级 | ★★★ |
| **Logpush to R2/外部** | 写 R2 免费，下游分析要自己搭 | 高 | 取决于下游 | ★★ |
| **自己搭（Grafana/Loki 等）** | VPS 月费 | 极高 | 全可控 | ★（违反预算约束） |

### 推荐：**@sentry/cloudflare 10.52.0 + 保留 CF Workers 原生 Logs**

二者互补：
- **Sentry**：异常 / 错误聚合 / 告警（前端 + 后端一套 DSN）
- **CF Logs**：debug 级日志（已开，`persist = true`，保持不动）

### 具体库版本与装法

| Package | 版本 | 安装在哪 | 理由 |
|---------|------|---------|------|
| `@sentry/cloudflare` | `^10.52.0`（2026-05-08 发布） | `apps/api`, `apps/gateway` | Worker runtime 专用，官方维护，支持 Hono `honoIntegration` |
| `@sentry/vue` | `^10.52.0` | `apps/dashboard`, `apps/movie-app`, `apps/comic-app`, `apps/auth`（Nuxt 用 vue variant） | Vue 3 前端 errorHandler 自动接管 |
| `@sentry/nuxt` | `^10.52.0` | `apps/blog`（Nuxt 4） | Nuxt 有专门集成 |

### 接入要点

1. **API（Hono on Workers）**：
   ```ts
   import * as Sentry from '@sentry/cloudflare'
   export default Sentry.withSentry(
     (env) => ({
       dsn: env.SENTRY_DSN,
       tracesSampleRate: 0.1,
       integrations: [Sentry.honoIntegration()],
     }),
     app, // Hono app
   )
   ```
   注意：`@hono/sentry`（toucan-js 版）**已被官方标记 deprecated**，不要用（Sentry docs 明确说明）。

2. **前端（Vue SPA）**：在 `main.ts` 初始化；捕获 `app.config.errorHandler` + `window.onunhandledrejection`（dashboard 已有这两个 handler，替换成 Sentry 即可）

3. **DSN 管理**：
   - 建一个 Sentry 项目，多个 app 共用同一 DSN，通过 `tags: { app: 'movie-app' }` 区分
   - Worker 侧放 Worker Secret；前端放 Pages 环境变量（DSN 暴露给客户端是安全的）

4. **Source map 上传**：Sentry Vite plugin / Nuxt module 自动处理，CI 需要加 `SENTRY_AUTH_TOKEN`

5. **告警**：Sentry Alert Rules 里配 "超过 10 次/分钟" → 发邮件即可。**不要**接 Discord Webhook（`CLAUDLE.md` 里的 TODO） —— 可以但 v1 邮件更简单。

### NOT 做
- ❌ **不用 `@hono/sentry`**：官方已 deprecated
- ❌ **不用 `toucan-js` 直接写**：Sentry 官方 SDK 10.x 已完全替代
- ❌ **不搭自建 Prometheus/Grafana**：违反预算和 "不崩" 的优先级
- ❌ **不做完整 APM/Tracing**：免费额度做不到，tracesSampleRate 设 0.1 采样即可
- ❌ **不加 Logpush 到 R2**：暂时没有下游分析工具消费这些日志，先开 Sentry 就够

### Confidence: **HIGH**
依据：`@sentry/cloudflare` npm 10.52.0 元数据、Sentry 官方 Hono 集成文档、`@hono/sentry` deprecation 声明。

---

## Gap 5: 一键部署 / 回滚

### 当前状况（从 `.planning/codebase/INTEGRATIONS.md`）
- 已有每个 app 一个 workflow：`deploy-api.yml`, `deploy-gateway.yml`, `deploy-dashboard.yml`, `deploy-blog.yml`, `deploy-movie.yml`, `deploy-comic.yml`, `deploy-auth.yml`, `deploy-migrations.yml`
- 用 `wrangler ^4.81.1`（最新 `4.90.0`，建议升一下但不强制）
- `.github/workflows/` 目录已有完整 CI + 独立 deploy

### 推荐方案：**现有 GitHub Actions + wrangler 增强 + 分级回滚**

不重建 CI，增强现有的：

| 组件 | 版本 | 用途 | 理由 |
|------|------|------|------|
| **wrangler** | `^4.90.0`（升级） | Workers + Pages 部署与回滚 | 现有 4.81.1 → 4.90.0 为 patch，低风险 |
| **cloudflare/wrangler-action** | `v3`（pin 到具体 sha） | GitHub Actions 中调 wrangler | 官方维护，处理 token 和缓存 |
| **`wrangler rollback [VERSION_ID]`** | — | Workers（api/gateway）一键回滚 | CF 官方命令，秒级生效 |
| **Cloudflare Pages rollback**（Dashboard UI 或 API） | — | Pages（dashboard/movie/comic/blog/auth/tavern）回滚 | `pages/projects/{name}/deployments/{id}/rollback` API |

### 落地要点

#### 部署侧

1. **保留 per-app workflow**：文件变动触发（`paths: apps/api/**`）只部署对应服务
2. **加 `deploy-all.yml`（可选）**：`workflow_dispatch` 手动触发，顺序部 migrations → api → gateway → 各前端
3. **`wrangler versions upload` + `wrangler versions deploy` 渐进发布**（仅 api/gateway）：
   ```yaml
   - run: pnpm wrangler versions upload
   - run: pnpm wrangler versions deploy --percentage=100 --yes
   ```
   好处：版本号可见，回滚锚点清晰。v1 不上 canary / 灰度（单用户不需要），但 `versions upload` 是 `wrangler rollback` 的前置。

#### 回滚侧

1. **Workers 回滚**（api, gateway）：
   ```bash
   # 查询最近版本
   pnpm wrangler deployments list --name starye-api
   # 回滚到指定版本
   pnpm wrangler rollback <VERSION_ID> --name starye-api --message "emergency rollback"
   ```
   加一个 `rollback.yml` workflow 接受 `app_name` + `version_id` 两个 input 做 `workflow_dispatch`

2. **Pages 回滚**（所有 Pages apps）：Cloudflare Dashboard → Pages → `starye-movie` → Deployments → 旧版本右侧三点菜单 → **Rollback**。API 也可以：
   ```bash
   curl -X POST "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT/pages/projects/$PROJECT/deployments/$DEPLOY_ID/rollback" \
     -H "Authorization: Bearer $CF_TOKEN"
   ```
   注意：**只能回滚到 production 分支的成功构建**（官方限制）

3. **D1 migrations 回滚**：Drizzle 不支持自动 down migration。v1 的保底手段：
   - 加 `deploy-migrations.yml` 之前先 `wrangler d1 export starye-db --remote --output=backup-$(date).sql`
   - 出事时手动 restore（或写反向 SQL 补丁）
   - **这是 v1 的已知脆弱点**。接受它，不在 v1 引入 Drizzle 的实验性 down migration 或第三方工具

### 推荐新增 workflow：`rollback.yml`
```yaml
name: Emergency Rollback
on:
  workflow_dispatch:
    inputs:
      app:
        type: choice
        options: [api, gateway]  # Pages 走 Dashboard
      version_id:
        type: string
        required: true
jobs:
  rollback:
    runs-on: ubuntu-latest
    steps:
      - uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          command: rollback ${{ inputs.version_id }} --name starye-${{ inputs.app }} --message "workflow rollback"
```

### NOT 做
- ❌ **不上 Cloudflare Deploy Hooks**：只是 webhook 触发器，不替代 rollback 能力
- ❌ **不引入 Octokit 脚本 / 自建 CD 工具链**：现有 wrangler-action 就够
- ❌ **不做 blue-green / 影子流量**：单用户没意义
- ❌ **不上自动化回滚（基于 Sentry error rate 触发）**：可做但 v1 不做；手动 `workflow_dispatch` 已足够 MTTR
- ❌ **不用 Dangerfile / 部署门控 bot**：自用项目，作者一个人就是 reviewer
- ⚠️ **Pages 不支持 `wrangler rollback` 命令**（2026-05 当前）。Pages 回滚只能通过 Dashboard UI 或 REST API，别在 workflow 里写 `wrangler rollback` 对 Pages 项目 —— 会报错。

### Confidence: **HIGH**
依据：Cloudflare `wrangler rollback` 官方文档（Context7 拉取）、Pages API rollback 端点文档、项目现有 workflow 目录。

---

## 推荐新增依赖汇总（v1 落地清单）

```jsonc
// apps/api/package.json
{
  "dependencies": {
    "@sentry/cloudflare": "^10.52.0"  // +新增
  }
}

// apps/gateway/package.json
{
  "dependencies": {
    "@sentry/cloudflare": "^10.52.0"  // +新增
  }
}

// apps/dashboard, apps/movie-app, apps/comic-app, apps/auth
{
  "dependencies": {
    "@sentry/vue": "^10.52.0"  // +新增
  }
}

// apps/blog
{
  "dependencies": {
    "@sentry/nuxt": "^10.52.0"  // +新增
  }
}

// 根 devDependency 升级
{
  "devDependencies": {
    "wrangler": "^4.90.0"  // 从 4.81.1 升（patch 级升级）
  }
}

// 根 dependencies 升级
{
  "dependencies": {
    "better-auth": "^1.6.10"  // 从 1.6.2 升（minor 级，对齐最新 minor）
  }
}
```

**不新增**（反模式）：
- 视频播放不引入 `hls.js`、`video.js`、`shaka-player`（xgplayer 已够）
- 进度存储不引入新 ORM / 新存储（D1 + Drizzle 已够）
- 认证不加 `better-auth-cloudflare` 第三方包（原生配置已够，0.3.0 的实验品风险不值）
- 监控不加 `@hono/sentry`（已 deprecated）、不加 `pino`（console.log 够小场景用）
- 部署不加 `@octokit/*`、不加自建脚本

---

## 置信度汇总

| Area | Confidence | Reason |
|------|-----------|--------|
| Gap 1: 视频播放 | HIGH | R2+CDN 是 CF 官方推荐路径，有明确文档和缓存规则示例；反模式（Worker proxy）也有 SO 案例佐证 |
| Gap 2: 阅读进度 | HIGH | KV 最终一致性 + 写限额是官方明确声明的硬约束；D1 + Drizzle 是项目现状的自然延伸 |
| Gap 3: Better Auth 会话 | HIGH | 官方 cookies.mdx 覆盖全部场景；项目 gateway 架构让这事比一般跨子域简单 |
| Gap 4: 可观测性 | HIGH | `@sentry/cloudflare` 10.52.0 元数据已核实；`@hono/sentry` deprecation 有官方声明 |
| Gap 5: 部署/回滚 | HIGH | `wrangler rollback` 官方命令；Pages rollback API 有明确端点；现有 workflows 够用 |

## 已知不确定点 / Open Questions

1. **视频具体"偶尔出错"的根因**：`CONCERNS.md` 没指明是播放器错、网络错、还是 R2 错。推荐方案（R2 custom domain）对所有三类根因都是改善，但首次切换后要观察 Sentry 错误率下降曲线确认。
2. **gateway cache middleware 对 `Set-Cookie` 的行为**：需要看 `apps/gateway/src/cache-middleware.ts` 确认是否已经跳过 `/api/auth/*`。Gap 3 的推荐成立，前提是它跳过了；如果没跳过，要先修 gateway。这是 v1 实施前必须核实的 1 个细节。
3. **Sentry free tier 5K/月够不够**：取决于作者个人使用强度。单用户预估 <500 错误/月，5K 余量大。但新接入 source map 后初期"有噪"，留意第一周额度。

---

*Stack research for v1 gaps: 2026-05-11*
