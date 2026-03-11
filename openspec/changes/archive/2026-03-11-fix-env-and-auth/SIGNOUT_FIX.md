# 登出功能修复

## 问题描述

点击登出按钮时跳转到 `http://localhost:8080/api/auth/sign-out`，但返回 **404 Not Found** 或 **500 Internal Server Error**。

日志显示：
```
api:dev: [wrangler:info] GET /api/auth/sign-out 404 Not Found (28ms)
gateway:dev: [wrangler:info] GET /api/auth/sign-out 404 Not Found (33ms)
```

---

## 根本原因分析

### 问题 1: Blog 应用直接跳转到 URL

**文件**: `apps/blog/app/layouts/default.vue` (第 9-12 行)

**原始代码**:
```typescript
function handleLogout() {
  window.location.href = '/api/auth/sign-out'  // ❌ 直接跳转，使用 GET 请求
}
```

**问题**:
- 使用 `window.location.href` 会发送 GET 请求
- Better Auth 的 `sign-out` 端点需要 POST 请求
- 且需要携带 Session Token
- 没有使用 Better Auth 的 `signOut()` SDK 方法

### 问题 2: Comic/Movie/Dashboard 重定向路径错误

**文件**: 
- `apps/comic/app/layouts/default.vue` (第 10-12 行)
- `apps/movie/app/layouts/default.vue` (第 9-11 行)
- `apps/dashboard/src/layouts/DefaultLayout.vue` (第 16-23 行)

**原始代码**:
```typescript
async function handleLogout() {
  await signOut()
  router.push('/login')  // ❌ 应该跳转到中央 Auth 服务
}
```

**问题**:
- Comic/Movie/Dashboard 没有自己的 `/login` 路由
- 应该跳转到中央 Auth 服务 `/auth/login`
- 使用 `router.push` 在跨应用跳转时可能失效

---

## 修复方案

### 修复 1: Blog 应用使用 signOut() SDK

**文件**: `apps/blog/app/layouts/default.vue`

**修复内容**:
```typescript
<script setup lang="ts">
import { signOut, useSession } from '~/lib/auth-client'  // ✅ 导入 signOut

const session = useSession()
const { t } = useI18n()
const route = useRoute()
const user = computed(() => session.value.data?.user)

async function handleLogout() {
  try {
    await signOut()  // ✅ 调用 SDK 方法（POST /api/auth/sign-out + Session Token）
    // 登出成功后刷新页面或重定向
    window.location.href = '/blog/'
  }
  catch (error) {
    console.error('登出失败:', error)
  }
}
</script>
```

**效果**:
- 使用 Better Auth SDK 的 `signOut()` 方法
- 自动发送正确的 POST 请求
- 自动携带 Session Token
- 登出后重定向到 Blog 首页

---

### 修复 2: Comic 应用重定向到中央登录

**文件**: `apps/comic/app/layouts/default.vue`

**修复内容**:
```typescript
async function handleLogout() {
  try {
    await signOut()
    // ✅ 登出成功后重定向到中央登录页
    window.location.href = '/auth/login'
  }
  catch (error) {
    console.error('登出失败:', error)
  }
}
```

**效果**:
- 使用 `window.location.href` 确保跨应用跳转
- 重定向到中央 Auth 服务

---

### 修复 3: Movie 应用重定向到中央登录

**文件**: `apps/movie/app/layouts/default.vue`

**修复内容**:
```typescript
async function handleLogout() {
  try {
    await signOut()
    // ✅ 登出成功后重定向到中央登录页
    window.location.href = '/auth/login'
  }
  catch (error) {
    console.error('登出失败:', error)
  }
}
```

---

### 修复 4: Dashboard 应用重定向到中央登录

**文件**: `apps/dashboard/src/layouts/DefaultLayout.vue`

**修复内容**:
```typescript
async function handleLogout() {
  try {
    await signOut()
    // ✅ 登出成功后重定向到中央登录页
    window.location.href = '/auth/login'
  }
  catch (error) {
    console.error('登出失败:', error)
  }
}
```

---

## Better Auth signOut() 工作原理

Better Auth 的 `signOut()` 方法会：

1. **发送 POST 请求**
   ```
   POST /api/auth/sign-out
   Cookie: starye.session_token=xxx
   ```

2. **服务端处理**
   - 验证 Session Token
   - 从数据库删除 Session 记录
   - 清除 Cookie（设置 Max-Age=0）

3. **客户端处理**
   - 清除本地缓存的 Session 状态
   - 触发 `useSession()` 更新

4. **返回响应**
   ```
   200 OK
   Set-Cookie: starye.session_token=; Max-Age=0; Path=/
   ```

---

## 预期行为

修复后的完整登出流程：

### 1. 用户点击登出按钮

```typescript
async function handleLogout() {
  await signOut()
  window.location.href = '/auth/login'
}
```

### 2. signOut() 发送请求

```
POST http://localhost:8080/api/auth/sign-out
Cookie: starye.session_token=xxx
```

### 3. API 返回成功

```
200 OK
Set-Cookie: starye.session_token=; Max-Age=0; Path=/; Domain=localhost
```

### 4. 重定向到登录页

```
window.location.href = '/auth/login'
```

### 5. 登录页显示

- ✅ 不再显示用户信息
- ✅ 显示 "Login with GitHub" 按钮
- ✅ Cookie 已清除

---

## 测试步骤

### 1. 等待应用重新编译

```bash
# Blog, Comic, Movie, Dashboard 都需要重新编译
# 等待约 10-15 秒
```

### 2. 确认已登录状态

访问任意应用，确认显示用户信息：
```
http://localhost:8080/blog/      → 应显示用户名和头像
http://localhost:8080/comic/     → 应显示用户信息
http://localhost:8080/movie/     → 应显示用户信息
http://localhost:8080/dashboard/ → 应显示侧边栏用户信息
```

### 3. 测试 Blog 登出

```bash
# 访问 Blog
http://localhost:8080/blog/

# 点击右上角的登出按钮
# 应该看到：
# 1. 控制台日志: POST /api/auth/sign-out 200 OK
# 2. 页面刷新，回到 Blog 首页
# 3. 右上角显示 "Login" 按钮（不再显示用户信息）
```

### 4. 验证登出生效

刷新页面或访问其他应用：
```
http://localhost:8080/comic/  → 应重定向到 /auth/login
http://localhost:8080/movie/  → 应重定向到 /auth/login
http://localhost:8080/dashboard/ → 应重定向到 /auth/login
```

**说明**: 所有应用共享同一个 Session Cookie，登出后所有应用都应显示未登录状态。

### 5. 测试 Comic/Movie/Dashboard 登出

重新登录后，分别在各应用中点击登出按钮：

```bash
# Comic 登出
http://localhost:8080/comic/
点击登出 → 应跳转到 /auth/login

# Movie 登出
http://localhost:8080/movie/
点击登出 → 应跳转到 /auth/login

# Dashboard 登出
http://localhost:8080/dashboard/
点击侧边栏的 "Sign Out" → 应跳转到 /auth/login
```

---

## 调试日志

修复后应看到以下日志：

### Blog 登出
```
[Blog] 点击登出按钮
  ↓
POST /api/auth/sign-out
  ↓
api:dev: [wrangler:info] POST /api/auth/sign-out 200 OK (50ms)
gateway:dev: [wrangler:info] POST /api/auth/sign-out 200 OK (55ms)
  ↓
重定向: /blog/
```

### Comic/Movie/Dashboard 登出
```
[App] 点击登出按钮
  ↓
POST /api/auth/sign-out
  ↓
api:dev: [wrangler:info] POST /api/auth/sign-out 200 OK (45ms)
  ↓
重定向: /auth/login
```

---

## 常见问题

### Q1: 为什么登出后仍显示登录状态？

**可能原因**:
1. 浏览器缓存了旧的页面
2. Cookie 没有正确清除

**解决方案**:
1. 强制刷新页面 (Ctrl+F5)
2. 打开开发者工具 → Application → Cookies → 确认 `starye.session_token` 已删除
3. 清除浏览器缓存后重试

### Q2: 登出时报错 "Failed to fetch"

**可能原因**:
- API 服务未启动
- Network 错误

**解决方案**:
1. 确认 API 正在运行: `http://localhost:8787/health`
2. 确认 Gateway 正在运行: `http://localhost:8080/api/health`
3. 查看浏览器控制台的完整错误信息

### Q3: 点击登出后卡住不动

**可能原因**:
- `signOut()` 方法超时
- JavaScript 错误

**解决方案**:
1. 打开浏览器控制台查看错误
2. 检查 Network 面板，看 `/api/auth/sign-out` 请求是否成功
3. 如果一直 pending，可能是 API 响应慢，等待或刷新页面

---

## 相关文件修改

| 文件 | 修改内容 | 效果 |
|------|---------|------|
| `apps/blog/app/layouts/default.vue` | 使用 `signOut()` SDK | POST 请求 + 正确处理 |
| `apps/comic/app/layouts/default.vue` | 重定向到 `/auth/login` | 中央登录页 |
| `apps/movie/app/layouts/default.vue` | 重定向到 `/auth/login` | 中央登录页 |
| `apps/dashboard/src/layouts/DefaultLayout.vue` | 重定向到 `/auth/login` | 中央登录页 |

---

## 下一步

修复完成后，请测试：

1. ✅ Blog 登出 → 刷新后显示 "Login" 按钮
2. ✅ Comic 登出 → 跳转到登录页
3. ✅ Movie 登出 → 跳转到登录页
4. ✅ Dashboard 登出 → 跳转到登录页
5. ✅ 登出后访问任何受保护的应用都应重定向到登录页
6. ✅ 重新登录后所有应用恢复登录状态

如果有任何问题，请提供浏览器控制台和 Network 面板的日志！
