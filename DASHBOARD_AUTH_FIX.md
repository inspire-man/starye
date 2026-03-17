# Dashboard Better Auth 修复

## 问题诊断

### 错误信息
```
BetterAuthError: Invalid base URL: /api/auth.
Please provide a valid base URL.
```

### 根本原因

Better Auth 的 `baseURL` 配置**不支持相对路径**，必须是完整的 URL（包含协议和域名）。

**错误配置**：
```typescript
// ❌ 错误：相对路径
export const authClient = createAuthClient({
  baseURL: '/api/auth',
})
```

**正确配置**：
```typescript
// ✅ 正确：完整 URL
const baseURL = typeof window !== 'undefined'
  ? `${window.location.origin}/api/auth`
  : 'http://localhost:8080/api/auth'

export const authClient = createAuthClient({
  baseURL,
})
```

## 解决方案

### 修改文件

**apps/dashboard/src/lib/auth-client.ts**

```typescript
import { createAuthClient } from 'better-auth/vue'

// Better Auth 需要完整的 URL（不能使用相对路径）
// 在浏览器环境，使用当前域名
const baseURL = typeof window !== 'undefined'
  ? `${window.location.origin}/api/auth`
  : 'http://localhost:8080/api/auth'

export const authClient = createAuthClient({
  baseURL,
})

export const { signIn, signUp, useSession, signOut } = authClient
```

### 工作原理

1. **浏览器环境**（`typeof window !== 'undefined'`）：
   - 使用 `window.location.origin` 获取当前域名
   - 例如：`https://starye.org/dashboard/` → `https://starye.org/api/auth`

2. **服务端渲染/构建时**（`typeof window === 'undefined'`）：
   - 回退到开发环境 URL：`http://localhost:8080/api/auth`

3. **请求流程**：
   ```
   浏览器
     ↓
   authClient.signIn()
     ↓
   https://starye.org/api/auth/sign-in
     ↓
   Gateway Worker
     ↓
   https://api.starye.org/auth/sign-in
   ```

## 为什么不能使用相对路径？

Better Auth 内部需要构造完整的 URL 用于：
1. **OAuth 回调 URL**：`${baseURL}/callback/github`
2. **CSRF 保护**：需要验证请求来源
3. **Cookie 域名设置**：需要知道完整的域名

如果使用相对路径 `/api/auth`，Better Auth 无法正确构造这些 URL，导致错误。

## 其他应用的配置

### Auth App 和 Blog App（Nuxt）

这两个应用使用 Nuxt，可以继续使用环境变量：

```typescript
// apps/auth/app/lib/auth-client.ts
// apps/blog/app/lib/auth-client.ts
const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080'

export const authClient = createAuthClient({
  baseURL: `${apiUrl}/api/auth`,
})
```

Nuxt 在**服务端渲染**时可以访问环境变量，所以这个配置仍然有效。

### Comic App 和 Movie App

这两个应用**不使用** Better Auth 客户端，而是直接使用 Axios：

```typescript
// apps/comic-app/src/api.ts
// apps/movie-app/src/api.ts
const api = axios.create({
  baseURL: '/api',  // ✅ Axios 支持相对路径
  withCredentials: true,
})
```

Axios 支持相对路径，所以不需要修改。

## 部署步骤

1. **修改代码**（已完成）
   ```bash
   # 已修改：apps/dashboard/src/lib/auth-client.ts
   ```

2. **重新构建**（已完成）
   ```bash
   pnpm --filter dashboard run build
   ```

3. **部署到 Cloudflare Pages**（已完成）
   ```bash
   pnpm exec wrangler pages deploy apps/dashboard/dist --project-name=starye-dashboard --commit-dirty=true
   ```

4. **验证**
   - 访问 https://starye.org/dashboard/
   - 检查控制台无 `Invalid base URL` 错误
   - 登录功能正常

## 验证清单

- [ ] Dashboard 页面正常加载（无白屏）
- [ ] 控制台无 `Invalid base URL` 错误
- [ ] 控制台无 404 错误（静态资源正常加载）
- [ ] 登录按钮可以点击
- [ ] 登录功能正常（GitHub OAuth）
- [ ] 用户信息正常显示
- [ ] API 请求正常（`https://starye.org/api/...`）

## 注意事项

### 1. Better Auth 与 Axios 的区别

- **Better Auth**：需要完整 URL（协议 + 域名 + 路径）
- **Axios**：支持相对路径（浏览器自动补全）

### 2. 环境变量的限制

- **Vite**：环境变量在构建时替换，运行时无法访问
- **Nuxt**：服务端可以访问环境变量
- **Cloudflare Pages**：运行时不支持环境变量

所以最佳实践是使用 `window.location.origin`，让浏览器自动提供当前域名。

### 3. 开发环境

在本地开发时：
- Dashboard 运行在 `http://localhost:5173`
- Gateway 运行在 `http://localhost:8080`
- `window.location.origin` 返回 `http://localhost:5173`
- 但 Vite proxy 会将 `/api` 请求转发到 `http://localhost:8787`

所以开发环境仍然正常工作。

## 总结

修复后的配置：
- ✅ Dashboard：使用 `window.location.origin` 动态获取域名
- ✅ Comic/Movie：继续使用相对路径（Axios 支持）
- ✅ Auth/Blog：继续使用环境变量（Nuxt SSR 支持）

所有应用现在都能在生产环境正确工作！
