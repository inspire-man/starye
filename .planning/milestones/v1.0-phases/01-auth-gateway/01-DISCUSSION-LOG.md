# Phase 1: Auth 全链路 + Gateway 缓存安全基线 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-11
**Phase:** 1-auth-gateway
**Areas discussed:** Cookie domain 与 SSR 通道, Gateway bypass 触发条件, 私有 scope cache key 构造, 登出跨端传播 & Better Auth 升级策略
**Areas noted but deferred:** 客户端 UI 风格统一（Phase 1 无 UI 交付，移入 Deferred Ideas）

---

## Cookie domain 与 Nuxt SSR session 通道

| Option | Description | Selected |
|--------|-------------|----------|
| A：SSR fetch /api/auth/get-session | Nuxt server middleware 把 cookie forward 到 gateway 的 `/api/auth/get-session`，JSON 结果放入 `useState('session')`。better-auth REST API 原生支持，CF 内部 <50ms。 | ✓ |
| B：SSR 仅识别登录态骨架 | 只看 cookie 里有没有 `starye.session_token` 就渲染已登录骨架，客户端 hydrate 再拉完整 session。零额外 fetch，但 AUTH-02 需重新解释为"识别登录态布局"。 | |
| C：完全客户端 hydrate | SSR 一律匿名，hydrate 后补登录态。最小改动，但 AUTH-02 事实上未达成。 | |

**User's choice:** A
**Notes:** 伴生决策（未单独问）：SSR fetch 的 URL 一律走 `NUXT_PUBLIC_API_URL`（本地 `http://localhost:8080`，生产 `https://starye.org`）始终经过 gateway；fetch 失败降级为匿名不阻塞；请求级去重；cookie domain 维持 `starye.org` 不带前导点（RFC 6265 下与 `.starye.org` 语义等价）。

---

## Gateway bypass 触发条件（AUTH-07）

| Option | Description | Selected |
|--------|-------------|----------|
| a：粗暴无脑，有头全 bypass | 请求带 Cookie 或 Authorization → `shouldStore = false`。自用场景零误判；代价是登录后 `/api/public/movies` 不命中，D1 直穿。 | ✓ |
| b：只按 session cookie 名 bypass | 检测 `starye.session_token` 才 bypass，更精确；多维护一条与 cookiePrefix 耦合的假设。 | |
| c：分组处理（public 保留缓存） | 只有 private group 才按请求头 bypass；public 列表照常命中。对多用户项目合理，但单用户场景等价 (a)/(b)，复杂度不值得。 | |

**User's choice:** a
**Notes:** 伴生决策：`/api/auth/*` 等 `NO_STORE_PREFIXES` 路径维持独立判定（与头判断"或"关系）；`Set-Cookie` 响应不入缓存作为第二层防线保留；新增 `X-Cache-Reason: auth-headers` 响应头排障；单元测试覆盖三组合 + `/api/auth/*` 恒 BYPASS。

---

## 私有 scope cache key 构造

| Option | Description | Selected |
|--------|-------------|----------|
| 删掉死代码 | 移除 `PRIVATE_CACHE_PREFIXES`、`hashValue(cookie)` 分支、private scope `Vary: Cookie`、`CacheScope`/`CacheGroup` 相关类型；减少未来误用面。 | ✓ |
| 保留包着，加注释 | 保留 private scope 路径但前置被 (a) 拦截，便于未来打开；代价是长期留下走不到的复杂度。 | |
| 更进一步，移入 NO_STORE_PREFIXES | 额外把 `/api/favorites` / `/api/history` 语义上升级成 "no-store"；等价但更显式。 | |

**User's choice:** 删掉死代码
**Notes:** 具体删除点：`cache-middleware.ts` 里的 `PRIVATE_CACHE_PREFIXES` 常量（L49）、`resolveBasePolicy` 相关分支（L142-151）、`createCacheKey` 的 `userScope` 分支（L208-210）、`decorateResponse` 的 `Vary: Cookie` 分支（L358）。类型收窄 `CacheScope = 'public' | 'bypass'`，`CacheGroup` 删 `'favorites'`。`hashValue` 函数本体保留（可能用于其他路径）。

---

## 同浏览器其他 tab 的登出传播

| Option | Description | Selected |
|--------|-------------|----------|
| A：不管 | 服务端 session 失效后，其他 tab 下次请求被 401，Phase 2 门控统一跳 `/auth/login`。满足 AUTH-08 文字。 | ✓ |
| B：BroadcastChannel 立即广播 | 任一页面登出立即广播，其他 tab UI 立即变匿名。~20 行代码。 | |
| C：visibilitychange 重拉 session | tab 切回前台时 revalidate。折中方案。 | |

**User's choice:** A
**Notes:** 自用单浏览器场景，BroadcastChannel/visibilitychange 复杂度不值得。成功标准 #2 "刷新即变回匿名态" 由 cookie 清除 + 401 拦截 + 刷新联合满足。

---

## Better Auth 1.6.2 → ^1.6.10 升级策略

| Option | Description | Selected |
|--------|-------------|----------|
| 全站一次升 | 单 PR 内 `pnpm up -r better-auth@^1.6.10`，一起冒烟。patch 风险小，版本漂移过 adapter 的风险更小。 | ✓ |
| 分两步：api 先、前端后 | 分步降低诊断难度，但中间状态下 drizzle-adapter 与前端可能版本不同步。 | |
| plan-phase 时再定 | 延后到 plan-phase 根据最新 changelog 决策。 | |

**User's choice:** 全站一次升
**Notes:** 四个 package.json（apps/api, apps/auth, apps/blog, apps/dashboard）同一 commit 升级。冒烟路径定义在 CONTEXT D-19。升级前由 gsd-phase-researcher 读 1.6.3..1.6.10 changelog 找破坏性变更；若有发现升级任务置 HIGH 回来讨论。

---

## Claude's Discretion

- `X-Cache-Reason` 枚举值细化程度由 planner 决定
- Nuxt server middleware 具体文件名与位置由 planner 按 Nuxt 4 惯例选
- 冒烟测试的自动化形态（Playwright spec vs 手动 checklist）由 planner 评估后决定
- pnpm 升级命令与 lockfile 更新顺序按 pnpm 10.33.0 默认行为

## Deferred Ideas

- 客户端 UI 风格统一 → Phase 2 或独立 UI phase
- BroadcastChannel 跨 tab 登出传播 → 若未来转多人场景再评估
- visibilitychange 重拉 session → 同上
- 精确按 cookie 名 bypass（替代"有头就 bypass"） → 若 hit 率真的影响使用再调
- `/api/favorites` / `/api/history` 显式迁入 `NO_STORE_PREFIXES` → D-12 后事实已达成，语义重构可选
- Better Auth major 升级（1.7.x / 2.x） → 本 phase 只走 patch 级
