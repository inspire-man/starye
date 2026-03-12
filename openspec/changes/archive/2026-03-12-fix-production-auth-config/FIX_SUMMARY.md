# 生产环境认证配置修复报告

## 问题描述

**日期**: 2026-03-11  
**环境**: 生产环境 (Cloudflare Pages - `https://starye.org`)  
**影响范围**: 所有前端应用（blog, auth, comic, movie）

### 错误日志

```
1. API 连接失败:
localhost:8080/api/auth/get-session:1  Failed to load resource: net::ERR_CONNECTION_REFUSED
localhost:8080/api/auth/sign-in/social:1  Failed to load resource: net::ERR_CONNECTION_REFUSED

2. i18n 文件 404:
/auth/_i18n/1KCE19of/zh/messages.json:1  Failed to load resource: the server responded with a status of 404 ()
```

---

## 根本原因

### 问题 1: API URL 配置错误

**问题**: 客户端代码使用了 `process.env.NUXT_PUBLIC_API_URL`，但在浏览器环境中 `process.env` 不可用。

**受影响文件**:
- `apps/auth/app/lib/auth-client.ts`
- `apps/comic/app/lib/auth-client.ts`

**错误代码**:
```typescript
// ❌ 错误：process.env 在客户端不可用
const apiUrl = process.env.NUXT_PUBLIC_API_URL || import.meta.env.VITE_API_URL || 'http://localhost:8080'
```

**结果**: 生产环境中 `apiUrl` 始终降级到 `'http://localhost:8080'`，导致所有 API 请求失败。

---

### 问题 2: GitHub Actions 环境变量不匹配

**问题**: 部署脚本设置了 `NUXT_PUBLIC_API_URL`，但 Vite 构建时需要 `VITE_API_URL`。

**错误配置** (`deploy-auth.yml`):
```yaml
- name: Build Auth App (SSG)
  env:
    NUXT_PUBLIC_API_URL: https://starye.org  # ❌ Vite 无法识别
  run: pnpm --filter starye-auth generate
```

---

### 问题 3: i18n 模块未正确配置

**问题**: Auth 应用的 `nuxt.config.ts` 加载了 `@nuxtjs/i18n` 模块，但没有提供翻译文件。

**错误配置**:
```typescript
modules: [
  '@nuxtjs/i18n',  // ❌ 加载了但无翻译文件
],
i18n: {
  locales: [
    { code: 'en', iso: 'en-US', name: 'English' },
    { code: 'zh', iso: 'zh-CN', name: '简体中文' },
  ],
  // ...但没有 langDir 或 messages 配置
}
```

**结果**: 生产环境尝试加载 `/auth/_i18n/1KCE19of/zh/messages.json` 但文件不存在。

---

## 修复方案

### 修复 1: 统一使用 `import.meta.env.VITE_API_URL`

所有客户端代码必须使用 Vite 的环境变量访问方式。

#### 修复 `apps/auth/app/lib/auth-client.ts`

```typescript
import { createAuthClient } from 'better-auth/vue'

// ✅ 正确：使用 Vite 的 import.meta.env
const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080'

export const authClient = createAuthClient({
  baseURL: `${apiUrl}/api/auth`,
})

export const { signIn, signUp, signOut, useSession } = authClient
```

#### 修复 `apps/comic/app/lib/auth-client.ts`

```typescript
import type { Ref } from 'vue'
import type { ExtendedSession } from '~/types/auth'
import { createAuthClient } from 'better-auth/vue'

// ✅ 正确：使用 Vite 的 import.meta.env
const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080'

const authClient = createAuthClient({
  baseURL: `${apiUrl}/api/auth`,
})

export { authClient }
export const { signIn, signUp, signOut } = authClient

export function useSession() {
  const session = authClient.useSession()

  return session as Ref<{
    data: ExtendedSession | null
    isPending: boolean
    error: Error | null
  }>
}
```

---

### 修复 2: 更新 GitHub Actions 环境变量

#### 修复 `.github/workflows/deploy-auth.yml`

```yaml
- name: Build Auth App (SSG)
  env:
    VITE_API_URL: https://starye.org  # ✅ 正确：Vite 可识别
  run: pnpm --filter starye-auth generate
```

**其他 workflows 验证**:
- ✅ `deploy-blog.yml` - 已正确使用 `VITE_API_URL`
- ✅ `deploy-comic.yml` - 已正确使用 `VITE_API_URL`

---

### 修复 3: 移除未使用的 i18n 模块

#### 修复 `apps/auth/nuxt.config.ts`

```typescript
import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  app: {
    baseURL: '/auth/',
    head: {
      title: 'Starye ID',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'Starye Unified Identity Service' },
      ],
    },
  },

  // ✅ 移除未使用的 i18n 模块
  // modules: ['@nuxtjs/i18n'],
  // i18n: { ... },

  vite: {
    plugins: [tailwindcss() as any],
  },

  css: ['./app/assets/css/main.css'],

  build: {
    transpile: ['@starye/ui'],
  },

  runtimeConfig: {
    public: {
      apiUrl: process.env.NUXT_PUBLIC_API_URL || process.env.VITE_API_URL || 'http://localhost:8080',
    },
  },

  nitro: {
    preset: 'cloudflare-pages',
  },

  srcDir: 'app/',
})
```

**说明**: Auth 应用的 `login.vue` 实际上不使用任何 i18n API（无 `$t()` 或 `useI18n()` 调用），因此安全移除。

---

## 修复文件列表

### 代码修复

1. ✅ `apps/auth/app/lib/auth-client.ts` - 使用 `import.meta.env.VITE_API_URL`
2. ✅ `apps/comic/app/lib/auth-client.ts` - 使用 `import.meta.env.VITE_API_URL`
3. ✅ `apps/auth/nuxt.config.ts` - 移除 i18n 模块配置

### CI/CD 修复

4. ✅ `.github/workflows/deploy-auth.yml` - 修改环境变量为 `VITE_API_URL`

### 文档

5. ✅ `openspec/changes/fix-production-auth-config/proposal.md` - 问题分析和修复方案
6. ✅ `openspec/changes/fix-production-auth-config/FIX_SUMMARY.md` - 本文档

---

## 验证步骤

### 本地验证（开发环境）

```bash
# 1. 启动所有服务
pnpm dev

# 2. 访问 http://localhost:8080/blog
# 3. 点击登录
# 4. 验证跳转到 http://localhost:8080/auth/login
# 5. 验证控制台无 ERR_CONNECTION_REFUSED 错误
# 6. 验证控制台无 i18n 404 错误
```

**预期结果**: 所有请求正常，无错误日志。

---

### 生产验证（构建测试）

```bash
# 1. 本地模拟生产构建
cd apps/auth
VITE_API_URL=https://starye.org pnpm generate

# 2. 检查构建产物
cd dist
grep -r "localhost:8080" .

# 3. 预期结果：无 localhost:8080 引用
# 实际应为：https://starye.org
```

---

### 生产部署验证

```bash
# 1. 触发部署
git add .
git commit -m "fix(auth): 修复生产环境 API URL 和 i18n 配置"
git push origin main

# 2. 等待 GitHub Actions 完成部署
gh run watch

# 3. 访问生产环境
# https://starye.org/blog → 点击登录
# https://starye.org/auth/login

# 4. 打开浏览器控制台，验证：
# ✅ API 请求地址为 https://starye.org/api/auth/*
# ✅ 无 ERR_CONNECTION_REFUSED 错误
# ✅ 无 i18n 文件 404 错误
# ✅ 登录功能正常
```

---

## 环境变量使用规范

### 客户端代码（Vue/Nuxt）

| 场景 | 正确用法 | 错误用法 |
|------|---------|---------|
| **auth-client.ts** | `import.meta.env.VITE_API_URL` | ❌ `process.env.NUXT_PUBLIC_API_URL` |
| **Vue 组件** | `import.meta.env.VITE_*` | ❌ `process.env.*` |
| **Vite 配置** | `process.env.*` | ✅ 服务端可用 |

### 服务端代码（Nuxt SSR）

| 场景 | 正确用法 | 说明 |
|------|---------|------|
| **nuxt.config.ts** | `process.env.NUXT_PUBLIC_API_URL` | 服务端，可用 |
| **Server Middleware** | `useRuntimeConfig().public.apiUrl` | Nuxt 推荐方式 |

### 构建时环境变量

| 文件 | 环境变量名 | 作用时机 |
|------|-----------|---------|
| **GitHub Actions** | `VITE_API_URL` | Vite 构建时替换 |
| **本地 .env** | `VITE_API_URL` | 开发和构建时读取 |

---

## 预期效果

### 修复前

```
浏览器控制台:
❌ GET http://localhost:8080/api/auth/get-session net::ERR_CONNECTION_REFUSED
❌ GET /auth/_i18n/1KCE19of/zh/messages.json 404 (Not Found)

实际行为:
- 无法登录
- 无法获取 session
- i18n 警告
```

### 修复后

```
浏览器控制台:
✅ GET https://starye.org/api/auth/get-session 200 OK
✅ 无 i18n 相关错误

实际行为:
- 登录功能正常
- Session 正确获取
- 跨应用跳转正常
```

---

## 风险评估

### 低风险

本次修复仅涉及：
1. 客户端环境变量读取方式（纯配置层面）
2. 移除未使用的 i18n 模块（无功能影响）
3. CI/CD 环境变量名称（构建时替换）

### 无破坏性变更

- ✅ 不影响 API 接口
- ✅ 不影响数据库 schema
- ✅ 不影响用户数据
- ✅ 本地开发环境不受影响

### 可快速回滚

如有问题，可立即回滚到上一个 commit：
```bash
git revert HEAD
git push origin main
```

---

## 后续优化建议

### 短期（可选）

1. **统一环境变量命名**: 考虑将所有应用统一使用 `VITE_API_URL`
2. **添加环境变量验证**: 在构建时检查必需的环境变量是否存在
3. **更新 .env.example**: 明确说明生产环境需要设置 `VITE_API_URL=https://starye.org`

### 中期（推荐）

1. **创建 DEPLOYMENT.md**: 文档化 Cloudflare Pages 部署流程
2. **环境变量管理**: 考虑使用 Cloudflare Pages 的环境变量管理功能
3. **监控告警**: 添加前端错误监控（Sentry）

---

## 总结

### 修复内容

✅ 修复 2 个 auth-client.ts 文件，使用正确的客户端环境变量访问方式  
✅ 修复 1 个 GitHub Actions workflow，使用正确的构建时环境变量  
✅ 移除 Auth 应用未使用的 i18n 模块配置

### 预期效果

- **API 连接**: 从失败 (ERR_CONNECTION_REFUSED) 到成功 (200 OK)
- **i18n 错误**: 从 404 错误到无错误
- **登录功能**: 从无法使用到完全正常

### 影响范围

- **生产环境**: 立即修复
- **开发环境**: 无影响（仍使用 localhost:8080）
- **用户体验**: 登录功能恢复正常

---

**修复日期**: 2026-03-11  
**修复状态**: 待部署验证  
**优先级**: P0（阻塞生产环境）
