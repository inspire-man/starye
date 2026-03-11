## Context

当前项目存在环境变量配置混乱和鉴权流程错误的问题：

**现状问题：**
1. 各前端应用（blog/comic/movie/auth/dashboard）的 `auth-client.ts` 配置不统一，部分直接请求生产环境 API
2. `nuxt.config.ts` 和 `vite.config.ts` 的 fallback 值指向生产域名，导致本地开发时可能误操作
3. blog 的登录跳转路由配置错误（`routeRules` + `baseURL` 冲突）导致 404
4. comic/movie 的鉴权中间件因 `apiUrl` 指向生产环境导致本地 Cookie 无法读取，触发无限重定向

**架构约束：**
- Gateway (8080) → 代理所有服务（/api → 8787, /blog → 3002, /comic → 3000 等）
- Better Auth 的 session 存储在 D1，Cookie 通过 API Worker 设置
- 本地开发环境下多个 localhost 端口需要共享 Cookie（domain=localhost, sameSite=lax）
- 生产环境部署在 Cloudflare Pages/Workers，环境变量通过 Cloudflare Dashboard 配置

**涉及的文件：**
- `apps/{blog,comic,movie,auth}/app/lib/auth-client.ts`
- `apps/dashboard/src/lib/auth-client.ts`
- `apps/{blog,comic,movie,auth}/nuxt.config.ts`
- `apps/blog/nuxt.config.ts` 的 `routeRules`
- `apps/api/src/lib/auth.ts` 的 Cookie 配置（已基本正确，需验证）
- 根目录或各 app 的 `.env.example`（需新建）

## Goals / Non-Goals

**Goals:**
- 统一所有前端应用的环境变量命名和读取逻辑
- 确保本地开发时所有请求通过 Gateway，Cookie 能正确共享
- 修复 blog 登录跳转 404 和 comic/movie 无限重定向问题
- 提供清晰的本地开发环境配置文档

**Non-Goals:**
- 不改变生产环境的部署流程和环境变量配置方式
- 不重构 Better Auth 的整体架构
- 不修改 Gateway 的路由规则（已验证正确）
- 不涉及鉴权业务逻辑的修改（如权限校验、角色管理等）

## Decisions

### Decision 1: 统一使用 `VITE_API_URL` 作为主要环境变量名

**选择：** 所有应用优先读取 `VITE_API_URL`，Nuxt 应用兼容读取 `NUXT_PUBLIC_API_URL`

**理由：**
- Vite 的环境变量以 `VITE_` 开头是标准约定，所有前端构建工具都能识别
- `NUXT_PUBLIC_API_URL` 是 Nuxt 特有的 runtimeConfig，仅在 Nuxt SSR 时可用
- 统一主变量名可以在根目录使用单一 `.env.local` 文件配置所有应用

**替代方案：**
- 方案 A：每个 app 使用各自的环境变量名 → **拒绝**：维护成本高，容易遗漏
- 方案 B：只使用 `NUXT_PUBLIC_API_URL` → **拒绝**：dashboard 是 Vite 应用无法读取

**实施方式：**
```typescript
// 统一的 apiUrl 读取逻辑（所有 auth-client.ts）
const apiUrl = import.meta.env.VITE_API_URL 
            || process.env.NUXT_PUBLIC_API_URL  // Nuxt SSR 兼容
            || 'http://localhost:8080'  // 本地开发 fallback
```

### Decision 2: 本地开发 fallback 统一为 `http://localhost:8080`

**选择：** 所有 fallback 值使用 Gateway 地址（`http://localhost:8080`），而非 API Worker 或生产域名

**理由：**
- Gateway 是本地开发的统一入口，所有服务通过 Gateway 代理可以共享 Cookie
- 直接访问 API Worker（8787）会导致跨端口 Cookie 问题
- fallback 到生产域名会导致本地开发时误操作线上数据

**影响文件：**
- `apps/*/auth-client.ts` 的 apiUrl fallback
- `apps/*/nuxt.config.ts` 的 `runtimeConfig.public.apiUrl` fallback

### Decision 3: 移除 blog 的 `routeRules` 登录重定向

**选择：** 删除 `apps/blog/nuxt.config.ts` 中的 `routeRules: { '/login': { redirect: '/auth/login' } }`

**理由：**
- Nuxt 的 `baseURL: '/blog/'` 会导致 `/login` 实际路径为 `/blog/login`
- `routeRules` 重定向到 `/auth/login` 后会变成 `/blog/auth/login` → 404
- 应该在 Vue 组件中直接使用外部链接跳转到 `/auth/login`

**替代方案：**
- 方案 A：修改 `routeRules` 为绝对路径 → **拒绝**：Nuxt 的 routeRules 不支持跨应用重定向
- 方案 B：使用 middleware 重定向 → **拒绝**：增加复杂度，且 middleware 同样受 baseURL 影响

**实施方式：**
```vue
<!-- apps/blog/app/layouts/default.vue -->
<a :href="`/auth/login?redirect=${encodeURIComponent($route.fullPath)}`">
  Login
</a>
```

### Decision 4: 验证而非修改 API 的 Cookie 配置

**选择：** 检查 `apps/api/src/lib/auth.ts` 的 Cookie 配置是否满足本地开发需求，而非大规模修改

**理由：**
- 现有配置已基本正确：`sameSite: 'lax'`, `path: '/'`, 本地 `domain: undefined`
- 问题根源在于前端应用的 `apiUrl` 配置错误，导致请求未通过 Gateway
- 过度修改 Cookie 配置可能影响生产环境安全性

**验证检查点：**
- ✅ `sameSite: 'lax'`（允许同站跨端口）
- ✅ `path: '/'`（确保所有路径可访问）
- ✅ 本地开发 `domain: undefined`（让浏览器设置为 localhost）
- ✅ `cookiePrefix: 'starye'`（统一前缀）

### Decision 5: 在根目录提供单一 `.env.example`

**选择：** 在项目根目录创建 `.env.example`，而非各 app 分别创建

**理由：**
- 本地开发时所有应用共享相同的 Gateway 地址，配置一致
- 减少重复配置，降低维护成本
- 开发者只需复制一个文件即可完成环境配置

**内容：**
```bash
# API 服务地址（本地开发通过 Gateway）
VITE_API_URL=http://localhost:8080

# Nuxt 应用兼容（可选，与 VITE_API_URL 保持一致）
NUXT_PUBLIC_API_URL=http://localhost:8080

# 其他可选配置
# VITE_R2_URL=http://localhost:8080/media
# VITE_ADMIN_URL=http://localhost:8080/dashboard
```

## Risks / Trade-offs

### Risk 1: 修改环境变量逻辑可能影响生产部署

**缓解措施：**
- 仅修改 fallback 默认值，不改变环境变量读取优先级
- 生产环境仍通过 Cloudflare Dashboard 设置环境变量，不依赖 fallback
- 部署前在 staging 环境验证环境变量读取正确

### Risk 2: 开发者可能忘记配置 .env 文件

**缓解措施：**
- 提供清晰的 `.env.example` 和 README 文档
- fallback 值指向本地 Gateway，即使不配置也能基本工作
- 首次启动时在控制台输出环境变量检查提示

### Risk 3: Cookie 共享在特殊网络环境下可能失败

**场景：** 开发者使用 VPN、代理或特殊 hosts 配置

**缓解措施：**
- 在故障排查文档中说明如何检查 Cookie domain 和 sameSite
- 提供浏览器开发者工具中 Cookie 的检查步骤
- 建议使用标准的 `localhost` 而非 IP 或自定义域名

### Risk 4: 直接访问应用端口仍会有鉴权问题

**说明：** 如果开发者直接访问 `http://localhost:3000`（comic）而非通过 Gateway，仍会遇到 Cookie 问题

**缓解措施：**
- 在本地开发文档中明确说明必须通过 Gateway 访问
- 各应用的 README 中添加正确的访问地址示例
- 考虑在应用启动时输出提示信息

## Migration Plan

**实施步骤：**

1. **Phase 1: 修复环境变量配置**（无需停机）
   - 修改所有 `auth-client.ts` 的 apiUrl fallback
   - 修改所有 `nuxt.config.ts` 的 runtimeConfig fallback
   - 创建根目录 `.env.example`

2. **Phase 2: 修复登录跳转**（无需停机）
   - 移除 blog 的 `routeRules` 重定向
   - 修改 blog 的 `default.vue` 登录链接为外部链接

3. **Phase 3: 验证和文档**（无需停机）
   - 验证 API 的 Cookie 配置
   - 创建或更新本地开发文档
   - 测试完整登录流程

**测试计划：**
- [ ] 启动 Gateway, API, blog, comic, movie, auth
- [ ] 通过 `http://localhost:8080/blog/` 访问并点击登录
- [ ] 验证跳转到 `http://localhost:8080/auth/login` 且无 404
- [ ] 登录成功后验证 Cookie 设置（检查 domain, path, sameSite）
- [ ] 返回 blog 验证能读取到 session
- [ ] 访问 `http://localhost:8080/comic/` 验证 Cookie 共享，无重定向循环

**回滚策略：**
- 如果修改后出现问题，恢复各文件的 git 历史版本即可
- 环境变量配置为向后兼容，不会影响生产环境

## Open Questions

1. **是否需要为每个 app 单独提供 .env.example？**
   - 当前决策：使用根目录单一文件
   - 可根据实际使用反馈调整

2. **是否需要在应用启动时检查环境变量？**
   - 可考虑在 dev 模式添加启动检查脚本，验证 Gateway 是否运行
   - 优先级：低（可作为后续优化）

3. **是否需要修改 turbo.json 的任务依赖？**
   - 当前 `pnpm dev` 可能并行启动所有服务
   - 可考虑添加任务依赖确保 Gateway 先启动
   - 需要验证 turbo 配置（检查 `turbo.json`）
