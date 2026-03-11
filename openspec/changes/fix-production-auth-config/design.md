# Design: 生产环境认证配置修复与 CI 升级

## Context

### 背景

项目 `starye` 是一个基于 Cloudflare 生态的全栈应用，包含多个 Nuxt 4 前端应用（blog, comic, movie, auth）和 Cloudflare Workers 后端服务。生产环境部署在 Cloudflare Pages，使用 SSG (Static Site Generation) 模式。

### 当前状态

#### 问题 1: 客户端环境变量访问错误

**现象**:
```
GET http://localhost:8080/api/auth/get-session net::ERR_CONNECTION_REFUSED
```

**根本原因**:
- `apps/auth/app/lib/auth-client.ts` 和 `apps/comic/app/lib/auth-client.ts` 使用了 `process.env.NUXT_PUBLIC_API_URL`
- 在浏览器环境中，`process.env` 不可用（仅在 Node.js 服务端可用）
- 导致 `apiUrl` 始终降级到 `'http://localhost:8080'`

**受影响代码**:
```typescript
// ❌ 错误：process.env 在客户端不可用
const apiUrl = process.env.NUXT_PUBLIC_API_URL || import.meta.env.VITE_API_URL || 'http://localhost:8080'
```

#### 问题 2: GitHub Actions 环境变量不匹配

**现象**:
- 部署脚本设置了 `NUXT_PUBLIC_API_URL: https://starye.org`
- 但 Vite 在构建时无法识别此变量

**根本原因**:
- Vite 构建时读取的是 `import.meta.env.VITE_*` 变量
- `NUXT_PUBLIC_API_URL` 是 Nuxt 的约定，但在纯客户端代码中不生效
- 需要在构建时通过 `VITE_API_URL` 传递

**受影响 Workflow**:
```yaml
# ❌ 错误配置
- name: Build Auth App (SSG)
  env:
    NUXT_PUBLIC_API_URL: https://starye.org  # Vite 无法识别
  run: pnpm --filter starye-auth generate
```

#### 问题 3: 未使用的 i18n 模块

**现象**:
```
GET /auth/_i18n/1KCE19of/zh/messages.json 404 (Not Found)
```

**根本原因**:
- `apps/auth/nuxt.config.ts` 加载了 `@nuxtjs/i18n` 模块
- 配置了 `locales` 但没有提供 `langDir` 或 `messages`
- SSG 构建后，i18n 插件尝试动态加载翻译文件但找不到

**受影响代码**:
```typescript
// ❌ 加载了但无翻译文件
modules: ['@nuxtjs/i18n'],
i18n: {
  locales: [
    { code: 'en', iso: 'en-US', name: 'English' },
    { code: 'zh', iso: 'zh-CN', name: '简体中文' },
  ],
  // 缺少 langDir 或 messages 配置
}
```

#### 问题 4: GitHub Actions Node.js 20 deprecation 警告

**现象**:
```
Node.js 20 actions are deprecated. Actions will be forced to run with Node.js 24 by default starting June 2nd, 2026.
```

**受影响 Actions**:
- `actions/checkout@v4` (支持 Node.js 24)
- `actions/setup-node@v4` (支持 Node.js 24)
- `pnpm/action-setup@v3` (支持 Node.js 24)

**根本原因**:
- 这些 actions 的 v4/v3 版本已支持 Node.js 24
- 需要显式设置 Node.js 24 或等待 2026-06-02 自动切换
- 最佳实践是立即切换，避免未来中断

### 约束条件

1. **客户端环境限制**:
   - 浏览器环境无 `process.env`
   - 必须使用 `import.meta.env` 访问 Vite 环境变量

2. **Cloudflare Pages 限制**:
   - SSG 模式，无服务端运行时
   - 环境变量必须在构建时注入

3. **兼容性要求**:
   - 本地开发环境不受影响（仍使用 `localhost:8080`）
   - 不影响现有 API 接口和数据结构

4. **时间紧迫性**:
   - P0 级问题，阻塞所有生产用户登录
   - 需要快速修复，避免过度设计

---

## Goals / Non-Goals

### Goals

1. ✅ **修复生产环境 API 连接失败**
   - 所有前端应用正确使用 `https://starye.org` 作为 API URL
   - 消除 `ERR_CONNECTION_REFUSED` 错误

2. ✅ **修复 i18n 404 错误**
   - Auth 应用不再尝试加载不存在的翻译文件
   - 保持应用功能完整（Auth 应用实际不使用 i18n）

3. ✅ **统一环境变量配置**
   - 所有应用使用一致的环境变量访问方式
   - 清晰的本地开发 vs 生产环境配置文档

4. ✅ **升级 CI 到 Node.js 24**
   - 所有 GitHub Actions workflows 使用 Node.js 24
   - 消除 deprecation 警告

### Non-Goals

- ❌ 不修改 better-auth 配置
- ❌ 不修改 Gateway 代理逻辑
- ❌ 不涉及数据库或 API 端点变更
- ❌ 不更新 i18n 翻译内容

---

## Decisions

### Decision 1: 客户端统一使用 `import.meta.env.VITE_API_URL`

**选择**: 所有客户端代码（`auth-client.ts`）使用 `import.meta.env.VITE_API_URL`

**理由**:
1. ✅ **正确性**: `import.meta.env` 是 Vite 在客户端访问环境变量的标准方式
2. ✅ **构建时替换**: Vite 在构建时将 `import.meta.env.VITE_*` 替换为实际值
3. ✅ **零运行时开销**: 替换后的代码直接包含硬编码的 URL
4. ✅ **已有先例**: `apps/blog` 和 `apps/movie` 已正确使用此方式

**备选方案 A: 使用 Nuxt `useRuntimeConfig()`**
- ❌ 仅在 Nuxt 组件/composables 中可用
- ❌ 无法在纯 TS 文件（如 `auth-client.ts`）中使用
- **结论**: 不适用于当前场景

**备选方案 B: 使用 `window.__ENV__` 注入**
- ❌ 需要额外的构建脚本
- ❌ 增加复杂度
- ❌ 运行时开销
- **结论**: 过度设计

**实施细节**:
```typescript
// ✅ 正确的客户端代码
import { createAuthClient } from 'better-auth/vue'

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080'

export const authClient = createAuthClient({
  baseURL: `${apiUrl}/api/auth`,
})
```

**受影响文件**:
- `apps/auth/app/lib/auth-client.ts`
- `apps/comic/app/lib/auth-client.ts`
- （`apps/blog` 和 `apps/movie` 已正确，无需修改）

---

### Decision 2: GitHub Actions 使用 `VITE_API_URL` 环境变量

**选择**: 在 GitHub Actions workflows 的构建步骤中设置 `VITE_API_URL=https://starye.org`

**理由**:
1. ✅ **与 Vite 对齐**: Vite 在构建时读取 `VITE_*` 前缀的环境变量
2. ✅ **简单直接**: 无需额外配置或插件
3. ✅ **已有验证**: `deploy-blog.yml` 和 `deploy-comic.yml` 已正确使用

**备选方案 A: 使用 `NUXT_PUBLIC_API_URL`**
- ❌ 在客户端代码中不生效（仅 Nuxt 服务端可用）
- ❌ 导致降级到 `localhost:8080`
- **结论**: 错误的配置（当前问题的根源）

**备选方案 B: 同时设置 `VITE_API_URL` 和 `NUXT_PUBLIC_API_URL`**
- ⚠️ 冗余，增加维护负担
- ⚠️ 可能导致不一致
- **结论**: 不必要

**实施细节**:
```yaml
# ✅ 正确配置
- name: Build Auth App (SSG)
  env:
    VITE_API_URL: https://starye.org
  run: pnpm --filter starye-auth generate
```

**受影响文件**:
- `.github/workflows/deploy-auth.yml` (需修改)
- `.github/workflows/deploy-blog.yml` (已正确)
- `.github/workflows/deploy-comic.yml` (已正确)

---

### Decision 3: 移除 Auth 应用的 i18n 模块

**选择**: 从 `apps/auth/nuxt.config.ts` 中完全移除 `@nuxtjs/i18n` 模块配置

**理由**:
1. ✅ **未使用**: `apps/auth/app/pages/login.vue` 不包含任何 `$t()` 或 `useI18n()` 调用
2. ✅ **彻底解决**: 消除 404 错误的根源
3. ✅ **减少体积**: 不加载不必要的 i18n 插件代码
4. ✅ **简化配置**: 减少配置复杂度

**备选方案 A: 添加内联翻译 `messages`**
- ⚠️ 需要创建翻译内容（Auth 应用无需多语言）
- ⚠️ 增加维护负担
- **结论**: 过度工程

**备选方案 B: 配置 `langDir` 并创建翻译文件**
- ⚠️ 需要创建空的翻译文件
- ⚠️ Auth 应用功能单一，无需多语言
- **结论**: 不必要

**实施细节**:
```typescript
// ❌ 移除前
export default defineNuxtConfig({
  modules: ['@nuxtjs/i18n'],
  i18n: {
    locales: [/* ... */],
    defaultLocale: 'zh',
    // ...
  },
  vite: {
    optimizeDeps: {
      exclude: ['@starye/locales'],  // 也移除
    },
  },
})

// ✅ 移除后
export default defineNuxtConfig({
  // 完全移除 i18n 相关配置
})
```

**验证**:
```bash
# 构建后检查是否还有 i18n 相关请求
grep -r "_i18n" apps/auth/dist/
# 预期：无匹配结果
```

**受影响文件**:
- `apps/auth/nuxt.config.ts`

---

### Decision 4: GitHub Actions 升级到 Node.js 24

**选择**: 所有 GitHub Actions workflows 使用 `node-version: 24`

**理由**:
1. ✅ **官方推荐**: GitHub 将在 2026-06-02 强制切换到 Node.js 24
2. ✅ **提前验证**: 现在切换可及早发现兼容性问题
3. ✅ **消除警告**: 清理 CI 日志，提升开发体验
4. ✅ **性能提升**: Node.js 24 包含性能优化

**备选方案 A: 等待自动切换（2026-06-02）**
- ❌ 可能在关键时刻遇到问题
- ❌ 错过提前验证的机会
- **结论**: 被动且有风险

**备选方案 B: 使用 `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true`**
- ⚠️ 临时解决方案
- ⚠️ 2026-06-02 后仍需移除
- **结论**: 不如直接升级

**实施细节**:
```yaml
# ✅ 所有 workflows 统一修改
- name: Setup Node.js
  uses: actions/setup-node@v4
  with:
    node-version: 24  # 从 20 改为 24
```

**兼容性验证**:
- ✅ `actions/checkout@v4` 已支持 Node.js 24
- ✅ `actions/setup-node@v4` 已支持 Node.js 24
- ✅ `pnpm/action-setup@v3` 已支持 Node.js 24
- ✅ 项目代码使用 TypeScript + ESM，无 Node.js 版本依赖问题

**受影响文件**:
- `.github/workflows/deploy-auth.yml`
- `.github/workflows/deploy-blog.yml`
- `.github/workflows/deploy-comic.yml`
- `.github/workflows/deploy-movie.yml`
- `.github/workflows/deploy-dashboard.yml`
- `.github/workflows/daily-manga-crawl.yml`
- `.github/workflows/ci.yml` (如有)

---

## Risks / Trade-offs

### Risk 1: Vite 环境变量替换时机

**风险**: Vite 在构建时替换 `import.meta.env.VITE_*`，如果构建配置有误，可能导致替换失败。

**影响**: 生产环境仍使用 `localhost:8080`

**缓解措施**:
1. ✅ 本地模拟生产构建验证：
   ```bash
   cd apps/auth
   VITE_API_URL=https://starye.org pnpm generate
   grep -r "localhost:8080" dist/
   # 预期：无匹配结果（除了注释）
   ```

2. ✅ 检查构建产物中的实际 URL：
   ```bash
   cat dist/_nuxt/entry.*.js | grep "starye.org"
   # 预期：找到 https://starye.org
   ```

**概率**: 低（已有 blog 和 comic 验证）

**严重性**: 高（阻塞登录）

**应急方案**: 
- 快速回滚到上一个 commit
- 在 Cloudflare Pages 控制台手动设置环境变量（运行时注入，但 SSG 模式不适用）

---

### Risk 2: i18n 模块移除后的副作用

**风险**: Auth 应用可能在某些代码路径中隐式依赖 i18n 插件（如全局 `$t` 函数）。

**影响**: 应用崩溃或功能异常

**缓解措施**:
1. ✅ 代码审查：
   ```bash
   cd apps/auth/app
   grep -r "\$t\(\\|useI18n\\|t(" .
   # 预期：仅 import 语句，无实际调用
   ```

2. ✅ 本地构建测试：
   ```bash
   pnpm --filter starye-auth generate
   pnpm --filter starye-auth preview
   # 访问 http://localhost:4173/auth/login
   # 验证登录页正常显示和功能
   ```

3. ✅ 浏览器控制台检查：
   - 无 JavaScript 错误
   - 无 `$t is not defined` 错误

**概率**: 极低（已代码审查确认无使用）

**严重性**: 中（仅影响 Auth 应用）

**应急方案**: 
- 恢复 i18n 模块配置
- 添加空的内联 `messages: { en: {}, zh: {} }`

---

### Risk 3: Node.js 24 兼容性问题

**风险**: 项目依赖或构建脚本可能不兼容 Node.js 24。

**影响**: CI 构建失败

**缓解措施**:
1. ✅ 本地测试：
   ```bash
   nvm use 24  # 或使用其他 Node.js 版本管理工具
   pnpm install
   pnpm build
   pnpm test
   # 验证所有命令正常执行
   ```

2. ✅ 依赖检查：
   - 项目使用 TypeScript 5.9 + ESM，无 Node.js 原生模块依赖
   - Cloudflare Workers 运行时基于 V8，不依赖 Node.js 版本
   - Nuxt 4.3 已支持 Node.js 24

3. ✅ 分阶段部署：
   - 先升级非关键 workflow（如 `daily-manga-crawl.yml`）
   - 验证通过后再升级部署 workflows

**概率**: 极低（现代化技术栈，无遗留代码）

**严重性**: 低（仅影响 CI，不影响生产）

**应急方案**: 
- 回滚到 `node-version: 20`
- 设置 `ACTIONS_ALLOW_USE_UNSECURE_NODE_VERSION=true` 临时抑制警告

---

### Trade-off 1: 环境变量硬编码 vs 运行时配置

**Trade-off**: 使用 Vite 构建时替换，URL 硬编码在构建产物中，无法在运行时动态修改。

**优点**:
- ✅ 零运行时开销
- ✅ 无需额外的配置加载逻辑
- ✅ 符合 SSG 模式的最佳实践

**缺点**:
- ❌ 切换环境需要重新构建
- ❌ 无法在 Cloudflare Pages 控制台动态修改

**决策**: 接受此 trade-off，因为：
1. Cloudflare Pages 每次部署都会重新构建
2. 生产环境 URL 不会频繁变更
3. 紧急情况下可通过 GitHub Actions 重新部署

---

### Trade-off 2: i18n 完全移除 vs 保留配置

**Trade-off**: 完全移除 i18n 模块，Auth 应用未来如需多语言需重新配置。

**优点**:
- ✅ 彻底解决当前 404 问题
- ✅ 减少不必要的代码和配置
- ✅ 提升构建速度和运行性能

**缺点**:
- ❌ 未来添加多语言需重新配置
- ❌ 与其他应用（blog, comic）的配置不一致

**决策**: 接受此 trade-off，因为：
1. Auth 应用是统一认证服务，通常单语言即可
2. 如未来需要多语言，重新配置成本不高
3. 保持简单优先于提前设计

---

## Migration Plan

### Phase 1: 本地验证（预计 30 分钟）

**目标**: 确认修复方案在本地环境可行

**步骤**:
1. 修改 `apps/auth/app/lib/auth-client.ts` 和 `apps/comic/app/lib/auth-client.ts`
2. 修改 `apps/auth/nuxt.config.ts`（移除 i18n）
3. 本地模拟生产构建：
   ```bash
   cd apps/auth
   VITE_API_URL=https://starye.org pnpm generate
   pnpm preview
   ```
4. 浏览器访问 `http://localhost:4173/auth/login`
5. 验证：
   - ✅ 无控制台错误
   - ✅ 无 i18n 404 错误
   - ✅ 检查网络请求，确认 API URL 为 `https://starye.org`（虽然会失败，但 URL 正确）

**回滚计划**: `git checkout .`

---

### Phase 2: CI/CD 配置更新（预计 15 分钟）

**目标**: 更新 GitHub Actions workflows

**步骤**:
1. 修改 `.github/workflows/deploy-auth.yml`：
   - 将 `NUXT_PUBLIC_API_URL` 改为 `VITE_API_URL`
   - 将 `node-version: 20` 改为 `node-version: 24`

2. 修改其他 workflows（`deploy-blog.yml`, `deploy-comic.yml`, `deploy-movie.yml`, `deploy-dashboard.yml`, `daily-manga-crawl.yml`）：
   - 将 `node-version: 20` 改为 `node-version: 24`

**回滚计划**: Git revert commit

---

### Phase 3: 提交并触发部署（预计 10 分钟）

**目标**: 部署修复到生产环境

**步骤**:
1. 提交所有修改：
   ```bash
   git add .
   git commit -m "fix(auth): 修复生产环境 API URL 和 i18n 配置，升级 CI 到 Node.js 24"
   git push origin main
   ```

2. 监控 GitHub Actions 执行：
   ```bash
   gh run watch
   ```

3. 验证构建日志：
   - ✅ Node.js 24 成功使用
   - ✅ 无 deprecation 警告
   - ✅ 构建成功完成

**回滚计划**: 
```bash
git revert HEAD
git push origin main
```

---

### Phase 4: 生产环境验证（预计 10 分钟）

**目标**: 验证修复在生产环境生效

**步骤**:
1. 等待 Cloudflare Pages 部署完成（约 2-3 分钟）

2. 访问 `https://starye.org/blog`，点击登录

3. 验证 `https://starye.org/auth/login`：
   - ✅ 页面正常加载
   - ✅ 无控制台错误
   - ✅ 无 `ERR_CONNECTION_REFUSED`
   - ✅ 无 i18n 404 错误

4. 检查网络请求（Chrome DevTools → Network）：
   - ✅ `GET https://starye.org/api/auth/get-session`
   - ✅ 状态码 200 或 401（均正常，表示 API 连接成功）

5. 测试登录流程：
   - ✅ 点击 "Login with GitHub"
   - ✅ GitHub OAuth 跳转正常
   - ✅ 登录成功后跳转回 `/blog/`

**失败处理**: 如验证失败，立即执行 Phase 3 的回滚计划

---

### Phase 5: 文档更新（预计 20 分钟）

**目标**: 更新项目文档，记录此次修复

**步骤**:
1. 更新 `README.md`：
   - 添加生产环境变量配置说明
   - 更新本地开发环境设置

2. 创建 `DEPLOYMENT.md`：
   - Cloudflare Pages 部署流程
   - 环境变量配置步骤
   - 常见问题排查

3. 更新 `.env.example`：
   ```bash
   # API URL for development (Gateway proxy)
   VITE_API_URL=http://localhost:8080

   # API URL for production (set in GitHub Actions)
   # VITE_API_URL=https://starye.org
   ```

**交付物**:
- 更新后的 `README.md`
- 新建的 `DEPLOYMENT.md`
- 更新后的 `.env.example`

---

## Open Questions

### Q1: 是否需要在 Cloudflare Pages 控制台配置环境变量？

**背景**: GitHub Actions 在构建时设置 `VITE_API_URL`，Cloudflare Pages 控制台也可以配置环境变量。

**选项**:
- **选项 A**: 仅在 GitHub Actions 配置（当前方案）
- **选项 B**: 同时在 Cloudflare Pages 控制台配置
- **选项 C**: 仅在 Cloudflare Pages 控制台配置

**倾向**: 选项 A（仅 GitHub Actions）

**理由**:
- ✅ 环境变量在构建时注入，Vite 已完成替换
- ✅ SSG 模式无运行时，Cloudflare Pages 控制台的环境变量不生效
- ✅ 集中管理，避免配置分散

**验证**: Phase 4 生产验证会确认此方案可行

---

### Q2: 其他应用（Dashboard）是否也需要检查？

**背景**: Dashboard 使用 Vite (非 Nuxt)，也有 `auth-client.ts`。

**当前状态**:
```typescript
// apps/dashboard/src/lib/auth-client.ts
const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080'
```

**结论**: ✅ Dashboard 已正确使用 `import.meta.env.VITE_API_URL`，无需修改

---

### Q3: 是否需要添加构建产物检查（CI）？

**背景**: 为了防止未来类似问题，可以在 CI 中添加构建产物检查。

**提议**:
```yaml
- name: Verify Production Build
  run: |
    grep -r "localhost:8080" apps/auth/dist/ && exit 1 || exit 0
    grep -r "starye.org" apps/auth/dist/ || exit 1
```

**倾向**: 暂不实施，作为未来优化项

**理由**:
- ⚠️ 增加 CI 复杂度
- ⚠️ 构建产物可能包含压缩/混淆代码，grep 不可靠
- ✅ 本次修复后，配置已标准化，未来出错概率低

**决策**: 记录在 "Future Improvements" 中

---

## Future Improvements

1. **环境变量验证脚本**:
   - 在本地运行 `pnpm check-env` 检查必需的环境变量
   - 在 CI 中自动运行

2. **构建产物检查**:
   - 使用 AST 分析工具（如 `esbuild` 或 `rollup-plugin-visualizer`）
   - 检查构建产物中是否包含敏感信息或错误配置

3. **环境变量管理工具**:
   - 考虑使用 `dotenv-vault` 或类似工具统一管理
   - 在 CI 中自动同步到 GitHub Secrets

4. **监控告警**:
   - 添加前端错误监控（Sentry）
   - 当出现 `ERR_CONNECTION_REFUSED` 时自动告警

5. **文档生成**:
   - 使用 `typedoc` 或 `vitepress` 生成 API 文档
   - 自动更新部署文档
