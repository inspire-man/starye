# Starye 开发日志 (Development Log)

> Status: historical. Retained as early project and blog-source material.

本文档记录 **Starye** 项目开发过程中的技术决策、踩坑记录与灵感碎片。旨在为未来的技术博客积累素材。

---

## 2026-01-26: 全栈功能强化：i18n 集成、爬虫优化与 UI 升级

### 🎯 目标
完成 Dashboard 的国际化集成，优化爬虫同步效率，并升级 Comic 前台的元数据展示能力，实现从数据采集到管理再到展示的全链路闭环。

### 🛠️ 技术实现 (Implementation)

1.  **Dashboard 国际化集成 (i18n)**:
    *   在 `apps/dashboard` 中集成 `vue-i18n`，对接 `@starye/locales` 共享包。
    *   完成了侧边栏、概览页、漫画管理、用户管理、文章管理等核心页面的文本本地化。
    *   实现了即时语言切换，并持久化到 `localStorage`。
2.  **爬虫策略重构与优化**:
    *   **架构升级**: 将 `92hm` 策略的解析逻辑彻底抽离为独立解析器 (`site-92hm-parser.ts`)，实现 100% 离线单元测试覆盖。
    *   **同步优化**: 实现 "增量更新" 逻辑。爬虫在拉取章节图片前，会先调用 API (`/api/admin/check-chapter`) 检查该章节是否已存在且完整（通过图片数量对比），从而大幅减少重复的图片下载与 R2 上传操作。
    *   **健壮性**: 修复了 `happy-dom` 解析 `href` 属性时的匹配问题，增加了对多种 URL 模式（`?tag=` 和 `/tag/`）的兼容。
3.  **API 与 UI 元数据对齐**:
    *   **API 增强**: 扩展 `admin.patch('/comics/:id')` 接口，支持更新地区、状态、题材和简介等丰富元数据。
    *   **UI 升级**: 
        *   `packages/ui`: 升级 `ComicCard` 组件，支持在封面图上展示地区和状态徽章。
        *   `apps/comic`: 详情页现在可以完美展示完整的漫画信息，且题材标签支持点击跳转筛选。

### 📝 经验总结 (Learnings)
*   **API 前置校验的威力**: 通过增加一个简单的状态检查接口，成功让爬虫的有效节奏提升了数倍，避免了大量无效的 CPU 和网络 IO 开销。
*   **CSS 选择器的健壮性**: 在爬虫开发中，属性选择器（如 `a[href*="..."]`）比类名选择器更可靠，因为 HTML 结构常变但核心逻辑链接相对稳定。
*   **Gateway 的 Host 头陷阱**: 在 Cloudflare Workers 相互 fetch 时，透传原始 `Host` 头可能导致请求被 Zone 路由逻辑误导（报 404 或死循环）。转发请求前务必删除原始 `Host` 头，让 `fetch` 重新生成。

---

## 2026-01-15: 博客模块实现与网关集成

### 🎯 目标
搭建 `apps/blog` 基础架构，实现文章列表展示与详情页 Markdown 渲染，并通过 Gateway 统一路由入口，确保多应用并行开发的端口隔离。

### 🛠️ 技术实现 (Implementation)

1.  **网关路由 (Gateway Routing)**:
    *   在 `apps/gateway` 中配置 `/blog` 路径转发至 `http://localhost:3002`。
    *   调整 `apps/blog` 开发端口为 `3002`，避免与 Movie App (3001) 冲突。
2.  **API 扩展**:
    *   新增 `apps/api/src/routes/posts.ts`，提供 RESTful 接口：
        *   `GET /api/posts`: 分页获取已发布文章。
        *   `GET /api/posts/:slug`: 获取文章详情及元数据。
3.  **博客前端 (Blog App)**:
    *   使用 `Nuxt 4` 构建，集成 `markdown-it` 实现 Markdown -> HTML 渲染。
    *   **列表页**: 响应式网格布局，展示封面、摘要、作者及发布时间。
    *   **详情页**: 采用 `prose` (Tailwind Typography) 优化排版，集成 SEO Meta 信息。

### 📝 经验总结 (Learnings)
*   **Hono 路由拆分**: 随着业务增加，将路由按模块拆分到 `routes/*.ts` 并通过 `app.route()` 挂载，能有效保持 `index.ts` 简洁。
*   **端口管理**: 在 Monorepo 多应用并行开发时，提前规划好端口分配表（Gateway: 3000, Movie: 3001, Blog: 3002, Dashboard: 5173, API: 8787）至关重要。

---

## 2026-01-09: 完善 92hm 漫画源爬虫策略

### 🎯 目标
根据用户提供的新 URL（列表页、搜索页、详情页、阅读页），全面增强 `92hm` 数据源的爬虫能力，并同步扩展数据库模型以容纳更丰富的漫画元数据。

### 📝 规划与设计 (Planning & Design)

1.  **数据库 Schema 扩展 (`packages/db`)**:
    *   分析发现，`Comic` 表需要增加以下字段来存储详情页信息：
        *   `author` (作者)
        *   `description` (简介)
        *   `status` (连载状态: `serializing` | `completed`)
        *   `region` (地区)
        *   `genres` (题材, `string[]`)
        *   `sourceUrl` (源 URL, 用于追更)
2.  **爬虫策略重构 (`packages/crawler`)**:
    *   将原有的单一策略函数，拆分为职责更明确的模块：
        *   `discover.ts`: 实现从列表页 (`booklist`) 和搜索页 (`search`) 发现漫画，获取其详情页 URL。
        *   `parser-detail.ts`: 负责解析详情页 (`book/:id`)，提取上述所有元数据和章节列表。
        *   `parser-chapter.ts`: 负责解析阅读页 (`chapter/:id`)，提取页面中的所有漫画图片 URL。
3.  **任务流程编排**:
    *   **全量同步**: 遍历 `booklist` 的所有分类和页码 -> `discover` -> `parser-detail` -> DB Insert/Update。
    *   **单章同步**: `parser-detail` (获取最新章节) -> `parser-chapter` -> Image Processing -> DB Insert/Update。

---

## 2026-01-08: 爬虫架构重构与测试体系搭建

### 🎯 目标
解决爬虫脚本难以调试、无法进行单元测试的问题，并建立项目级的自动化测试标准。

### 🛠️ 技术挑战 (Pain Points)
1.  **Puppeteer 的黑盒效应**: 之前的爬虫逻辑全部封装在 `page.evaluate(() => { ... })` 中。这部分代码在浏览器沙箱中运行，导致：
    *   IDE 无法调试（断点无效）。
    *   无法使用外部定义的 TypeScript 接口和工具函数。
    *   出错信息被序列化，丢失堆栈细节。
2.  **测试依赖网络**: 验证解析逻辑必须启动 Puppeteer 并访问真实网站，速度慢且容易因网络波动失败。
3.  **Monorepo 依赖管理**: 需要在多包环境下统一测试配置。

### 💡 解决方案 (The Fix)

#### 1. 逻辑解耦 (Decoupling)
将 "获取 HTML" 和 "解析 HTML" 彻底分离：
- **Before**: Browser (Fetch + Parse) -> Data
- **After**: Browser (Fetch Only) -> HTML String -> Node.js (HappyDOM + Pure Parser) -> Data

**代码演进**:
```typescript
// 🔴 Before: 逻辑硬编码在 evaluate 中
await page.evaluate(() => {
  return document.querySelector('.title').textContent;
});

// 🟢 After: 纯函数解析
// site-parser.ts
export function parse(doc: Document) {
  return doc.querySelector('.title').textContent;
}

// site-strategy.ts
const html = await page.content();
const doc = new Window().document;
doc.write(html);
return parse(doc);
```

#### 2. 引入 HappyDOM
选择 `happy-dom` 而不是 `jsdom`，因为它更轻量、速度更快，且 API 足以应对爬虫的 DOM 解析需求。这使得我们可以在 Node.js 环境中模拟浏览器 DOM，直接运行 Parser 代码。

#### 3. 建立测试金字塔
- **Unit Test (P0)**: 使用 `vitest` + `Fixture (本地 HTML)` 测试 Parser 逻辑。无需联网，毫秒级运行。
- **Integration Test (P1)**: (待办) 使用内存数据库测试 API 数据入库逻辑。

### 📝 博客灵感 (Blog Ideas)
- **标题**: 《拒绝 Puppeteer 黑盒：如何编写可测试、可调试的爬虫代码》
- **关键词**: Web Scraping, Testing, Clean Architecture, HappyDOM
- **大纲**:
    1. 为什么 `page.evaluate` 是维护噩梦？
    2. 依赖倒置：让解析逻辑不依赖 Puppeteer。
    3. 实战：使用 Vitest 和 Fixture 编写离线爬虫测试。
    4. 性能权衡：序列化 HTML 的开销 vs 开发体验的提升。

---

## 2026-01-08: D1 数据库迁移踩坑 (The Missing Migrations)

### 🚨 事故现场
在部署爬虫新逻辑后，同步漫画数据时 API 频繁报错 `500 Internal Server Error`。
日志详情：
```json
{
  "error": "Database Error: Failed query: insert into \"comic\" ... values ...",
  "details": "SqliteError: no such column: is_r18"
}
```

### 🧐 根因分析 (Root Cause)
1.  **Schema 变更**: 我们在代码库中更新了 `drizzle schema`，增加了 `is_r18` 和 `status` 字段，并生成了 migration 文件 (`0002_xxx.sql`)。
2.  **部署脱节**: 代码部署到了 Cloudflare Workers，API 开始尝试写入新字段。
3.  **Migration 缺失**: 远程 D1 数据库**并没有自动应用**这些变更。Worker 代码是最新的，但数据库结构还停留在旧版本。

### ✅ 解决方案 (Resolution)
必须显式运行命令将迁移应用到远程数据库：
```powershell
pnpm --filter api exec wrangler d1 migrations apply starye-db --remote
```

### 🧠 经验总结 (Lesson Learned)
*   **Infrastructure as Code != Auto Sync**: 代码里的 SQL 文件存在不代表数据库已经变更。
*   **Pipeline Checklist**: 在 CI/CD 流程中，`deploy` 之前必须包含 `db:migrate` 步骤（或者在开发流程中严格执行）。
*   **Better Errors**: 应该捕获 SQLite 错误并返回更明确的 400 Bad Request 或 500 错误码，指明 "Database schema mismatch"。

---

## 2026-01-08: R18 鉴权修复与多语言架构规划

### 🐛 线上 Bug 修复 (Bug Fixes)
1.  **R18 权限不同步**:
    *   **现象**: 后台开启用户 R18 权限后，前端漫画封面仍被屏蔽。
    *   **原因**:
        1.  `better-auth` 默认 Session 回调未透传 `isAdult` 字段。
        2.  跨域请求（Frontend -> API）未携带 Cookie (`credentials: 'include'`)。
        3.  Nuxt SSR 服务端请求未转发客户端 Cookie。
    *   **修复**:
        *   API 端：显式重写 `session` callback 注入 `isAdult`。
        *   前端：`useFetch` 增加 `credentials: 'include'` 和 `headers: useRequestHeaders(['cookie'])`。
2.  **数据库迁移自动化**:
    *   **现象**: 代码部署后，远程数据库 Schema 未更新。
    *   **修复**: 新增 GitHub Actions `.github/workflows/deploy-migrations.yml`，监听 `packages/db` 变更自动执行 `d1 migrations apply`。

### 🌍 多语言架构 (I18n Architecture)
为了支持中英双语切换，决定采用 **Monorepo Shared Locale** 模式：
*   **Core**: `packages/locales` 存放纯 JSON/TS 翻译文件，作为单一事实来源 (SSOT)。
*   **Consumer**:
    *   `apps/comic` (Nuxt): 使用 `@nuxtjs/i18n` 消费共享包。
    *   `apps/dashboard` (Vue): 使用 `vue-i18n` 消费共享包。
    *   `apps/api`: (可选) 仅返回 Error Code，文案由前端映射。
*   **优势**: 避免文案散落在各处，确保术语一致性，降低维护成本。
