# Tasks: 生产环境认证配置修复与 CI 升级

## 1. 客户端环境变量修复

- [x] 1.1 修改 `apps/auth/app/lib/auth-client.ts`，将 `process.env.NUXT_PUBLIC_API_URL` 改为 `import.meta.env.VITE_API_URL`
- [x] 1.2 修改 `apps/comic/app/lib/auth-client.ts`，将 `process.env.NUXT_PUBLIC_API_URL` 改为 `import.meta.env.VITE_API_URL`
- [x] 1.3 检查 `apps/blog/app/lib/auth-client.ts`，确认已使用 `import.meta.env.VITE_API_URL`（无需修改）
- [x] 1.4 检查 `apps/movie/app/lib/auth-client.ts`，确认已使用 `import.meta.env.VITE_API_URL`（无需修改）
- [x] 1.5 检查 `apps/dashboard/src/lib/auth-client.ts`，确认已使用 `import.meta.env.VITE_API_URL`（无需修改）

## 2. i18n 配置修复

- [x] 2.1 修改 `apps/auth/nuxt.config.ts`，从 `modules` 数组中移除 `'@nuxtjs/i18n'`
- [x] 2.2 修改 `apps/auth/nuxt.config.ts`，删除 `i18n` 配置对象
- [x] 2.3 修改 `apps/auth/nuxt.config.ts`，从 `vite.optimizeDeps.exclude` 中移除 `'@starye/locales'`（如有）

## 3. GitHub Actions 环境变量修复

- [x] 3.1 修改 `.github/workflows/deploy-auth.yml`，将构建步骤的 `NUXT_PUBLIC_API_URL` 改为 `VITE_API_URL`
- [x] 3.2 检查 `.github/workflows/deploy-blog.yml`，确认已使用 `VITE_API_URL`（无需修改）
- [x] 3.3 检查 `.github/workflows/deploy-comic.yml`，确认已使用 `VITE_API_URL`（无需修改）

## 4. GitHub Actions Node.js 24 升级

- [x] 4.1 修改 `.github/workflows/deploy-auth.yml`，将 `node-version: 20` 改为 `node-version: 24`
- [x] 4.2 修改 `.github/workflows/deploy-blog.yml`，将 `node-version: 20` 改为 `node-version: 24`
- [x] 4.3 修改 `.github/workflows/deploy-comic.yml`，将 `node-version: 20` 改为 `node-version: 24`
- [x] 4.4 修改 `.github/workflows/deploy-movie.yml`（如有），将 `node-version: 20` 改为 `node-version: 24`
- [x] 4.5 修改 `.github/workflows/deploy-dashboard.yml`（如有），将 `node-version: 20` 改为 `node-version: 24`
- [x] 4.6 修改 `.github/workflows/daily-manga-crawl.yml`，将 `node-version: 20` 改为 `node-version: 24`
- [x] 4.7 检查其他 workflows（如 `ci.yml`），确保所有 workflow 使用 `node-version: 24`

## 5. 本地验证

- [x] 5.1 运行 TypeScript 类型检查：`pnpm type-check`，确认无类型错误
- [ ] 5.2 本地模拟生产构建 Auth 应用：`cd apps/auth && VITE_API_URL=https://starye.org pnpm generate`
- [ ] 5.3 检查 Auth 构建产物：`grep -r "localhost:8080" apps/auth/dist/`，确认无匹配结果（除注释）
- [ ] 5.4 检查 Auth 构建产物：`grep -r "starye.org" apps/auth/dist/`，确认包含 `https://starye.org`
- [ ] 5.5 启动 Auth 预览服务器：`cd apps/auth && pnpm preview`，访问 `http://localhost:4173/auth/login`
- [ ] 5.6 验证 Auth 登录页无控制台错误
- [ ] 5.7 验证 Auth 登录页无 i18n 404 错误
- [ ] 5.8 验证 Auth 登录页网络请求指向正确的 API URL（虽然会失败，但 URL 应为 `https://starye.org`）

## 6. 提交代码

- [x] 6.1 暂存所有修改：`git add .`
- [x] 6.2 提交代码：`git commit -m "fix(auth): 修复生产环境 API URL 和 i18n 配置，升级 CI 到 Node.js 24"`
- [x] 6.3 推送到远程：`git push origin main`

## 7. 监控 GitHub Actions 部署

- [ ] 7.1 监控部署状态：`gh run watch` 或在 GitHub Actions 页面查看
- [ ] 7.2 验证 `deploy-auth.yml` workflow 使用 Node.js 24 执行
- [ ] 7.3 验证 `deploy-auth.yml` workflow 无 "Node.js 20 actions are deprecated" 警告
- [ ] 7.4 验证 Auth 应用构建成功
- [ ] 7.5 验证其他 workflows（如 `daily-manga-crawl.yml`）也使用 Node.js 24

## 8. 生产环境验证

- [ ] 8.1 等待 Cloudflare Pages 部署完成（约 2-3 分钟）
- [ ] 8.2 访问 `https://starye.org/blog`，点击登录按钮
- [ ] 8.3 验证跳转到 `https://starye.org/auth/login`
- [ ] 8.4 打开浏览器控制台（Chrome DevTools），确认无 JavaScript 错误
- [ ] 8.5 验证控制台无 `ERR_CONNECTION_REFUSED` 错误
- [ ] 8.6 验证控制台无 i18n 文件 404 错误（`/_i18n/` 路径）
- [ ] 8.7 打开网络面板（Network），确认 API 请求地址为 `https://starye.org/api/auth/*`
- [ ] 8.8 验证 `GET https://starye.org/api/auth/get-session` 请求状态码为 200 或 401（均正常）
- [ ] 8.9 测试登录流程：点击 "Login with GitHub"，完成 OAuth 授权
- [ ] 8.10 验证登录成功后正确跳转回原始页面（如 `/blog/`）

## 9. 文档更新

- [ ] 9.1 更新 `README.md`，添加生产环境变量配置说明
- [ ] 9.2 更新 `README.md`，添加 Node.js 24 要求说明
- [ ] 9.3 更新 `.env.example`，添加 `VITE_API_URL` 示例和注释
- [ ] 9.4 创建 `DEPLOYMENT.md`，说明 Cloudflare Pages 部署流程
- [ ] 9.5 在 `DEPLOYMENT.md` 中说明环境变量配置步骤
- [ ] 9.6 在 `DEPLOYMENT.md` 中说明常见问题排查方法

## 10. 清理与归档

- [ ] 10.1 删除临时测试文件（如有）
- [ ] 10.2 验证所有 linter 检查通过：`pnpm lint`
- [ ] 10.3 验证所有 TypeScript 类型检查通过：`pnpm type-check`
- [ ] 10.4 创建修复总结文档：`FIX_SUMMARY.md`（如未创建）
- [ ] 10.5 归档变更：`/opsx:archive fix-production-auth-config`（可选）

## 11. 回滚计划（仅在出现问题时执行）

- [ ] 11.1 如生产验证失败，立即回滚：`git revert HEAD && git push origin main`
- [ ] 11.2 如 Node.js 24 导致 CI 问题，临时恢复 `node-version: 20`
- [ ] 11.3 检查回滚后的 GitHub Actions 执行状态
- [ ] 11.4 检查回滚后的生产环境状态
- [ ] 11.5 分析失败原因，更新 design.md 中的风险缓解措施

---

## 验证检查清单

### 代码修改验证

- [ ] 所有 `auth-client.ts` 使用 `import.meta.env.VITE_API_URL`
- [ ] Auth `nuxt.config.ts` 不包含 i18n 配置
- [ ] 所有 workflows 使用 Node.js 24

### 本地测试验证

- [ ] TypeScript 编译无错误
- [ ] 生产构建产物无 `localhost:8080`
- [ ] 生产构建产物包含 `https://starye.org`
- [ ] 预览服务器无控制台错误

### 生产环境验证

- [ ] 登录页正常加载
- [ ] 无 API 连接错误
- [ ] 无 i18n 404 错误
- [ ] 登录流程正常工作

### CI/CD 验证

- [ ] 所有 workflows 使用 Node.js 24
- [ ] 无 Node.js 20 deprecation 警告
- [ ] 所有构建成功完成

### 文档验证

- [ ] README 包含环境变量说明
- [ ] .env.example 包含正确示例
- [ ] DEPLOYMENT.md 存在且完整
