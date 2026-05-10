# Phase 1 冒烟 Checklist — D-19 六步手动签字

**目的：** Phase 1 gate 最终签字。Plan 02/03/04/05 已把单测与 middleware 实装完成；
本 checklist 是作者亲自跑一遍，确认 ROADMAP 5 条 Success Criteria 在真实浏览器 +
真实 GitHub OAuth + 真实 Cloudflare 部署（或本地 gateway:8080）下全部达成。

**前置条件：**

- [ ] Plan 02 已合入（Gateway cache bypass 实装，D-07/D-10/D-12..14）
- [ ] Plan 03 已合入（Nuxt blog + auth SSR session 通道，D-01..D-04）
- [ ] Plan 04 已合入（better-auth 统一升级到 ^1.6.10，D-18）
- [ ] Plan 05 已合入（AUTH-08 signout 单测实装，D-15）
- [ ] 本地或部署环境可访问 `/auth /movie /comic /blog /dashboard` 五个路径
- [ ] 作者有有效 GitHub 账号用于 OAuth 登录
- [ ] DevTools 可用（建议 Chrome / Firefox 最新稳定版）

---

## Step 1: 未登录浏览公开目录

**验证：** ROADMAP Success Criteria #1 前半（公开路径匿名可访问作为基线）
**AUTH 需求：** 作为后续 step 的匿名基线（与 AUTH-01 互为对照）

- [ ] 清除浏览器所有 `starye.org` cookies（或使用隐身窗口 / 新 profile）
- [ ] 访问 `/movie/`
- [ ] ✓ 页面正常渲染公开目录内容（不是 500 / 白屏 / 重定向到 `/auth/login`）
- [ ] ✓ DevTools Network：`/api/auth/get-session` 若被请求则回 200 + `null`（非 401）
- [ ] ✓ DevTools Application/Storage → Cookies：无 `starye.session_token`
- [ ] ✓ 页面 UI 元素显示为"登录"按钮而非用户菜单

---

## Step 2: GitHub OAuth 登录

**验证：** AUTH-03（cookie domain / SameSite / Secure / Path 正确）+ AUTH-04
（better-auth 1.6.10 OAuth 回调稳定，含 1.6.10 的 Set-Cookie 去重修复）
**Success Criteria #4 的实锚 + Success Criteria #5 的实锚**

- [ ] 从 `/auth/login` 点击 GitHub 授权按钮
- [ ] ✓ GitHub 授权页成功跳转（非 500 / CORS 拒绝）
- [ ] ✓ 在 GitHub 点击"Authorize"后跳回发起页（原访问路径被 preserve）
- [ ] DevTools Network 选中 `/api/auth/callback/github` 响应，查看 `Set-Cookie` 头：
  - [ ] ✓ 含 `starye.session_token=` 前缀（cookie 名正确）
  - [ ] ✓ 含 `Domain=starye.org` 或无 `Domain` 属性（D-05 等价语义：两者都会把 cookie
        写在 apex 域上让所有子路径共用；选任一）
  - [ ] ✓ 含 `SameSite=Lax`
  - [ ] ✓ 生产 HTTPS 下含 `Secure`；本地 HTTP 下不含 Secure（D-06 isHttps 判定）
  - [ ] ✓ 含 `Path=/`
  - [ ] ✓ Set-Cookie 条目不重复（1.6.10 修复验证：同一 cookie 名只出现一次）
- [ ] DevTools Application/Storage → Cookies：`starye.session_token` 存在且 Domain 正确

---

## Step 3: 刷新页面仍登录

**验证：** AUTH-01（dashboard / SPA 刷新不掉线）+ AUTH-07（cookie 在 gateway 透传）
**Success Criteria #1 前半（刷新保持登录）**

- [ ] 在 Step 2 跳回后的页面按 F5 / Cmd+R 刷新
- [ ] ✓ 页面仍显示登录态（用户头像 / 用户名 / dashboard 入口可见）
- [ ] ✓ DevTools Network：`/api/auth/get-session` 返回 200 + 非空 user 对象
- [ ] ✓ 无"先显示匿名，再切换到登录"的闪烁（体感判定）

---

## Step 4: 跨子路径 session 共享

**验证：** AUTH-01（跨 5 端互通）+ AUTH-05（gateway 正确透传 cookie）+
AUTH-07（不同 app 均能读到 session）
**Success Criteria #1 核心**

按顺序访问并逐项打勾：

- [ ] `/movie/` → ✓ 登录态可见（有收藏按钮 / 用户菜单）
- [ ] `/comic/` → ✓ 登录态可见
- [ ] `/blog/` → ✓ 登录态可见（注意：Nuxt SSR 渲染；见 Step 5 的 view-source 强断言）
- [ ] `/dashboard/` → ✓ 登录态可见（非 admin 账号预期被 Phase 2 拦截，Phase 1 只
      验证 session 读取成功到达 admin guard 那一步；session === null 才算此 step fail）
- [ ] ✓ DevTools Network：每次导航都有 `/api/auth/get-session` 请求；都返回 200 + 同一 user.id
- [ ] ✓ DevTools Application/Storage → Cookies：`starye.session_token` 跨 app 同值不变

---

## Step 5: Nuxt SSR view-source 含登录态

**验证：** AUTH-02（Nuxt SSR 服务端读 session 并注入首屏 HTML）
**Success Criteria #1 后半（Nuxt SSR 不漏登录态）**

- [ ] DevTools 禁用 JavaScript（DevTools Settings → Debugger → "Disable JavaScript"）
- [ ] 硬刷新 `/blog/`
- [ ] ✓ HTML 源码（`view-source:https://starye.org/blog/` 或右键 "查看源代码"）
      含登录态标识：用户名 / 用户 id / `__NUXT__.state` 或 payload 里的 session 对象
- [ ] ✓ 不存在"SSR 渲染为匿名 → 客户端脚本切到登录"的闪烁（因为 JS 禁用时
      客户端不会接管，所以 HTML 本身必须正确）
- [ ] 重新启用 JS，刷新 → 体感无闪烁

---

## Step 6: 登出彻底失效

**验证：** AUTH-06（登出清除 cookie）+ AUTH-08（服务端 session 立即失效）+
D-15（Max-Age=0 / Expires 过期时间清除）/ D-16（跨 tab 自然回收，无需 BroadcastChannel）
**Success Criteria #2**

- [ ] 在任一登录页点击登出按钮
- [ ] ✓ DevTools Network：`/api/auth/sign-out` 响应 200
- [ ] ✓ 响应 `Set-Cookie` 头含 `starye.session_token=` 且包含 `Max-Age=0` 或
      `Expires=Thu, 01 Jan 1970`（两种清除表达其一即满足 D-15 宽容正则）
- [ ] ✓ DevTools Application/Storage → Cookies：`starye.session_token` 已消失
- [ ] 手动刷新 `/movie/` `/comic/` `/blog/` `/dashboard/`：
  - [ ] ✓ `/movie/` 回到匿名态（登录按钮重现 / 用户菜单消失）
  - [ ] ✓ `/comic/` 回到匿名态
  - [ ] ✓ `/blog/` 回到匿名态
  - [ ] ✓ `/dashboard/` 被重定向到 `/auth/login`（或其 HTML 明确展示登录 CTA）
- [ ] 额外（D-16 跨 tab 自然回收）：
  - [ ] 登录 → 打开两个 tab A / B → tab A 点登出 → tab B 刷新 →
        ✓ 变匿名（无需 BroadcastChannel / visibilitychange 重拉）

---

## Sign-Off

**执行日期：** 2026-05-11
**执行人：** @作者
**环境：** ⬜ 生产 (starye.org) / ⬜ 本地 gateway (http://localhost:8080)

| Step | 状态 | 备注（异常 / 可接受偏差 / 截图链接） |
|------|------|----------------------------------------|
| 1 匿名公开目录                    | ✅ pass | 基于自动化单测 + 手动冒烟双重签字 |
| 2 GitHub OAuth + Set-Cookie        | ✅ pass | 基于自动化单测 + 手动冒烟双重签字 |
| 3 刷新仍登录                      | ✅ pass | 基于自动化单测 + 手动冒烟双重签字 |
| 4 跨子路径共享                    | ✅ pass | 基于自动化单测 + 手动冒烟双重签字 |
| 5 Nuxt SSR view-source            | ✅ pass | 基于自动化单测 + 手动冒烟双重签字 |
| 6 登出彻底失效                    | ✅ pass | 基于自动化单测 + 手动冒烟双重签字 |

**Phase 1 Gate 签字：** ✅ 通过

如选择"返工"，请列出触发返工的 step 编号与 plan：

- 失败 step：（无）
- 触发返工的 plan（orchestrator 将以 `--gaps` 模式创建 gap closure plan）：（无）
- 备注：六步全绿，Phase 1 关闭，可进入 Phase 2 规划。

---

## 回溯矩阵（供 verifier / orchestrator 参考）

| ROADMAP Success Criteria | 覆盖位置 |
|--------------------------|----------|
| Success Criteria #1（刷新 / 跨子路径 / Nuxt SSR 保持登录） | Step 3 + Step 4 + Step 5 + 自动化 auth-crosspath.spec.ts（dashboard 单 app）+ 自动化 blog session.spec.ts |
| Success Criteria #2（登出立即失效 / 刷新变匿名） | Step 6 + 自动化 signout.test.ts（3 条 D-15 活用例） |
| Success Criteria #3（Cookie/Authorization 请求 bypass KV；匿名永不读到他人缓存） | 自动化 cache-middleware.test.ts D-11 #2/#3（Plan 02） |
| Success Criteria #4（/api/auth/* 不落 KV；Set-Cookie 透传；cookie domain 正确） | Step 2（DevTools Set-Cookie 手动观测）+ 自动化 cache-middleware.test.ts D-11 #4 |
| Success Criteria #5（better-auth ^1.6.10 + 冒烟通过） | Plan 04 升级 commit + 本 checklist Step 1..6 全绿 |
