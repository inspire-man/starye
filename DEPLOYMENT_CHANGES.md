# 部署修复变更记录

## 问题总结

用户报告的问题：
1. **Dashboard 资源 404**：访问 `https://starye.org/dashboard/` 时，静态资源（CSS/JS）加载失败
2. **显示开发环境数据**：Dashboard/Comic/Movie 显示的是本地开发数据，而不是生产环境数据
3. **部分接口不通**：某些 API 请求失败

## 根本原因

### 1. Dashboard 配置问题

Dashboard 与 Comic/Movie App 需要完全相同的部署配置：
- 生产环境：`base: '/'`（Pages 部署在根路径）
- Gateway：路径重写 `/dashboard/xxx` → `/xxx`

之前的配置混乱导致资源路径错误。

### 2. API URL 配置问题

**核心问题**：Cloudflare Pages 在运行时无法访问环境变量。

- `import.meta.env.VITE_API_URL` 是在**构建时**替换的
- 但构建时设置 `VITE_API_URL=https://starye.org` 后，代码中仍有默认值逻辑
- 用户访问生产环境时，可能还是使用了默认的 `localhost:8787`

**解决方案**：统一使用相对路径 `/api`，通过 Gateway 转发。

## 具体修改

### 1. Dashboard Vite 配置

```diff
# apps/dashboard/vite.config.ts
export default defineConfig(({ mode }) => ({
  plugins: [vue(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
- // 生产环境：使用 / 因为部署到独立的 Cloudflare Pages 项目
- base: mode === 'production' ? '/' : '/dashboard/',
+ // 生产环境：使用 / 因为 Pages 部署在根路径，Gateway 负责路径重写
+ // 开发环境：使用 /dashboard/ 与 Gateway 路由保持一致
+ base: mode === 'production' ? '/' : '/dashboard/',
  server: { port: 5173, host: '0.0.0.0' },
}))
```

### 2. Dashboard API 配置

```diff
# apps/dashboard/src/lib/api.ts
- export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8787'
+ // 使用相对路径，通过 Gateway 转发到 API
+ export const API_BASE = '/api'
```

### 3. Dashboard Auth 配置

```diff
# apps/dashboard/src/lib/auth-client.ts
- const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080'
export const authClient = createAuthClient({
- baseURL: `${apiUrl}/api/auth`,
+ // 使用相对路径，通过 Gateway 转发到 API
+ baseURL: '/api/auth',
})
```

### 4. Dashboard Views 修复

```diff
# apps/dashboard/src/views/PostEditor.vue
- const response = await authClient.$fetch(`${import.meta.env.VITE_API_URL}/api/posts/admin/${route.params.id}`)
+ const response = await authClient.$fetch(`/api/posts/admin/${route.params.id}`)

- const url = isNew
-   ? `${import.meta.env.VITE_API_URL}/api/posts`
-   : `${import.meta.env.VITE_API_URL}/api/posts/${route.params.id}`
+ const url = isNew ? `/api/posts` : `/api/posts/${route.params.id}`
```

```diff
# apps/dashboard/src/views/Posts.vue
- const response = await authClient.$fetch<PostsListResponse>(`${import.meta.env.VITE_API_URL}/api/posts?draft=true&limit=50`)
+ const response = await authClient.$fetch<PostsListResponse>(`/api/posts?draft=true&limit=50`)

- const response = await authClient.$fetch<ApiSuccessResponse>(`${import.meta.env.VITE_API_URL}/api/posts/${id}`, {
+ const response = await authClient.$fetch<ApiSuccessResponse>(`/api/posts/${id}`, {
```

### 5. Gateway 路径重写

```diff
# apps/gateway/src/index.ts
// 2. Dashboard
if (path.startsWith('/dashboard')) {
  if (path === '/dashboard') {
    return Response.redirect(`${url.origin}/dashboard/`, 301)
  }
  const target = isLocal ? 'http://localhost:5173' : (env.DASHBOARD_ORIGIN || 'http://localhost:5173')
+ // 生产环境：移除 /dashboard 前缀（Pages 部署在根路径）
+ const pathRewrite = isLocal ? undefined : (p: string) => p.replace(/^\/dashboard/, '') || '/'
+ return proxy(request, target, pathRewrite)
- return proxy(request, target)
}
```

### 6. Dashboard _headers 配置

```diff
# apps/dashboard/public/_headers
# Cache static assets
- /dashboard/assets/*
+ /assets/*
  Cache-Control: public, max-age=31536000, immutable

# CORS headers
- /dashboard/*
+ /*
  Access-Control-Allow-Origin: *
  Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
  Access-Control-Allow-Headers: Content-Type, Authorization, x-service-token
```

### 7. Dashboard _redirects 配置

```diff
# apps/dashboard/public/_redirects
- # Cloudflare Pages SPA 路由配置
- # Dashboard 部署到独立的 Cloudflare Pages 项目，根路径为 /
- 
- # 静态资源直接返回（带有正确的 MIME type）
- /assets/*  /assets/:splat  200
- 
- # 所有其他路径返回 index.html（SPA fallback）
- /*         /index.html     200
+ # SPA fallback - 所有非文件请求都返回 index.html
+ /* /index.html 200
```

## 部署流程

### 执行脚本

```powershell
.\deploy-all-fixed.ps1
```

### 手动部署（如果需要）

```bash
# 1. 部署 Gateway（必须最先部署，因为要更新路径重写逻辑）
pnpm --filter gateway deploy

# 2. 部署 Dashboard
pnpm --filter dashboard run build
pnpm exec wrangler pages project create starye-dashboard --production-branch=main || true
pnpm exec wrangler pages deploy apps/dashboard/dist --project-name=starye-dashboard --commit-dirty=true

# 3. 部署 Comic App（如果有修改）
pnpm exec wrangler pages deploy apps/comic-app/dist --project-name=starye-comic --commit-dirty=true

# 4. 部署 Movie App（如果有修改）
pnpm exec wrangler pages deploy apps/movie-app/dist --project-name=starye-movie --commit-dirty=true
```

## 验证步骤

### 1. Dashboard 验证

访问 https://starye.org/dashboard/ 并检查：
- [ ] 页面正常加载（无白屏）
- [ ] 控制台无 404 错误（资源正常加载）
- [ ] 控制台无 CORS 错误
- [ ] 登录功能正常
- [ ] 用户列表显示生产环境数据（非本地数据）
- [ ] 所有菜单功能正常

### 2. Comic/Movie App 验证

访问 https://starye.org/comic/ 和 https://starye.org/movie/ 并检查：
- [ ] 页面正常加载
- [ ] 控制台无错误
- [ ] 数据列表显示正确（生产环境数据）
- [ ] 登录功能正常

### 3. API 连接验证

打开浏览器开发者工具 Network 标签，检查：
- [ ] API 请求发送到 `https://starye.org/api/...`
- [ ] API 响应正常（200 状态码）
- [ ] Cookie 正常传递（`session` cookie）

## 架构说明

### 请求流程

```
浏览器
  ↓
https://starye.org/dashboard/
  ↓
Gateway Worker (starye.org)
  ↓ 路径重写：/dashboard/xxx → /xxx
starye-dashboard.pages.dev/xxx
```

### API 请求流程

```
浏览器（在 https://starye.org/dashboard/ 页面）
  ↓
fetch('/api/users')
  ↓
https://starye.org/api/users
  ↓
Gateway Worker
  ↓
https://api.starye.org/users
  ↓
API Worker
  ↓
D1 Database（生产环境）
```

## 关键要点

1. **所有前端应用统一使用相对路径 `/api`**
2. **通过 Gateway 统一处理所有请求**
3. **避免在前端硬编码绝对 URL**
4. **Cloudflare Pages 环境变量不能在运行时使用**
5. **Gateway 负责路径重写，Pages 部署在根路径**

## 预期结果

修复后：
- ✅ Dashboard/Comic/Movie 页面正常加载
- ✅ 所有应用显示生产环境数据
- ✅ API 请求通过 Gateway 正确转发
- ✅ 认证 Cookie 正常工作（同域）
- ✅ 控制台无错误
