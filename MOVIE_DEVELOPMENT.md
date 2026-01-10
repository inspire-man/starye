# Movie (JavDB) 模块开发规划

## 📋 项目概述

基于现有的 Comic 模块架构，扩展 Movie 模块以支持 JavDB 数据源 (`https://javdb457.com/`)。Movie 模块将复用 Comic 的 R18 鉴权机制，确保内容访问安全。

## 🎯 核心目标

1. **数据源**: 从 `javdb457.com` 爬取 R18 电影数据
2. **鉴权机制**: 复用现有 R18 鉴权逻辑（默认所有 Movie 标记为 `isR18: true`）
3. **架构一致性**: 遵循 Comic 模块的设计模式，保持代码风格统一

## 🔍 技术决策

### 数据获取方式: API vs HTML

**推荐策略**: **先探针，后决策**

1. **第一步**: 使用浏览器开发者工具检查 `javdb457.com` 是否有公开 API
   - 打开 Network 面板，观察列表页/详情页的网络请求
   - 查找 `api/`、`ajax/`、`json` 等关键词的请求
   - 如果有 API，优先使用 API 方式（更稳定、高效）

2. **第二步**: 如果存在 API，采用以下方案：
   - 使用 `got` 或 `fetch` 直接调用 API 端点
   - 解析 JSON 响应，提取结构化数据
   - **优势**: 速度快、数据稳定、维护成本低

3. **第三步**: 如果不存在 API，采用现有 HTML 解析方案：
   - 复用 `packages/crawler` 中的 HappyDOM 解析架构
   - 遵循 Comic 模块的解耦模式: `discover.ts` + `parser-detail.ts` + `parser-player.ts`
   - **优势**: 已有成熟架构，易于测试和调试

### 为什么优先考虑 API？

- ✅ **性能**: API 响应通常比完整 HTML 页面小 90%+
- ✅ **稳定性**: 结构化 JSON 数据，不依赖 DOM 结构变化
- ✅ **维护性**: 选择器变更风险低，更新频率低
- ✅ **开发效率**: 无需处理 HTML 解析复杂度

### 何时使用 HTML 解析？

- ❌ 网站没有公开 API
- ❌ API 需要复杂认证或频繁变更
- ❌ API 返回的数据不完整（需要从 HTML 补充）

## 📊 数据库 Schema 设计

### Movie 表结构 (参考 Comic)

```typescript
export const movies = sqliteTable('movie', {
  id: text('id').primaryKey(),
  title: text('title').notNull(), // 电影标题
  slug: text('slug').notNull().unique(), // URL Slug
  code: text('code').notNull().unique(), // 番号 (如: SSIS-123)
  description: text('description'), // 简介
  coverImage: text('cover_image'), // 封面图
  releaseDate: integer('release_date'), // 发布日期
  duration: integer('duration'), // 时长（分钟）
  sourceUrl: text('source_url').unique(), // 源 URL
  // 元数据
  actors: text('actors', { mode: 'json' }), // 演员列表 string[]
  genres: text('genres', { mode: 'json' }), // 题材/标签 string[]
  series: text('series'), // 系列名称
  publisher: text('publisher'), // 片商/发行商
  // R18 标记 (默认 true)
  isR18: integer('is_r18', { mode: 'boolean' }).default(true).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
})
```

### Player (播放源) 表结构

```typescript
export const players = sqliteTable('player', {
  id: text('id').primaryKey(),
  movieId: text('movie_id').notNull().references(() => movies.id, { onDelete: 'cascade' }),
  sourceName: text('source_name').notNull(), // 源名称 (如: "云播", "磁力")
  sourceUrl: text('source_url').notNull(), // 播放链接或磁力链接
  quality: text('quality'), // 画质 (HD, SD 等)
  sortOrder: integer('sort_order').notNull(), // 排序
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
})
```

### 关系定义

```typescript
export const movieRelations = relations(movies, ({ many }) => ({
  players: many(players),
}))

export const playerRelations = relations(players, ({ one }) => ({
  movie: one(movies, {
    fields: [players.movieId],
    references: [movies.id],
  }),
}))
```

## 🏗️ 实施阶段

### Phase 1: 数据库层 (Database Layer)

- [ ] **1.1 Schema 定义**
  - [ ] 在 `packages/db/src/schema.ts` 中定义 `movies` 和 `players` 表
  - [ ] 添加 Drizzle Relations
  - [ ] 导出 TypeScript 类型 (`Movie`, `NewMovie`, `Player`, `NewPlayer`)

- [ ] **1.2 数据库迁移**
  - [ ] 运行 `pnpm --filter db exec drizzle-kit generate` 生成迁移文件
  - [ ] 检查生成的 SQL 文件，确保字段类型正确
  - [ ] 本地测试: `pnpm --filter api exec wrangler d1 migrations apply starye-db --local`
  - [ ] 远程应用: `pnpm --filter api exec wrangler d1 migrations apply starye-db --remote`

### Phase 2: 爬虫策略 (Crawler Strategy)

- [ ] **2.1 网站结构分析**
  - [ ] 使用 `packages/crawler/scripts/inspect.ts` 工具分析 `javdb457.com`
  - [ ] 检查是否存在 API 端点（Network 面板）
  - [ ] 记录列表页、详情页、播放页的 URL 模式

- [ ] **2.2 爬虫策略实现 (如果使用 HTML 解析)**
  - [ ] 创建 `packages/crawler/src/strategies/javdb.ts` (主策略类)
  - [ ] 创建 `packages/crawler/src/strategies/javdb-parser.ts` (解析器函数)
  - [ ] 实现 `discover()`: 从列表页/搜索页发现电影
  - [ ] 实现 `parseDetail()`: 解析详情页元数据
  - [ ] 实现 `parsePlayers()`: 解析播放源列表

- [ ] **2.3 API 策略实现 (如果存在 API)**
  - [ ] 创建 `packages/crawler/src/strategies/javdb-api.ts`
  - [ ] 实现 API 请求封装（使用 `got`）
  - [ ] 实现数据转换逻辑（API JSON -> 数据库模型）

- [ ] **2.4 测试覆盖**
  - [ ] 创建 `packages/crawler/src/strategies/__fixtures__/javdb-*.html` 测试 Fixture
  - [ ] 编写 Vitest 单元测试 (`javdb-parser.test.ts`)
  - [ ] 确保离线测试通过（不依赖网络）

- [ ] **2.5 集成到爬虫 Runner**
  - [ ] 在 `packages/crawler/src/index.ts` 中注册 `JavDBStrategy`
  - [ ] 测试端到端流程: 发现 -> 解析 -> API 同步

### Phase 3: API 路由 (API Routes)

- [ ] **3.1 Movie 路由实现**
  - [ ] 创建 `apps/api/src/routes/movies.ts`
  - [ ] 实现 `GET /api/movies`: 列表查询（支持分页、筛选、R18 鉴权）
  - [ ] 实现 `GET /api/movies/:slug`: 详情查询（含播放源列表、R18 鉴权）
  - [ ] 实现 `GET /api/movies/:slug/play`: 播放器页面数据（R18 强制验证）

- [ ] **3.2 R18 鉴权逻辑复用**
  - [ ] 复用 `checkIsAdult()` 辅助函数
  - [ ] 未授权用户: 封面图返回 `null`
  - [ ] 未授权用户访问播放器: 返回 `403 Forbidden`

- [ ] **3.3 爬虫同步接口**
  - [ ] 实现 `POST /api/movies/sync` (Service Token 保护)
  - [ ] 实现 `POST /api/movies/:id/players` (批量添加播放源)

- [ ] **3.4 路由注册**
  - [ ] 在 `apps/api/src/index.ts` 中注册 `/api/movies` 路由

### Phase 4: 多语言支持 (I18n)

- [ ] **4.1 Locale 文件**
  - [ ] 在 `packages/locales/src/zh-CN/movie.ts` 添加中文翻译
  - [ ] 在 `packages/locales/src/en-US/movie.ts` 添加英文翻译
  - [ ] 包含常见字段: `title`, `actors`, `genres`, `series`, `publisher`, `duration`, `releaseDate`

- [ ] **4.2 类型定义**
  - [ ] 在 `packages/locales/src/index.ts` 中导出 `movie` 模块

### Phase 5: 自动化与监控 (Automation)

- [ ] **5.1 GitHub Actions 工作流**
  - [ ] 创建 `.github/workflows/daily-movie-crawl.yml`
  - [ ] 配置定时任务（每日执行）
  - [ ] 集成 JavDB 爬虫策略
  - [ ] 配置失败告警（Discord Webhook）

- [ ] **5.2 爬虫配置**
  - [ ] 确定爬取范围（最新、热门、分类等）
  - [ ] 配置并发控制（避免被封禁）
  - [ ] 实现增量更新逻辑（避免重复爬取）

## 📝 代码规范

遵循 `DEVELOPMENT.md` 中的规范:

- ✅ 所有注释使用 **简体中文**
- ✅ 公共接口使用 **JSDoc/TSDoc** 格式
- ✅ 仅在复杂逻辑处添加注释
- ✅ 函数命名使用驼峰式，表名使用单数形式 (`movie`, `player`)

## 🧪 测试策略

### Unit Test (P0)
- 使用 Vitest + HTML Fixture 测试解析逻辑
- 离线运行，毫秒级速度

### Integration Test (P1)
- 使用内存数据库测试 API 路由
- 验证 R18 鉴权逻辑

## 🚀 部署检查清单

- [ ] 数据库迁移已应用到远程 D1
- [ ] API 路由已注册并测试
- [ ] GitHub Actions 工作流已配置 Secrets
- [ ] 爬虫策略已集成到 Runner
- [ ] R18 鉴权逻辑已验证

## 📚 参考资料

- Comic 模块实现: `apps/api/src/routes/comics.ts`
- Comic Schema: `packages/db/src/schema.ts` (lines 91-105)
- 爬虫架构: `packages/crawler/src/lib/base-crawler.ts`
- R18 鉴权: `apps/api/src/routes/comics.ts` (lines 11-17, 60-68)
