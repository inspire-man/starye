# Dashboard 部署修复方案

## 问题分析

### 1. 前端应用访问本地 API 的问题

**症状**：
- 显示的是开发环境数据而不是生产环境数据
- 部分接口请求失败

**根本原因**：
Cloudflare Pages **在运行时无法访问构建时的环境变量**。`VITE_API_URL` 是在构建时替换的，但是：

1. **Dashboard**: 使用 `import.meta.env.VITE_API_URL || 'http://localhost:8787'`
2. **Comic/Movie Apps**: 使用 `baseURL: '/api'`（相对路径）

当用户通过浏览器访问 `https://starye.org/dashboard/` 时：
- Dashboard 构建时虽然设置了 `VITE_API_URL=https://starye.org`
- 但如果代码中有运行时判断，可能还是会出问题

### 2. Dashboard 路径问题

Dashboard 同样需要：
- 生产环境：`base: '/'`（Pages 部署在根路径）
- Gateway：路径重写 `/dashboard/xxx` → `/xxx`

## 修复方案

### 方案一：统一使用相对路径（推荐）

所有应用都使用相对路径 `/api`，通过 Gateway 转发到 API Worker。

#### Dashboard API 配置

修改 `apps/dashboard/src/lib/api.ts`:

```typescript
// 使用相对路径，通过 Gateway 转发
export const API_BASE = '/api'

export async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`
  
  const res = await fetch(url, {
    credentials: 'include',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Unknown error' }))
    throw new Error(error.message || `Request failed with status ${res.status}`)
  }

  return res.json()
}
```

#### Dashboard Auth 配置

修改 `apps/dashboard/src/lib/auth-client.ts`:

```typescript
import { createAuthClient } from 'better-auth/vue'

// 使用相对路径，通过 Gateway 转发
export const authClient = createAuthClient({
  baseURL: '/api/auth',
})
```

### 方案二：环境变量注入（备选）

如果必须使用绝对 URL，则需要在 Cloudflare Pages 中配置环境变量。

但这会导致问题：Vite 的 `import.meta.env` 是在**构建时**替换的，不是运行时。
所以这个方案不可行。

## 完整部署步骤

### 1. 修改 Dashboard API 配置

```bash
# apps/dashboard/src/lib/api.ts
export const API_BASE = '/api'

# apps/dashboard/src/lib/auth-client.ts
baseURL: '/api/auth'
```

### 2. 重新构建

```bash
pnpm --filter dashboard build
```

### 3. 部署 Dashboard

```bash
pnpm exec wrangler pages project create starye-dashboard --production-branch=main || true
pnpm exec wrangler pages deploy apps/dashboard/dist --project-name=starye-dashboard --commit-dirty=true
```

### 4. 部署 Gateway（如果有修改）

```bash
pnpm --filter gateway deploy
```

### 5. 验证

访问 https://starye.org/dashboard/ 并检查：
- [ ] 页面正常加载（无 404）
- [ ] 登录功能正常
- [ ] 用户列表显示生产环境数据
- [ ] 控制台无 CORS 错误

## 预期结果

修复后：
1. 所有前端应用（Dashboard/Comic/Movie）都通过 Gateway 访问 API
2. 请求路径：`https://starye.org/api/...` → Gateway → `https://api.starye.org/...`
3. 认证 Cookie 正常工作（同域）
4. 显示生产环境数据

## 注意事项

### Cloudflare Pages 环境变量

Cloudflare Pages 中配置的环境变量：
- 只在**构建时**可用（如果使用 Pages 自己的构建系统）
- **不会**在运行时注入到前端代码中
- Vite 的 `import.meta.env` 是编译时替换，不是运行时

所以最佳实践是：
- 使用相对路径 `/api`
- 通过 Gateway 统一处理所有请求
- 避免在前端硬编码绝对 URL
