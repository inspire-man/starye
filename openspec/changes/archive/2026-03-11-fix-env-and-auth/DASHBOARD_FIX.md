# Dashboard 无限重定向修复

## 问题描述

访问 `http://localhost:8080/dashboard/` 时出现：
```
ERR_TOO_MANY_REDIRECTS
localhost 将您重定向的次数过多
```

Gateway 日志显示持续的 302 重定向：
```
gateway:dev: [wrangler:info] GET /dashboard/ 302 Found (4ms)
gateway:dev: [wrangler:info] GET /dashboard/ 302 Found (5ms)
gateway:dev: [wrangler:info] GET /dashboard/ 302 Found (5ms)
...
```

---

## 根本原因分析

### 问题 1: Gateway 路径重写冲突

**文件**: `apps/gateway/src/index.ts` (第 36-44 行)

**原始配置**:
```typescript
if (path.startsWith('/dashboard')) {
  if (path === '/dashboard') {
    return Response.redirect(`${url.origin}/dashboard/`, 301)
  }
  // ⚠️ 移除 /dashboard 前缀
  const target = 'http://localhost:5173'
  return proxy(request, target, p => p.replace(/^\/dashboard/, ''))
}
```

**问题**:
- Gateway 会将 `/dashboard/posts` → `http://localhost:5173/posts`
- 但 Dashboard 的 Vite 配置 `base: '/dashboard/'` 会在 HTML 中生成带 `/dashboard/` 前缀的资源路径
- Vue Router 的路由是 `/` 和 `/posts`（不带前缀）
- 导致路径不一致，触发循环重定向

### 问题 2: Dashboard Vite Base 配置

**文件**: `apps/dashboard/vite.config.ts` (第 16 行)

**原始配置**:
```typescript
base: '/dashboard/',
```

**问题**:
- 当 Gateway 移除 `/dashboard` 前缀后，Dashboard 收到的路径是 `/`
- 但 Dashboard 内部所有资源和路由都基于 `/dashboard/`
- 路径不匹配导致 Vue Router 无法正确解析
- 可能触发默认路由或错误处理逻辑，导致循环

### 问题 3: Auth 重定向 URL

**文件**: `apps/dashboard/src/router/index.ts` (第 51, 62 行)

**原始代码**:
```typescript
if (!session) {
  window.location.href = `/auth/login?redirect=${encodeURIComponent(window.location.pathname)}`
  return
}
```

**问题**:
- `window.location.pathname` 在 Gateway 代理后是 `/dashboard/`
- 但如果 Gateway 做了路径重写，Dashboard 内部可能期望的是 `/`
- 重定向回来时路径可能不一致

---

## 修复方案

### 修复 1: 移除 Gateway 的路径重写

**文件**: `apps/gateway/src/index.ts`

**修改**:
```typescript
// 2. Dashboard
if (path.startsWith('/dashboard')) {
  if (path === '/dashboard') {
    return Response.redirect(`${url.origin}/dashboard/`, 301)
  }
  // ✅ Dashboard 使用 base: '/dashboard/'，不需要路径重写
  const target = isLocal ? 'http://localhost:5173' : (env.DASHBOARD_ORIGIN || 'http://localhost:5173')
  return proxy(request, target)  // ✅ 移除 pathRewrite
}
```

**效果**:
- Gateway 直接将完整路径 `/dashboard/posts` 代理到 Dashboard
- Dashboard 收到的请求路径与其内部配置一致

### 修复 2: 保持 Dashboard Base 配置

**文件**: `apps/dashboard/vite.config.ts`

**保持不变**:
```typescript
base: '/dashboard/',
```

**说明**:
- Dashboard 始终认为自己部署在 `/dashboard/` 路径下
- 本地开发和生产环境配置一致
- Vue Router 的 `createWebHistory(import.meta.env.BASE_URL)` 会正确处理路径

---

## 预期行为

修复后的正常流程：

### 1. 访问 Dashboard 首页
```
GET http://localhost:8080/dashboard/
  ↓
Gateway: 302 → http://localhost:8080/dashboard/ (如果缺少尾斜杠)
  ↓
Gateway: Proxy → http://localhost:5173/dashboard/
  ↓
Dashboard: Vue Router 匹配路由 '/' (base: '/dashboard/')
  ↓
返回 HTML (资源路径: /dashboard/assets/...)
```

### 2. 未登录重定向
```
Dashboard Router Guard: 检测无 Session
  ↓
Redirect: /auth/login?redirect=/dashboard/
  ↓
登录成功 → 返回 /dashboard/
  ↓
Dashboard 正常显示
```

### 3. 访问子路由
```
GET http://localhost:8080/dashboard/posts
  ↓
Gateway: Proxy → http://localhost:5173/dashboard/posts
  ↓
Dashboard: Vue Router 匹配路由 '/posts' (base: '/dashboard/')
  ↓
返回对应视图
```

---

## 测试步骤

### 1. 等待重新编译
```bash
# Gateway 和 Dashboard 都需要重启/重新编译
# 等待约 5-10 秒
```

### 2. 清除浏览器缓存
```
F12 → Network → Disable cache (勾选)
或
Ctrl+Shift+Delete → 清除缓存
```

### 3. 测试未登录访问
```
http://localhost:8080/dashboard/
```
**预期**:
- ✅ 重定向到 `/auth/login?redirect=%2Fdashboard%2F`
- ✅ 不再出现无限循环

### 4. 测试登录后访问
```bash
# 先完成登录
http://localhost:8080/auth/login

# 然后访问 Dashboard
http://localhost:8080/dashboard/
```
**预期**:
- ✅ 显示 Dashboard 首页
- ✅ 资源正常加载
- ✅ 路由正常切换

### 5. 测试子路由
```
http://localhost:8080/dashboard/posts
http://localhost:8080/dashboard/comics
http://localhost:8080/dashboard/users
```
**预期**:
- ✅ 所有路由都能正常访问
- ✅ 无 404 错误

---

## 调试日志

修复后应看到：

### Gateway 日志
```
gateway:dev: [wrangler:info] GET /dashboard/ 302 Found (4ms)  // 仅一次，添加尾斜杠
gateway:dev: [wrangler:info] GET /dashboard/ 200 OK (50ms)    // 代理到 Dashboard
```

### Dashboard 日志
```
[Auth Guard] Session: { user: { role: 'super_admin' } }
[Auth Guard] User Role: super_admin
// → 允许访问
```

---

## 相关文件修改

| 文件 | 修改内容 | 原因 |
|------|---------|------|
| `apps/gateway/src/index.ts` | 移除 Dashboard 的 pathRewrite | 保持路径一致性 |
| `apps/dashboard/vite.config.ts` | 保持 `base: '/dashboard/'` | 与 Gateway 路由匹配 |

---

## 注意事项

### 为什么不让 Dashboard 使用 base: '/'？

如果设置 `base: '/'`，会导致：
- Dashboard 的资源请求 `/assets/...` 会被发送到 `http://localhost:8080/assets/...`
- Gateway 无法识别这些路径（不匹配任何路由规则）
- 默认会代理到 Blog，导致 404

### 为什么不在 Gateway 做更智能的重写？

复杂的路径重写容易出错，且难以维护。保持简单的规则：
- **Gateway**: 根据路径前缀代理到对应服务
- **应用**: 使用 `base` 配置告诉自己部署在哪个路径下

---

## 下一步

修复完成后，请测试：

1. ✅ Dashboard 首页能否正常访问
2. ✅ 所有子路由（/posts, /comics, /users）能否正常访问
3. ✅ 登录重定向是否正常工作
4. ✅ 从其他应用跳转到 Dashboard 是否正常

如果仍有问题，请提供：
- 浏览器控制台的完整错误
- Network 面板的请求顺序
- Gateway 和 Dashboard 的日志输出
