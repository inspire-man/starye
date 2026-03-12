## 1. 创建环境变量配置文件

- [x] 1.1 在项目根目录创建 `.env.example` 文件，包含 `VITE_API_URL=http://localhost:8080` 等本地开发配置
- [x] 1.2 验证 `.gitignore` 已包含 `.env` 和 `.env.local`，确保敏感配置不被提交

## 2. 修复 Blog 应用配置

- [x] 2.1 修改 `apps/blog/app/lib/auth-client.ts`，统一 apiUrl 为 `import.meta.env.VITE_API_URL || 'http://localhost:8080'`
- [x] 2.2 修改 `apps/blog/nuxt.config.ts`，将 `runtimeConfig.public.apiUrl` 的 fallback 改为 `http://localhost:8080`
- [x] 2.3 删除 `apps/blog/nuxt.config.ts` 的 `routeRules: { '/login': { redirect: '/auth/login' } }`
- [x] 2.4 修改 `apps/blog/app/layouts/default.vue`，将登录链接改为 `<a :href="/auth/login?redirect=...">Login</a>`

## 3. 修复 Comic 应用配置

- [x] 3.1 修改 `apps/comic/app/lib/auth-client.ts`，统一 apiUrl fallback 为 `http://localhost:8080`
- [x] 3.2 修改 `apps/comic/nuxt.config.ts`，将 `runtimeConfig.public.apiUrl` 的 fallback 改为 `http://localhost:8080`
- [x] 3.3 验证 `apps/comic/app/middleware/auth.global.ts` 的 authClient 调用逻辑正确

## 4. 修复 Movie 应用配置

- [x] 4.1 修改 `apps/movie/app/lib/auth-client.ts`，统一 apiUrl fallback 为 `http://localhost:8080`
- [x] 4.2 修改 `apps/movie/nuxt.config.ts`，将 `runtimeConfig.public.apiUrl` 的 fallback 改为 `http://localhost:8080`
- [x] 4.3 验证 `apps/movie/app/middleware/auth.global.ts` 的 authClient 调用逻辑正确

## 5. 修复 Auth 应用配置

- [x] 5.1 修改 `apps/auth/app/lib/auth-client.ts`，统一 apiUrl fallback 为 `http://localhost:8080`
- [x] 5.2 修改 `apps/auth/nuxt.config.ts`，将 `runtimeConfig.public.apiUrl` 的 fallback 改为 `http://localhost:8080`

## 6. 修复 Dashboard 应用配置

- [x] 6.1 修改 `apps/dashboard/src/lib/auth-client.ts`，统一 apiUrl fallback 为 `http://localhost:8080`
- [x] 6.2 验证 dashboard 的 Vite 配置无硬编码的生产环境地址

## 7. 验证 API 鉴权配置

- [x] 7.1 检查 `apps/api/src/lib/auth.ts` 的 Cookie 配置，确认本地开发时 `domain: undefined`, `sameSite: 'lax'`, `path: '/'`
- [x] 7.2 检查 `apps/api/src/config.ts` 的 `getAllowedOrigins` 包含 `http://localhost:8080`

## 8. 创建本地开发文档

- [x] 8.1 在项目根目录创建或更新 `README.md`，添加「本地开发」章节
- [x] 8.2 文档说明服务启动顺序：Gateway (8080) → API (8787) → 其他 apps
- [x] 8.3 文档说明端口映射和正确的访问地址（通过 `http://localhost:8080/blog/` 等访问）
- [x] 8.4 文档添加常见问题排查章节（登录 404、无限重定向、Cookie 无法共享）

## 9. 本地测试验证和调试修复

- [x] 9.1 启动 Gateway 和 API，验证 `http://localhost:8080/api/health` 正常响应
- [x] 9.2 修复 Blog 登录跳转 404 问题 (修改 layout 登录链接)
- [x] 9.3 修复 Auth 登录页面 "Cannot read properties of undefined" 错误
- [x] 9.4 修复 Comic/Movie 403 Forbidden 问题 (临时禁用 API 权限检查)
- [x] 9.5 修复 Comic/Movie 无限重定向问题 (临时禁用前端权限中间件)
- [x] 9.6 自动化测试所有应用页面加载 (Blog/Comic/Movie 均返回 200 OK)
- [x] 9.7 验证 API 接口正常响应 (comics 和 movies API 均返回 200)
- [x] 9.8 创建测试总结文档 (`test-summary.md`)

## 10. 代码审查和优化

- [x] 10.1 运行 `pnpm lint` 检查所有修改的文件是否符合 ESLint 规范
- [x] 10.2 检查所有 `auth-client.ts` 的代码风格一致性
- [x] 10.3 验证所有 console.log 是否使用 `eslint-disable-next-line` 注释（如果是调试日志）
- [x] 10.4 提交代码前运行 `git diff` 确认所有修改符合预期

## 后续待办（不在本次 Change 范围内）

以下任务已在实施过程中完成，不再需要手动操作：

- [x] 恢复 API 端的 `requireAuth` 权限中间件（已完成，支持 super_admin）
- [x] 恢复前端 Comic/Movie 的完整鉴权中间件（已完成）
- [x] 设置测试用户为 super_admin（已完成：1140762316@qq.com）
- [ ] 在 Dashboard 中实现用户角色管理功能（未来功能，新 Change）

## 额外修复（实施过程中发现）

- [x] 11.1 修复 Auth 登录页无限重定向（增加防抖和目标检查）
- [x] 11.2 修复 Comic/Movie 客户端 Session 读取（主动获取而非响应式）
- [x] 11.3 修复 Dashboard 无限重定向（移除路径重写冲突）
- [x] 11.4 修复所有应用的登出功能（使用 signOut() SDK）
- [x] 11.5 修正 Gateway 端口配置（Movie/Comic/Auth 端口）
- [x] 11.6 修复 Blog Button 组件未导入问题
