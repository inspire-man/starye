# 个人网站开发计划 (Starye)

## 1. 核心目标
构建一个基于最前沿技术栈的个人网站，展示前端开发能力，兼顾高性能、低成本与良好的开发体验。全面拥抱 **Cloudflare Serverless** 生态，严格遵循 **Free Tier (0成本)** 限制，利用 **GitHub Actions** 承担计算密集型任务。

## 2. 架构设计
**架构模式**: 路由级微前端 + 多应用独立部署
**代码管理**: Monorepo (pnpm workspace + turborepo)
**依赖策略**: 使用 `latest` 版本，并通过 `pnpm` 保持 Workspace 内依赖版本高度一致。

### 2.1 应用拆分 (Apps & Packages)

#### Apps (Deployables - 运行在 Cloudflare)
*   **blog (个人博客)**:
    *   **技术栈**: Nuxt 4 (Vue 3)
    *   **Base URL**: `/blog/`
    *   **渲染模式**: SSR / Hybrid (SWR)
    *   **部署名称**: `blog`

*   **comic (漫画库)**:
    *   **技术栈**: Nuxt 4 (Vue 3)
    *   **Base URL**: `/comic/`
    *   **功能**: 沉浸式阅读、图片预加载、离线缓存。
    *   **部署名称**: `comic`

*   **Dashboard (后台管理)**:
    *   **技术栈**: Vue 3 + Vite SPA
    *   **Base URL**: `/dashboard/`
    *   **功能**: 内容管理、爬虫监控、媒体库管理。
    *   **部署名称**: `dashboard`

*   **API (后端服务)**:
    *   **技术栈**: Hono 框架运行于 Cloudflare Workers
    *   **功能**:
        *   **数据**: Drizzle ORM + D1。
        *   **鉴权**: Better Auth (User) + Service Token (Crawler)。
        *   **存储**: R2 Presigned URL 下发。
        *   **监控**: Discord Webhook 异常告警。
    *   **部署名称**: `api`

*   **Edge Router (统一入口)**:
    *   **技术栈**: Cloudflare Worker
    *   **功能**: 根据 URL 前缀分发请求到对应服务。本地开发提供 `wrangler` 模拟环境。
    *   **部署名称**: `gateway`

#### Packages & Services (Local / CI 运行)
*   **Crawler (爬虫与数据处理)**:
    *   **位置**: `packages/crawler`
    *   **环境**: Node.js (GHA)
    *   **功能**:
        *   **抓取**: Puppeteer/Cheerio。
        *   **处理 (Write-time)**: 使用 `sharp` 生成多级缩略图 (Thumb, Preview, Original) 并上传 R2。
        *   **搜索**: 构建 Orama 索引。
        *   **告警**: 任务失败发送 Discord 通知。

*   **Database (数据层)**:
    *   **位置**: `packages/db`
    *   **技术**: Drizzle ORM + D1。

*   **UI Library (设计系统)**:
    *   **位置**: `packages/ui`
    *   **技术**: **Tailwind CSS** + **Shadcn UI (Vue)**。
    *   **策略**: 导出 `tailwind.preset` 供 Apps 消费，确保样式在 Monorepo 跨包引用时不丢失。

### 2.2 基础设施与云服务 (Cloudflare Stack - Zero Cost Optimized)
*   **数据库**: **Cloudflare D1**。
*   **对象存储 & CDN**:
    *   **Cloudflare R2**: 存储源文件。
    *   **优化关键**: 必须配置 **Custom Domain** + **Cache Rules** (Cache Everything)。
*   **离线任务**: **GitHub Actions** (高 CPU 任务)。
*   **监控**: **Discord Webhook** (免费实时告警)。

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

### Phase 1: 基础设施搭建 (Base Infrastructure)
- [ ] **1.1 Monorepo Setup**:
    - [ ] 初始化 `pnpm workspace` 和 `turbo`。
    - [ ] 配置根目录 `.gitignore`, `.npmrc`。
    - [ ] 安装并配置 `@antfu/eslint-config` 和 `prettier`。
    - [ ] 创建 `packages/config` (shared tsconfig)。
- [ ] **1.2 Database Layer**:
    - [ ] 创建 `packages/db`。
    - [ ] 安装 `drizzle-orm`, `drizzle-kit`。
    - [ ] 配置 `drizzle.config.ts` (支持本地 SQLite 和远程 D1)。
    - [ ] 初始化基础 Schema: `users`, `sessions` (Better Auth), `posts`, `media` (含 variants 字段)。
- [ ] **1.3 UI System**:
    - [ ] 创建 `packages/ui`。
    - [ ] 安装 `tailwindcss`, `shadcn-vue`, `unocss` (可选)。
    - [ ] 编写并导出 `tailwind.preset.ts`。
    - [ ] 添加第一个组件 (Button) 验证导出。

### Phase 2: 后端核心与鉴权 (Backend Core)
- [ ] **2.1 API Service**:
    - [ ] 创建 `apps/api` (Hono)。
    - [ ] 配置 `wrangler.toml` (绑定 D1, R2)。
    - [ ] 实现 Error Handler 中间件 (集成 Discord Webhook)。
- [ ] **2.2 Authentication**:
    - [ ] 集成 `better-auth`。
    - [ ] 配置 GitHub OAuth Provider。
    - [ ] 实现 `Service Token` 中间件 (保护爬虫接口)。
- [ ] **2.3 Media Service**:
    - [ ] 实现 R2 Presigned URL 生成接口 (PUT)。
    - [ ] 编写文档：配置 R2 自定义域名和缓存规则。

### Phase 3: 爬虫与自动化 (Crawler & Automation)
- [ ] **3.1 Crawler Package**:
    - [ ] 创建 `packages/crawler`。
    - [ ] 安装 `puppeteer`, `cheerio`, `sharp`。
    - [ ] 编写 `ImageProcessor` 类 (生成 3 级缩略图)。
- [ ] **3.2 GitHub Actions**:
    - [ ] 编写 `.github/workflows/daily-crawl.yml`。
    - [ ] 配置 Repository Secrets (`CRAWLER_SECRET`, `R2_KEYS`).
- [ ] **3.3 Search Indexing**:
    - [ ] 编写 Orama 索引构建脚本。
    - [ ] 实现索引上传 R2 逻辑。

### Phase 4: 前端应用开发 (Frontend Apps)
- [ ] **4.1 Dashboard**:
    - [ ] 创建 `apps/dashboard` (Vite)。
    - [ ] 引入 `packages/ui` preset。
    - [ ] 搭建 Layout 和 Auth Guard。
- [ ] **4.2 Blog**:
    - [ ] 创建 `apps/blog` (Nuxt 4)。
    - [ ] 配置 `baseURL: /blog/`。
    - [ ] 实现首页与文章详情页。
- [ ] **4.3 Comic**:
    - [ ] 创建 `apps/comic` (Nuxt 4)。
    - [ ] 配置 `baseURL: /comic/`。
    - [ ] 实现瀑布流阅读器。

### Phase 5: 路由与集成 (Integration)
- [ ] **5.1 Gateway**:
    - [ ] 创建 `apps/gateway`。
    - [ ] 实现路由分发逻辑。
    - [ ] 编写本地开发网关脚本 (`dev:gateway`)。
- [ ] **5.2 E2E Test**:
    - [ ] 验证全链路流程 (爬虫 -> 库 -> 前端展示)。
