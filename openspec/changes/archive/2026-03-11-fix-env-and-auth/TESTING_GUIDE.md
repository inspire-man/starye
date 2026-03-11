# 项目间登录状态同步测试指南

## 测试环境准备

### 1. 数据库配置
✅ **已完成** - 您的账号 `1140762316@qq.com` 已设置为 `super_admin`

### 2. 启动所有服务

请按以下顺序启动服务：

```bash
# 1. 启动 Gateway (端口 8080)
cd apps/gateway
pnpm dev

# 2. 启动 API (端口 8787)
cd apps/api
pnpm dev

# 3. 启动 Auth (端口 3005)
cd apps/auth
pnpm dev

# 4. 启动 Blog (端口 3001)
cd apps/blog
pnpm dev

# 5. 启动 Comic (端口 3003)
cd apps/comic
pnpm dev

# 6. 启动 Movie (端口 3004)
cd apps/movie
pnpm dev

# 7. 启动 Dashboard (端口 5173)
cd apps/dashboard
pnpm dev
```

---

## 测试用例

### 🧪 测试 1: 登录功能

1. **清除浏览器所有 Cookie**
   - 打开浏览器开发者工具 (F12)
   - Application → Cookies → 清除所有

2. **访问 Auth 应用登录**
   ```
   http://localhost:8080/auth/login
   ```
   - ✅ 应显示 "Login with GitHub" 按钮
   - ✅ 点击后跳转到 GitHub OAuth
   - ✅ 授权后返回并设置 Cookie

3. **验证 Cookie 设置**
   - 打开 Application → Cookies → `http://localhost:8080`
   - 应看到 `starye.session_token` Cookie
   - 检查属性:
     - `Path`: `/`
     - `SameSite`: `Lax`
     - `Domain`: (空，表示当前域)

---

### 🔗 测试 2: Blog 应用链接跳转

1. **未登录访问 Blog**
   ```
   http://localhost:8080/blog/
   ```
   - ✅ 应正常显示首页
   - ✅ 应显示 "Login" 按钮（右上角）

2. **点击 Login 按钮**
   - ✅ 应跳转到 `http://localhost:8080/auth/login?redirect=%2Fblog%2F`
   - ✅ 登录成功后应返回 Blog 首页
   - ✅ 应显示用户名 "JX Huang" 和头像

3. **检查登录状态**
   - ✅ 右上角应显示用户信息而不是 Login 按钮
   - ✅ 应可以正常浏览文章

---

### 🎭 测试 3: Comic 应用权限验证

1. **已登录访问 Comic**
   ```
   http://localhost:8080/comic/
   ```
   - ✅ 应正常显示漫画列表（因为您是 super_admin）
   - ✅ 浏览器控制台应输出:
     ```
     [SSR Auth] Fetching session with headers: { cookie: '...' }
     [Comic Auth] User role: super_admin Allowed roles: ['super_admin', 'admin', 'comic_admin']
     ```

2. **未登录访问 Comic (新无痕窗口)**
   - 打开新的无痕窗口
   - 访问 `http://localhost:8080/comic/`
   - ✅ 应重定向到 `http://localhost:8080/auth/login?redirect=%2Fcomic%2F`

3. **API 权限验证**
   - 打开 Network 面板
   - 刷新 Comic 页面
   - 查看 `GET /api/comics?limit=12` 请求
   - ✅ 已登录: 应返回 `200 OK`
   - ✅ 未登录: 应返回 `403 Forbidden`

---

### 🎬 测试 4: Movie 应用权限验证

1. **已登录访问 Movie**
   ```
   http://localhost:8080/movie/
   ```
   - ✅ 应正常显示电影列表（因为您是 super_admin）
   - ✅ 应显示 4 部电影（根据数据库）

2. **检查 Session 共享**
   - 从 Blog → Comic → Movie 切换
   - ✅ 所有应用都应显示登录状态
   - ✅ 无需重新登录

---

### 📊 测试 5: Dashboard 应用

1. **访问 Dashboard**
   ```
   http://localhost:8080/dashboard/
   ```
   - ✅ 应正常显示管理后台
   - ✅ 应显示用户信息

2. **功能测试**
   - ✅ 可以查看文章列表
   - ✅ 可以编辑文章

---

### 🔄 测试 6: 跨应用跳转

1. **Blog → Comic**
   - 在 Blog 中创建链接: `<a href="/comic/">去看漫画</a>`
   - 点击链接
   - ✅ 应直接进入 Comic，无需重新登录

2. **Comic → Movie**
   - 在 Comic 中创建链接: `<a href="/movie/">去看电影</a>`
   - 点击链接
   - ✅ 应直接进入 Movie，无需重新登录

3. **任意应用 → Dashboard**
   - 访问 `http://localhost:8080/dashboard/`
   - ✅ 应直接进入 Dashboard

---

### 🚪 测试 7: 登出功能

1. **从任意应用登出**
   - 调用登出接口（如果有）
   - 或清除浏览器 Cookie

2. **验证登出状态**
   - 刷新 Blog: ✅ 应显示 Login 按钮
   - 访问 Comic: ✅ 应重定向到登录页
   - 访问 Movie: ✅ 应重定向到登录页
   - 访问 Dashboard: ✅ 应重定向到登录页

---

## 预期测试结果汇总

| 测试项 | 未登录 | 已登录 (super_admin) |
|--------|--------|---------------------|
| **Blog** | ✅ 可访问，显示 Login | ✅ 显示用户信息 |
| **Comic** | ❌ 302 → /auth/login | ✅ 显示漫画列表 |
| **Movie** | ❌ 302 → /auth/login | ✅ 显示电影列表 |
| **Dashboard** | ❌ 302 → /auth/login | ✅ 显示管理后台 |
| **Auth** | ✅ 显示登录页 | ✅ 自动跳转 |

| API 端点 | 未登录 | 已登录 (super_admin) |
|----------|--------|---------------------|
| `/api/comics` | ❌ 403 Forbidden | ✅ 200 OK |
| `/api/movies` | ⚠️ 200 (但 R18 内容隐藏) | ✅ 200 OK (完整数据) |
| `/api/posts` | ✅ 200 OK | ✅ 200 OK |

---

## 常见问题排查

### 问题 1: Cookie 未设置
**症状**: 登录后仍显示未登录状态

**检查**:
1. 浏览器开发者工具 → Application → Cookies
2. 确认 `starye.session_token` 存在
3. 确认 `Path` 为 `/`，`SameSite` 为 `Lax`

**解决**:
- 检查 `apps/api/src/lib/auth.ts` 的 Cookie 配置
- 确认本地开发时 `domain: undefined`

---

### 问题 2: CORS 错误
**症状**: 控制台显示 CORS policy blocked

**检查**:
1. `apps/api/src/config.ts` 的 `getAllowedOrigins`
2. 应包含 `http://localhost:8080`

**解决**:
```typescript
export function getAllowedOrigins(env: Env): string[] {
  return [
    env.WEB_URL,
    env.ADMIN_URL,
    'http://localhost:8080', // 确保存在
  ]
}
```

---

### 问题 3: 权限不足
**症状**: 访问 Comic/Movie 显示 "insufficient_permissions"

**检查**:
1. 数据库中用户的 `role` 字段
2. 应为 `super_admin`

**解决**:
```sql
-- 在 apps/api 目录下执行
npx wrangler d1 execute starye-db --local --command "UPDATE user SET role = 'super_admin' WHERE email = '1140762316@qq.com'"
```

---

### 问题 4: Session 未读取
**症状**: 中间件日志显示 `sessionData: null`

**检查**:
1. 中间件是否正确传递 Cookie
2. API 是否正确验证 Session

**解决**:
- 查看浏览器 Network 面板
- 确认 `/api/auth/get-session` 请求携带 Cookie
- 确认响应返回有效的 user 数据

---

## 自动化测试脚本

如果您想快速验证核心功能，可以使用以下脚本：

```javascript
// 在浏览器控制台执行
(async () => {
  // 测试 Blog
  const blog = await fetch('http://localhost:8080/blog/');
  console.log('Blog:', blog.status === 200 ? '✅' : '❌');

  // 测试 Comic (已登录)
  const comic = await fetch('http://localhost:8080/comic/');
  console.log('Comic:', comic.status === 200 ? '✅ 已登录' : (comic.status === 302 ? '❌ 未登录' : '❌ 错误'));

  // 测试 Movie (已登录)
  const movie = await fetch('http://localhost:8080/movie/');
  console.log('Movie:', movie.status === 200 ? '✅ 已登录' : (movie.status === 302 ? '❌ 未登录' : '❌ 错误'));

  // 测试 Session API
  const session = await fetch('http://localhost:8080/api/auth/get-session');
  const data = await session.json();
  console.log('Session:', data.user ? `✅ ${data.user.name} (${data.user.role})` : '❌ 未登录');
})();
```

---

## 测试完成清单

请按以下顺序测试并勾选：

- [ ] 1. 清除 Cookie 并访问登录页
- [ ] 2. 完成 GitHub OAuth 登录
- [ ] 3. 验证 Cookie 正确设置
- [ ] 4. Blog 显示登录状态
- [ ] 5. Comic 正常访问（super_admin）
- [ ] 6. Movie 正常访问（super_admin）
- [ ] 7. Dashboard 正常访问
- [ ] 8. 跨应用跳转无需重新登录
- [ ] 9. 新无痕窗口访问 Comic/Movie 重定向到登录
- [ ] 10. API 权限验证正确（已登录 200，未登录 403）

---

## 测试报告模板

测试完成后，请记录结果：

```
测试时间: 2026-03-11
测试人员: 您的名字
浏览器: Chrome/Firefox/Edge
账号: 1140762316@qq.com
角色: super_admin

测试结果:
✅ 所有应用正常访问
✅ 登录状态在所有应用间同步
✅ 权限验证正确
⚠️ 发现问题: (如有)

备注:
(其他观察到的问题或建议)
```

---

## 下一步

测试完成后，您可以：

1. **提交代码**: 所有修改已完成，可以提交到 Git
2. **部署到生产**: 确认本地测试无误后部署
3. **创建新 Change**: 如需添加新功能（如角色管理 UI）

祝测试顺利！🚀
