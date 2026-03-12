# Proposal: 修复生产环境认证配置与 i18n 问题

## Why

生产环境部署后，用户访问 `https://starye.org/blog` 并尝试登录时，出现以下关键错误：

1. **API 请求失败**：前端仍在访问 `http://localhost:8080/api/auth/*`，导致 `ERR_CONNECTION_REFUSED`
2. **i18n 文件 404**：`/auth/_i18n/1KCE19of/zh/messages.json` 无法加载，国际化功能失效
3. **环境变量未生效**：`NUXT_PUBLIC_API_URL` 在生产构建中未被正确读取

**核心问题**：现有的环境变量配置策略在 Cloudflare Pages 部署后未能正确传递到客户端运行时，导致应用仍使用开发环境的 localhost 配置。

**为什么现在修复**：这是阻塞所有生产用户登录的 P0 级问题，必须立即修复。

---

## What Changes

### 前端配置修复

- 为所有 Nuxt 应用（blog, comic, movie, auth）添加生产环境变量配置
- 修复 `runtimeConfig.public.apiUrl` 的读取逻辑，确保 Cloudflare Pages 环境变量正确注入
- 在构建时替换 API URL（`__API_URL__` 占位符或 Vite `define`）

### i18n 配置修复

- 检查 Auth 应用的 `nuxt-i18n` 配置，确保翻译文件正确打包到 `dist/`
- 修复 `langDir` 路径配置，使其在 SSG 模式下也能正确解析
- 如果必要，切换到内联翻译（`messages` 选项）而非外部文件

### Cloudflare Pages 部署配置

- **MUST** 在 `.github/workflows/deploy-*.yml` 中为每个应用添加 `NUXT_PUBLIC_API_URL` 环境变量
- 确认 `wrangler pages deploy` 使用 `--env production` 标志
- 验证 `wrangler.toml` 或部署脚本中的环境变量传递

### 环境变量标准化

- 统一所有应用的 API URL 配置方式：
  - 开发环境：`http://localhost:8080`（网关代理）
  - 生产环境：`https://starye.org`（Cloudflare Pages）
- 在 `nuxt.config.ts` 中使用 `process.env.NUXT_PUBLIC_API_URL || process.env.API_URL || 'https://starye.org'` 的降级策略

### 文档更新

- 更新 `README.md`，明确说明生产环境变量配置要求
- 在 `.env.example` 中添加 `NUXT_PUBLIC_API_URL` 示例
- 创建 `DEPLOYMENT.md` 文档，说明 Cloudflare Pages 部署的环境变量配置步骤

---

## Capabilities

### New Capabilities

- `production-env-config`: 生产环境环境变量配置系统
  - Cloudflare Pages 部署时的环境变量注入
  - Nuxt `runtimeConfig` 的正确使用模式
  - 构建时环境变量替换机制

- `i18n-production-fix`: i18n 国际化在生产环境的修复
  - Nuxt i18n 插件在 SSG 模式下的正确配置
  - 翻译文件的打包和路径解析
  - 降级方案（内联翻译 vs 外部文件）

### Modified Capabilities

- `auth-client-config`: 现有认证客户端配置
  - **变更**：从硬编码 localhost 改为动态读取环境变量
  - **变更**：增加生产环境的 API URL 降级逻辑

---

## Impact

### 受影响的文件

**Nuxt 配置（4 个应用）**:
- `apps/blog/nuxt.config.ts`
- `apps/comic/nuxt.config.ts`
- `apps/movie/nuxt.config.ts`
- `apps/auth/nuxt.config.ts`

**Auth 客户端（5 个应用）**:
- `apps/blog/app/lib/auth-client.ts`
- `apps/comic/app/lib/auth-client.ts`
- `apps/movie/app/lib/auth-client.ts`
- `apps/auth/app/lib/auth-client.ts`
- `apps/dashboard/src/lib/auth-client.ts`

**CI/CD 部署文件（3 个）**:
- `.github/workflows/deploy-blog.yml`
- `.github/workflows/deploy-comic.yml`
- `.github/workflows/deploy-auth.yml`

**文档**:
- `README.md`
- `.env.example`
- `DEPLOYMENT.md`（新建）

### 受影响的系统

- **Cloudflare Pages**: 需要在项目设置中配置环境变量
- **GitHub Actions**: 需要添加 `NUXT_PUBLIC_API_URL` secret
- **本地开发**: 不受影响（已有 `.env` 配置）

### 破坏性变更

无破坏性变更。本次修复是纯配置层面的改动，不影响 API 接口或数据结构。

---

## Non-Goals（非目标）

- ❌ 不涉及 better-auth 本身的配置修改
- ❌ 不涉及 Gateway 代理逻辑的变更
- ❌ 不涉及数据库 schema 或 API 端点的修改
- ❌ 不涉及 i18n 翻译内容的更新（仅修复加载机制）

---

## Risks（风险）

### 高风险

- **环境变量注入时机**：Cloudflare Pages 的环境变量在构建时注入还是运行时注入？需要实验验证。
  - **缓解**：先在本地模拟生产构建（`pnpm build && pnpm preview`）测试

### 中风险

- **i18n 文件路径问题**：SSG 模式下文件路径解析可能与 SSR 不同
  - **缓解**：优先使用内联翻译（`messages` 选项），避免外部文件依赖

### 低风险

- **缓存问题**：Cloudflare Pages 可能缓存旧的构建产物
  - **缓解**：部署后手动清理缓存（Cloudflare Dashboard → Pages → Deployments → Purge Cache）

---

## Milestones（里程碑）

### M1: 问题诊断与本地验证（1 天）
- [ ] 本地模拟生产构建，复现问题
- [ ] 确认 `nuxt.config.ts` 中 `runtimeConfig` 的读取逻辑
- [ ] 确认 i18n 插件配置和翻译文件路径

### M2: 配置修复与测试（1 天）
- [ ] 修改所有 Nuxt 应用的环境变量配置
- [ ] 修复 i18n 配置（内联或路径修复）
- [ ] 本地测试生产构建（`pnpm build && pnpm preview`）

### M3: CI/CD 更新与部署（0.5 天）
- [ ] 更新 GitHub Actions workflows，添加环境变量
- [ ] 在 Cloudflare Pages 控制台配置环境变量
- [ ] 触发重新部署，验证修复

### M4: 文档与清理（0.5 天）
- [ ] 更新 README 和 DEPLOYMENT.md
- [ ] 清理临时测试代码
- [ ] 归档变更

---

## Success Criteria（成功标准）

### MUST（必须满足）

1. **SHALL** 生产环境 (`https://starye.org`) 访问任意应用（blog/comic/movie）后，点击登录能正确跳转到 `https://starye.org/auth/login`
2. **SHALL** Auth 登录页面不再出现 `ERR_CONNECTION_REFUSED` 错误
3. **SHALL** Auth 登录页面不再出现 i18n 文件 404 错误
4. **SHALL** 登录成功后能正确跳转回原应用（如 `/blog/`）

### SHOULD（应该满足）

- 本地开发环境不受影响，仍使用 `localhost:8080`
- 所有应用的环境变量配置统一，易于维护
- 文档清晰说明生产部署的环境变量配置步骤

---

## Alternatives Considered（备选方案）

### 方案 A：使用 Vite `define` 在构建时替换
**优点**：零运行时开销，构建产物直接包含正确 URL  
**缺点**：需要每次部署都重新构建，无法动态修改  
**决策**：不采用，Cloudflare Pages 每次部署都会重新构建，且 Nuxt `runtimeConfig` 已是最佳实践

### 方案 B：在 Gateway 层统一处理
**优点**：前端无需关心环境差异  
**缺点**：Gateway 无法拦截客户端直接请求的 API（CORS 问题）  
**决策**：不采用，前端必须知道正确的 API URL

### 方案 C：将所有翻译文件内联到 JS 中
**优点**：彻底解决 i18n 文件加载问题  
**缺点**：增加初始 JS 体积  
**决策**：作为 i18n 修复的优先方案，仅 Auth 应用有少量翻译，影响可控
