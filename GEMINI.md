# 个人网站开发计划 (Starye)

## 1. 核心目标

构建一个基于最前沿技术栈的个人网站，展示前端开发能力，兼顾高性能、低成本与良好的开发体验。全面拥抱 **Cloudflare Serverless** 生态，严格遵循 **Free Tier (0成本)** 限制，利用 **GitHub Actions** 承担计算密集型任务。

## 2. 架构设计

**架构模式**: 路由级微前端 + 多应用独立部署
**代码管理**: Monorepo (pnpm workspace + turborepo)
**依赖策略**: 使用 `latest` 版本，并通过 `pnpm` 保持 Workspace 内依赖版本高度一致。

### 2.1 应用拆分 (Apps & Packages)

#### Apps (Deployables - 运行在 Cloudflare)

- **blog (个人博客)**:
  - **技术栈**: Nuxt 4 (Vue 3)
  - **Base URL**: `/blog/`
  - **渲染模式**: SSR / Hybrid (SWR)
  - **部署名称**: `blog`

- **comic (漫画库)**:
  - **技术栈**: Nuxt 4 (Vue 3)
  - **Base URL**: `/comic/`
  - **功能**: 沉浸式阅读、图片预加载、离线缓存。
  - **内容保护**: 默认所有漫画标记为 R18。仅登录且通过年龄验证的用户可见封面及阅读内容。未验证用户仅可见标题/章节列表。
  - **部署名称**: `comic`

- **Dashboard (后台管理)**:
  - **技术栈**: Vue 3 + Vite SPA
  - **Base URL**: `/dashboard/`
  - **功能**: 内容管理、爬虫监控、媒体库管理。
  - **部署名称**: `dashboard`

- **API (后端服务)**:
  - **技术栈**: Hono v4.x 运行于 Cloudflare Workers
  - **功能**:
    - **数据**: Drizzle ORM (Latest) + D1 (Remote/Local)。
    - **鉴权**: Better Auth (User, GitHub OAuth) + Service Token (Crawler)。
    - **存储**: R2 Presigned URL 下发。
    - **监控**: Global Error Handler + Discord Webhook (ToDo)。
  - **部署名称**: `api`

- **Edge Router (统一入口)**:
  - **技术栈**: Cloudflare Worker
  - **功能**: 根据 URL 前缀分发请求到对应服务。本地开发提供 `wrangler` 模拟环境。
  - **部署名称**: `gateway`

#### Packages & Services (Local / CI 运行)

- **Crawler (爬虫与数据处理)**:
  - **位置**: `packages/crawler`
  - **环境**: Node.js (GHA)
  - **功能**:
    - **抓取**: Puppeteer/Cheerio。
    - **处理 (Write-time)**: 使用 `sharp` 生成多级缩略图 (Thumb, Preview, Original) 并上传 R2。
    - **搜索**: 构建 Orama 索引。
    - **告警**: 任务失败发送 Discord 通知。

- **Database (数据层)**:
  - **位置**: `packages/db`
  - **技术**: Drizzle ORM + D1 + **Zod v4**。
  - **优化**: 包含完整的 Drizzle Relations 定义。

- **UI Library (设计系统)**:
  - **位置**: `packages/ui`
  - **技术**: **Tailwind CSS v4** + **Shadcn UI (Vue)**。
  - **策略**: 导出 `tailwind.preset` 供 Apps 消费，确保样式在 Monorepo 跨包引用时不丢失。

### 2.2 基础设施与云服务 (Cloudflare Stack - Zero Cost Optimized)

- **数据库**: **Cloudflare D1**。
- **对象存储 & CDN**:
  - **Cloudflare R2**: 存储源文件。
  - **优化关键**: 必须配置 **Custom Domain** + **Cache Rules** (Cache Everything)。
- **离线任务**: **GitHub Actions** (高 CPU 任务)。
- **监控**: **Discord Webhook** (免费实时告警)。

## 3. 目录结构规划

```text
/
├── apps/
│   ├── blog/           # Nuxt 4
│   ├── comic/          # Nuxt 4
│   ├── dashboard/      # Vue 3 + Vite
│   ├── api/            # Hono (Workers)
│   └── gateway/        # Worker (Routing)
├── packages/
│   ├── crawler/        # Node.js Scripts (GHA)
│   ├── db/             # Drizzle Schema & Client
│   ├── ui/             # Shadcn Vue + Tailwind Config
│   └── config/         # Shared Configs (ESLint, TS)
├── .github/
│   └── workflows/      # Schedules
```

## 4. 实施阶段建议 (Todo List - Fine Grained)

### Phase 1: 基础设施搭建 (Base Infrastructure) [Done]

- [x] **1.1 Monorepo Setup**:
  - [x] 初始化 `pnpm workspace` 和 `turbo`。
  - [x] 配置根目录 `.gitignore`, `.npmrc`。
  - [x] 安装并配置 `@antfu/eslint-config` (移除 Prettier 避免冲突)。
  - [x] 配置 Husky, Lint-staged, Commitlint。
- [x] **1.2 Database Layer**:
  - [x] 创建 `packages/db`。
  - [x] 安装 `drizzle-orm` (Latest), `drizzle-kit`。
  - [x] 配置 `drizzle.config.ts` (支持本地 SQLite 和远程 D1)。
  - [x] 初始化 Schema: User, Auth, Content, Media, Comic, Job。
  - [x] 初始化 Drizzle Relations。
- [x] **1.3 UI System**:
  - [x] 创建 `packages/ui`。
  - [x] 安装 `tailwindcss` (v4), `shadcn-vue`。
  - [x] 编写并导出 `tailwind.preset.ts`。

### Phase 2: 后端核心与鉴权 (Backend Core) [Done]

- [x] **2.1 API Service**:
  - [x] 创建 `apps/api` (Hono)。
  - [x] 配置 `wrangler.toml` (绑定 D1, R2)。
  - [x] 实现 Global Error Handler 中间件。
  - [x] 实现 DRY Config (统一 CORS 配置)。
- [x] **2.2 Authentication**:
  - [x] 集成 `better-auth` (支持 Workers 环境, 动态 BaseURL)。
  - [x] 配置 GitHub OAuth Provider。
  - [x] 实现 `Service Token` 中间件 (保护爬虫接口)。
- [x] **2.3 Media Service**:
  - [x] 实现 R2 Presigned URL 生成逻辑 (lib/r2.ts)。
  - [ ] 编写文档：配置 R2 自定义域名和缓存规则。

### Phase 3: 爬虫与自动化 (Crawler & Automation) [In Progress]

- [ ] **3.1 Crawler Package**:
  - [x] 创建 `packages/crawler`。
  - [x] 安装 `puppeteer`, `cheerio`, `sharp`。
  - [x] 编写 `ImageProcessor` 类 (生成 3 级缩略图, 批量并发处理)。
  - [x] **Refactor**: 将 DOM 解析逻辑抽离为纯函数 (`*-parser.ts`)，引入 `happy-dom` 实现本地解析。
  - [x] **Testing**: 搭建 Vitest 测试环境，编写策略单元测试 (离线 Fixture 模式)。
  - [ ] **Enhancement**: 扩展 `Comic` 数据表结构 (作者, 状态, 简介等)。
  - [ ] **Refactor**: 将 `92hm` 源策略重构为列表页、详情页、章节页独立解析器。
- [x] **3.2 GitHub Actions**:
  - [x] 编写 `.github/workflows/daily-crawl.yml`。
  - [x] 新增 `.github/workflows/deploy-migrations.yml` (DB Sync)。
  - [ ] 配置 Repository Secrets (`CRAWLER_SECRET`, `R2_KEYS`).
- [ ] **3.3 Search Indexing**:
  - [x] 编写 Orama 索引构建脚本。
  - [x] 实现索引上传 R2 逻辑。

### Phase 4: 前端应用开发 (Frontend Apps) [In Progress]

- [x] **4.1 Dashboard**:
  - [x] 创建 `apps/dashboard` (Vite + Vue 3)。
  - [x] 成功集成 `@starye/ui` 与 Tailwind v4。
  - [x] 实现基础 API 通信与漫画列表展示。
  - [ ] 完善路由系统与侧边栏布局。
  - [ ] 接入 Auth Guard。
- [ ] **4.2 Blog**:
  - [ ] 创建 `apps/blog` (Nuxt 4)。
  - [ ] 配置 `baseURL: /blog/`。
  - [ ] 实现首页与文章详情页。
- [x] **4.3 Comic**:
  - [x] 创建 `apps/comic` (Nuxt 4)。
  - [x] 配置 `baseURL: /comic/`。
  - [x] 实现瀑布流阅读器。
  - [x] 修复跨域鉴权问题。

### Phase 5: 路由与集成 (Integration) [Pending]

- [x] **5.1 Testing Infrastructure**:
  - [x] 根目录集成 `vitest` 与 `turbo` 管道。
  - [x] 创建 `@starye/config` 共享测试配置。
- [ ] **5.2 Gateway**:
  - [ ] 创建 `apps/gateway`。
  - [ ] 实现路由分发逻辑。
  - [ ] 编写本地开发网关脚本 (`dev:gateway`)。
- [ ] **5.3 E2E Test**:
  - [ ] 验证全链路流程 (爬虫 -> 库 -> 前端展示)。

### Phase 6: 多语言 (Internationalization) [In Progress]

- [x] **6.1 Shared Locales Package**:
  - [x] 创建 `packages/locales`。
  - [x] 定义中英双语 JSON 结构 (Common, Auth, Comic, Dashboard)。
- [x] **6.2 Comic App Integration**:
  - [x] 安装 `@nuxtjs/i18n`。
  - [x] 替换首页文本。
  - [x] 替换详情页与阅读器文本。
- [ ] **6.3 Dashboard Integration**:
  - [ ] 安装 `vue-i18n`。
  - [ ] 替换硬编码文本。
