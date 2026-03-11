# 无限重定向问题修复

## 问题描述

用户访问 `http://localhost:8080/comic/` 时出现无限重定向循环：
```
Comic → Auth Login → Comic → Auth Login → ...
```

## 根本原因分析

从日志可以看到：
```
[SSR Auth] Result: { data: { user: { role: 'super_admin' } }, error: null }
[Comic Auth] User role: super_admin Allowed roles: ['super_admin', 'admin', 'comic_admin']
```

**Session 读取成功且权限验证通过**，但仍然触发重定向，说明问题不在服务端。

### 问题 1: Auth 登录页自动跳转逻辑

**文件**: `apps/auth/app/pages/login.vue` (第 29-49 行)

**原始代码**:
```typescript
watchEffect(() => {
  if (error.value)
    return

  if (session.value && !isPending.value) {
    const target = decodeURIComponent(redirectPath.value)
    window.location.href = target // 立即跳转
  }
})
```

**问题**:
- `watchEffect` 在每次依赖变化时都会触发
- 没有检查目标页面是否就是当前页面
- 没有防抖机制，可能连续触发多次跳转

### 问题 2: Comic/Movie 客户端中间件 Session 读取

**文件**:
- `apps/comic/app/middleware/auth.global.ts` (第 25-27 行)
- `apps/movie/app/middleware/auth.global.ts` (第 25-27 行)

**原始代码**:
```typescript
else {
  const session = useSession()
  sessionData = session.value.data  // ⚠️ 直接读取响应式状态
}
```

**问题**:
- `useSession()` 返回的是响应式 Ref，可能在客户端路由切换时包含过期数据
- 没有主动触发 Session 刷新
- 当从登录页跳转回 Comic 时，客户端可能读取到旧的 `null` 状态

---

## 修复方案

### 修复 1: Auth 登录页防止循环跳转

**文件**: `apps/auth/app/pages/login.vue`

**修改内容**:
```typescript
// 添加防抖机制
let redirectTimer: NodeJS.Timeout | null = null

watchEffect(() => {
  if (error.value)
    return

  // ✅ 检查是否已在目标页面
  if (session.value && !isPending.value && redirectPath.value !== '/auth/login') {
    const target = decodeURIComponent(redirectPath.value)

    // ✅ 避免重定向到自己
    if (target === window.location.pathname || target === '/auth/login') {
      console.log('[Login] Already on target page, skipping redirect')
      return
    }

    console.log('[Login] Session detected, redirecting to:', target)

    // ✅ 清除之前的定时器
    if (redirectTimer) {
      clearTimeout(redirectTimer)
    }

    // ✅ 延迟跳转（100ms），避免多次触发
    redirectTimer = setTimeout(() => {
      window.location.href = target
    }, 100)
  }
})
```

**效果**:
- 避免重定向到自己
- 防抖机制防止连续触发
- 只在必要时跳转

---

### 修复 2: Comic/Movie 客户端主动获取 Session

**文件**:
- `apps/comic/app/middleware/auth.global.ts`
- `apps/movie/app/middleware/auth.global.ts`

**修改内容**:
```typescript
else {
  // ✅ 客户端：主动获取 Session，而不是依赖响应式状态
  console.log('[CSR Auth] Fetching session on client side')

  try {
    const { data, error } = await authClient.getSession()  // ✅ 主动调用 API
    console.log('[CSR Auth] Result:', { data, error })
    sessionData = data
  }
  catch (e) {
    console.error('[CSR Auth] Exception:', e)
  }
}
```

**效果**:
- 每次路由切换都会主动获取最新的 Session
- 不依赖 `useSession()` 的响应式状态
- 确保客户端读取到正确的登录信息

---

## 预期行为

修复后的正常流程：

1. **未登录访问 Comic**
   ```
   GET /comic/ → 302 → /auth/login?redirect=/comic/
   ```

2. **登录成功**
   ```
   GitHub OAuth 回调 → Session 创建 → Cookie 设置
   ```

3. **自动跳转回 Comic**
   ```
   /auth/login 检测到 Session → 跳转到 /comic/
   ```

4. **Comic 中间件验证**
   ```
   客户端主动获取 Session → 权限验证通过 → 显示内容
   ```

5. **后续访问**
   ```
   直接访问 /comic/ → 中间件读取 Session → 显示内容（无需跳转）
   ```

---

## 测试步骤

1. **清除浏览器 Cookie**
   - F12 → Application → Cookies → Clear All

2. **访问 Comic**
   ```
   http://localhost:8080/comic/
   ```
   - ✅ 应重定向到登录页

3. **完成 GitHub 登录**
   - ✅ 应自动返回 Comic 首页
   - ✅ 不应出现循环跳转

4. **刷新页面**
   - ✅ 应直接显示内容（不跳转登录）

5. **跨应用测试**
   ```
   /blog/ → /comic/ → /movie/ → /dashboard/
   ```
   - ✅ 所有跳转都应保持登录状态

---

## 调试日志

修复后应看到以下日志顺序：

### 初次访问 Comic (未登录)
```
[SSR Auth] Fetching session with headers: { cookie: '' }
[SSR Auth] Result: { data: null, error: null }
// → 302 重定向到 /auth/login
```

### 登录成功后
```
[Login] Session detected, redirecting to: /comic/
// → window.location.href = '/comic/'
```

### Comic 客户端验证
```
[CSR Auth] Fetching session on client side
[CSR Auth] Result: { data: { user: { role: 'super_admin' } }, error: null }
[Comic Auth] User role: super_admin Allowed roles: ['super_admin', 'admin', 'comic_admin']
// → 显示内容
```

### 后续访问 (已登录)
```
[SSR Auth] Fetching session with headers: { cookie: 'starye.session_token=...' }
[SSR Auth] Result: { data: { user: { role: 'super_admin' } }, error: null }
[Comic Auth] User role: super_admin Allowed roles: ['super_admin', 'admin', 'comic_admin']
// → 直接显示内容（无跳转）
```

---

## 相关文件

| 文件 | 修改内容 |
|------|---------|
| `apps/auth/app/pages/login.vue` | 增加防抖和目标检查 |
| `apps/comic/app/middleware/auth.global.ts` | 客户端主动获取 Session |
| `apps/movie/app/middleware/auth.global.ts` | 客户端主动获取 Session |

---

## 下一步

等待 Nuxt 应用重新编译后，请测试：

1. ✅ 清除 Cookie → 访问 `/comic/` → 应重定向到登录
2. ✅ 登录成功 → 应自动返回 `/comic/` 且**不再循环**
3. ✅ 刷新页面 → 应直接显示内容
4. ✅ 跨应用跳转 → 所有应用保持登录状态

如果仍有问题，请提供新的日志或错误截图！
