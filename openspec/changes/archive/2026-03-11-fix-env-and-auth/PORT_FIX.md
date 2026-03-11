# Gateway 端口配置错误修复

## 问题描述

控制台频繁出现以下错误：

1. **CSS MIME type 错误**:
```
Refused to apply style from 'http://localhost:8080/blog/_nuxt/app/assets/css/main.css' 
because its MIME type ('application/json') is not a supported stylesheet MIME type
```

2. **Vue 组件解析失败**:
```
[Vue warn]: Failed to resolve component: Button
```

3. **频繁的 304 请求**:
```
gateway:dev: [wrangler:info] GET /blog/_nuxt/builds/meta/dev.json 304 Not Modified
```

---

## 根本原因分析

### 问题 1: Gateway 端口配置错误

**文件**: `apps/gateway/src/index.ts`

**错误配置**:
```typescript
// 第 47 行
const target = isLocal ? 'http://localhost:3001' : ...  // ❌ Movie 应该是 3004

// 第 56 行
const target = isLocal ? 'http://localhost:3000' : ...  // ❌ Comic 应该是 3003

// 第 65 行
const target = isLocal ? 'http://localhost:3003' : ...  // ❌ Auth 应该是 3005
```

**问题**:
- Movie 配置为 `3001`，实际运行在 `3004`
- Comic 配置为 `3000`，实际运行在 `3003`
- Auth 配置为 `3003`，实际运行在 `3005`

**后果**:
1. 请求被路由到错误的端口
2. 错误的应用返回 JSON 或其他格式的响应
3. CSS 文件被当作 JSON 返回，导致 MIME type 错误
4. 页面无法正常渲染

### 问题 2: Blog 页面使用未导入的 Button 组件

**文件**: `apps/blog/app/pages/index.vue` (第 69 行)

**错误代码**:
```vue
<Button @click="refresh">Try Again</Button>
```

**问题**:
- 使用了 `<Button>` 组件但没有导入
- Vue 无法解析组件，导致警告

---

## 修复方案

### 修复 1: 更正 Gateway 端口配置

**文件**: `apps/gateway/src/index.ts`

**修复内容**:
```typescript
// 3. Movie App
if (path.startsWith('/movie')) {
  const target = isLocal ? 'http://localhost:3004' : ...  // ✅ 修正为 3004
  return proxy(request, target)
}

// 4. Comic App
if (path.startsWith('/comic')) {
  const target = isLocal ? 'http://localhost:3003' : ...  // ✅ 修正为 3003
  return proxy(request, target)
}

// 5. Auth Service
if (path.startsWith('/auth')) {
  const target = isLocal ? 'http://localhost:3005' : ...  // ✅ 修正为 3005
  return proxy(request, target)
}
```

**正确的端口映射**:

| 应用 | 端口 | Gateway 路径 |
|------|------|-------------|
| Gateway | 8080 | - |
| API | 8787 | `/api` |
| Blog | 3002 | `/blog` (默认) |
| Comic | 3003 | `/comic` |
| Movie | 3004 | `/movie` |
| Auth | 3005 | `/auth` |
| Dashboard | 5173 | `/dashboard` |

---

### 修复 2: 替换 Button 为原生 button

**文件**: `apps/blog/app/pages/index.vue`

**修复内容**:
```vue
<!-- 修复前 -->
<Button @click="refresh">Try Again</Button>

<!-- 修复后 -->
<button @click="refresh">Try Again</button>
```

**说明**:
- 使用原生 `<button>` 元素替代未导入的 `<Button>` 组件
- 保留了相同的样式类和点击事件

---

## 预期效果

修复后应该：

### 1. CSS 正确加载
```
✅ GET /blog/_nuxt/app/assets/css/main.css 200 OK
   Content-Type: text/css
```

### 2. 无 Vue 警告
```
✅ 控制台无 "Failed to resolve component: Button" 警告
```

### 3. 所有应用正常访问
```
✅ http://localhost:8080/blog/      → Blog 应用 (端口 3002)
✅ http://localhost:8080/comic/     → Comic 应用 (端口 3003)
✅ http://localhost:8080/movie/     → Movie 应用 (端口 3004)
✅ http://localhost:8080/auth/      → Auth 应用 (端口 3005)
✅ http://localhost:8080/dashboard/ → Dashboard 应用 (端口 5173)
```

---

## 测试步骤

### 1. 等待 Gateway 重新编译

```bash
# Gateway 需要重新编译
# 等待约 5-10 秒
```

### 2. 清除浏览器缓存

```
F12 → Network → Disable cache (勾选)
或
Ctrl+Shift+R (硬刷新)
```

### 3. 测试 Blog 应用

```
http://localhost:8080/blog/
```

**预期**:
- ✅ 页面正常显示
- ✅ CSS 样式正确加载
- ✅ 无 MIME type 错误
- ✅ 无 Button 组件警告

### 4. 测试所有应用

```
http://localhost:8080/comic/     → 应显示漫画列表
http://localhost:8080/movie/     → 应显示电影列表
http://localhost:8080/auth/      → 应显示登录页
http://localhost:8080/dashboard/ → 应显示管理后台
```

**预期**:
- ✅ 所有应用都能正常访问
- ✅ 无端口错误
- ✅ 无 MIME type 错误

---

## 调试日志

修复后，控制台应该看到：

```bash
# Blog 访问
gateway:dev: [wrangler:info] GET /blog/ 200 OK (50ms)
gateway:dev: [wrangler:info] GET /blog/_nuxt/app/assets/css/main.css 200 OK (10ms)

# Comic 访问
gateway:dev: [wrangler:info] GET /comic/ 200 OK (80ms)
gateway:dev: [wrangler:info] GET /comic/_nuxt/app/assets/css/main.css 200 OK (12ms)

# 无错误日志
✅ 无 MIME type 错误
✅ 无 Vue 组件警告
✅ 无 304 循环
```

---

## 相关文件修改

| 文件 | 修改内容 | 原因 |
|------|---------|------|
| `apps/gateway/src/index.ts` | 修正 Movie/Comic/Auth 端口 | 路由到正确的应用 |
| `apps/blog/app/pages/index.vue` | 替换 Button 为 button | 移除未导入的组件 |

---

## 端口配置规范

为避免将来出现类似问题，请参考以下端口配置：

### 开发环境端口分配

```yaml
Gateway:    8080  # 统一入口
API:        8787  # Cloudflare Workers 默认
Blog:       3002  # Nuxt 应用
Comic:      3003  # Nuxt 应用
Movie:      3004  # Nuxt 应用
Auth:       3005  # Nuxt 应用
Dashboard:  5173  # Vite 应用（Vue SPA）
```

### Gateway 路由规则

```typescript
/api         → http://localhost:8787   (API)
/dashboard   → http://localhost:5173   (Dashboard)
/movie       → http://localhost:3004   (Movie)
/comic       → http://localhost:3003   (Comic)
/auth        → http://localhost:3005   (Auth)
/blog (默认) → http://localhost:3002   (Blog)
```

---

## 下一步

修复完成后，请测试：

1. ✅ 所有应用能否正常访问
2. ✅ CSS 样式是否正确加载
3. ✅ 控制台是否无错误和警告
4. ✅ 跨应用跳转是否正常

如果仍有问题，请提供：
- 浏览器控制台的完整错误
- Network 面板的请求详情
- Gateway 和各应用的日志输出
