# Starye

个人全栈项目，基于 Cloudflare Workers + D1 + Nuxt 3 + Vue 3 技术栈。

## 项目结构

```
starye/
├── apps/
│   ├── api/           # API Worker (Hono + Better Auth + D1)
│   ├── auth/          # 鉴权应用 (Nuxt 4)
│   ├── blog/          # 博客应用 (Nuxt 4)
│   ├── comic-app/     # 漫画应用 (Vue 3 + Vite)
│   ├── dashboard/     # 管理后台 (Vue 3 + Vite)
│   ├── gateway/       # 网关 Worker (反向代理)
│   └── movie-app/     # 影视应用 (Vue 3 + Vite)
└── packages/
    ├── config/        # 共享配置 (ESLint, TS, Vitest)
    ├── crawler/       # 爬虫脚本 (Node.js)
    ├── db/            # Drizzle ORM + Schema
    ├── locales/       # 国际化资源
    └── ui/            # 共享 UI 组件
```

## 技术栈

- **后端**: TypeScript + Cloudflare Workers + D1 (SQLite) + Drizzle ORM
- **鉴权**: Better Auth (GitHub 登录，Session 存储在 D1)
- **前端**: Vue 3 + Nuxt 4 + TypeScript + Vite
- **网关**: Cloudflare Worker 反向代理
- **部署**: Cloudflare Pages + Workers
- **存储**: Cloudflare R2 Object Storage（图片和媒体文件）
- **爬虫**: Puppeteer + Cheerio + Sharp（运行在 GitHub Actions）
- **样式**: Tailwind CSS v4 + Shadcn UI (Vue)

## 核心功能

### API 文档
- **OpenAPI 规范**: 完整的 REST API 文档，符合 OpenAPI 3.0 标准
- **交互式文档**: 访问 `/api/docs` 查看 Scalar UI 文档界面
- **类型安全**: 使用 Valibot 进行 schema 验证，支持 RPC 客户端类型推导
- **在线访问**: 
  - 本地开发: http://localhost:8787/api/docs
  - OpenAPI JSON: http://localhost:8787/api/openapi.json

### Dashboard 管理后台
- 用户管理和 R18 白名单控制
- 博客文章管理 (CRUD)
- 漫画和电影元数据管理 (CRUD)
- **女优和厂商管理**：支持女优和厂商资料的 CRUD、搜索、合并功能
- **电影关联管理**：电影可关联多个女优和厂商，支持排序
- **图片上传**：支持封面、头像等图片直接上传到 R2（仅管理员，最大 10MB）
- 爬虫任务监控和管理
- 操作审计日志查询和导出

### 用户应用
- 博客浏览（文章列表、详情页、Markdown 渲染）
- 漫画浏览（列表、详情、沉浸式阅读器）
- 电影浏览（列表、详情、在线播放）
- **女优和厂商浏览**：查看女优和厂商的详细资料、作品列表
- **电影详情增强**：显示关联的女优和厂商，可点击跳转到详情页
- 阅读进度和观看进度自动保存
- GitHub 登录和 R18 内容访问控制
- 中英双语支持

## 数据模型

### 女优和厂商关联
项目使用关联表实现电影与女优/厂商的多对多关系：

- **`actors`** 表：存储女优基本信息（姓名、头像、国籍、生日、身高、三围、罩杯、血型、出道日期、活跃状态等）
- **`publishers`** 表：存储厂商信息（名称、Logo、网站、简介、成立年份、国家等）
- **`movie_actors`** 关联表：电影-女优多对多关系，支持排序
- **`movie_publishers`** 关联表：电影-厂商多对多关系，支持排序

**API 端点（用户）：**
- `GET /api/actors` - 女优列表（支持分页、排序、筛选）
- `GET /api/actors/:slug` - 女优详情（包含作品列表）
- `GET /api/publishers` - 厂商列表（支持分页、排序）
- `GET /api/publishers/:slug` - 厂商详情（包含作品列表）
- `GET /api/movies` - 电影列表（支持分页、排序、筛选）
- `GET /api/movies/:slug` - 电影详情（返回关联的女优和厂商对象数组）

**API 端点（管理员）：**
- `POST /api/admin/actors` - 创建女优
- `PUT /api/admin/actors/:id` - 更新女优
- `DELETE /api/admin/actors/:id` - 删除女优
- `POST /api/admin/actors/merge` - 合并女优数据
- `POST /api/admin/publishers` - 创建厂商
- `PUT /api/admin/publishers/:id` - 更新厂商
- `DELETE /api/admin/publishers/:id` - 删除厂商
- `POST /api/admin/publishers/merge` - 合并厂商数据
- `POST /api/admin/movies` - 创建电影
- `PUT /api/admin/movies/:id` - 更新电影（包含女优/厂商关联）
- `DELETE /api/admin/movies/:id` - 删除电影

**前端路由（Movie App）：**
- `/` - 电影列表页
- `/movie/:slug` - 电影详情页
- `/actors` - 女优列表页
- `/actors/:slug` - 女优详情页
- `/publishers` - 厂商列表页
- `/publishers/:slug` - 厂商详情页

**前端路由（Dashboard）：**
- `/dashboard/` - 仪表盘首页
- `/dashboard/movies` - 电影管理
- `/dashboard/actors` - 女优管理
- `/dashboard/publishers` - 厂商管理
- `/dashboard/posts` - 博客文章管理

## 本地开发

### 前置要求

- Node.js >= 18
- pnpm >= 8
- Wrangler CLI (Cloudflare Workers 开发工具)

### 环境配置

1. 复制环境变量模板：
```bash
cp .env.example .env.local
```

2. 配置环境变量（`.env.local`）：
```bash
# API 服务地址（本地开发通过 Gateway）
VITE_API_URL=http://localhost:8080
NUXT_PUBLIC_API_URL=http://localhost:8080
```

### 快速启动（推荐）

清理端口并启动所有服务：

```bash
# 一键启动（推荐）
pnpm dev:clean
```

或者分步操作：

```bash
# 1. 清理可能占用的端口
pnpm clean:ports

# 2. 启动所有服务
pnpm dev
```

### 手动启动顺序

如果需要单独启动某些服务，请按以下顺序：

1. **启动 Gateway**（端口 8080）
```bash
pnpm dev --filter gateway
```

2. **启动 API Worker**（端口 8787）
```bash
pnpm dev --filter api
```

3. **启动前端应用**（顺序任意）
```bash
# Blog (端口 3002)
pnpm dev --filter blog

# Comic (端口 3000)
pnpm dev --filter comic-app

# Movie (端口 3001)
pnpm dev --filter movie-app

# Auth (端口 3003)
pnpm dev --filter auth

# Dashboard (端口 5173)
pnpm dev --filter dashboard
```

### 端口映射

| 服务 | 本地端口 | 通过 Gateway 访问 | 说明 |
|------|---------|------------------|------|
| Gateway | 8080 | - | 统一网关入口 |
| API | 8787 | `http://localhost:8080/api/` | REST API + Better Auth |
| Dashboard | 5173 | `http://localhost:8080/dashboard/` | 管理后台 |
| Blog | 3002 | `http://localhost:8080/blog/` | 博客 |
| Movie | 3001 | `http://localhost:8080/movie/` | 影视 |
| Comic | 3000 | `http://localhost:8080/comic/` | 漫画 |
| Auth | 3003 | `http://localhost:8080/auth/` | 鉴权 |

### 正确的访问方式

⚠️ **本地开发必须通过 Gateway 访问**，否则会出现鉴权问题：

✅ **正确：**
```
http://localhost:8080/blog/
http://localhost:8080/comic/
http://localhost:8080/dashboard/
```

❌ **错误（会导致 Cookie 无法共享）：**
```
http://localhost:3002/blog/
http://localhost:3000/comic/
```

### 开发提示

本地开发时建议使用以下命令清理端口并启动服务：

```bash
pnpm dev:clean
```

这个命令会自动清理占用的端口，然后启动所有服务。

### 常见问题排查

#### 0. 端口冲突或服务启动在错误端口

**现象**：
- 看到 "Unable to find an available port" 警告
- Auth 应用启动在 3008 而不是 3003
- 访问 `/auth` 得到其他服务的响应
- 出现 "configured with a public base URL of /movie/" 错误

**解决方案**：

```bash
# 检查服务状态
pnpm check:services

# 清理占用的端口
pnpm clean:ports

# 重新启动服务
pnpm dev
```

或使用一键命令：
```bash
pnpm dev:clean
```

**说明**：旧的服务进程可能仍在占用端口，导致新服务启动到其他端口，引起 Gateway 路由错误。

#### 1. 登录跳转 404

**现象**：点击登录按钮跳转到 `/auth/login` 后显示 404。

**排查步骤**：
1. 检查是否通过 Gateway 访问：`http://localhost:8080/blog/`
2. 验证 Auth 应用是否已启动（端口 3003）
3. 检查浏览器控制台是否有路由错误

#### 2. 无限重定向到登录页

**现象**：访问 `/comic/` 或 `/movie/` 时不断重定向到登录页。

**排查步骤**：
1. 确认 Gateway 和 API 都已启动
2. 检查 `auth-client.ts` 的 `apiUrl` 是否指向 Gateway (`http://localhost:8080`)
3. 在浏览器开发者工具中检查是否有 API 请求失败
4. 验证环境变量 `VITE_API_URL` 是否正确配置

#### 3. Cookie 无法共享

**现象**：在 Blog 登录后，访问 Comic 仍显示未登录。

**排查步骤**：
1. **最常见原因**：直接访问应用端口而非 Gateway
   - ❌ `http://localhost:3000/comic/`
   - ✅ `http://localhost:8080/comic/`
2. 在浏览器开发者工具 → Application → Cookies 中检查：
   - Cookie 的 `domain` 应为 `localhost`
   - Cookie 的 `path` 应为 `/`
   - Cookie 的 `sameSite` 应为 `Lax`
3. 验证 API 的 `auth.ts` 配置是否正确

#### 4. Gateway 未启动

**现象**：前端应用显示 "网络错误" 或 "无法连接到服务器"。

**解决方案**：
1. 确认 Gateway 已启动：访问 `http://localhost:8080`
2. 检查 Gateway 日志是否有错误信息
3. 验证 Gateway 端口 8080 未被其他程序占用

## 开发命令

```bash
# 安装依赖
pnpm install

# 清理端口并启动所有服务（推荐）
pnpm dev:clean

# 启动所有服务
pnpm dev

# 清理被占用的端口
pnpm clean:ports

# 检查服务运行状态
pnpm check:services

# 构建所有应用
pnpm build

# 代码检查
pnpm lint

# 类型检查
pnpm typecheck
```

## 实用脚本

项目提供了一些实用脚本帮助开发，详见 [scripts/README.md](./scripts/README.md)：

- **clean-ports.ps1** - 清理开发服务占用的端口（3000, 3001, 3002, 3003, 5173, 8080, 8787）
- **check-services.ps1** - 检查所有服务的运行状态和端口占用情况

### 爬虫脚本

爬虫相关脚本位于 `packages/crawler/scripts/`：

#### 电影爬虫
- **run-optimized.ts** - 运行优化后的电影爬虫（增量抓取）
- **test-single-movie.ts** - 测试单个电影数据抓取
- **test-full-flow.ts** - 测试完整爬虫流程

#### 女优/厂商爬虫
- **run-actor.ts** - 运行女优详情爬虫
- **run-publisher.ts** - 运行厂商详情爬虫
- **check-avatar-status.ts** - 检查女优头像状态（调试工具）

#### 调度时间（GitHub Actions）

| 爬虫类型 | 调度时间（UTC） | 调度时间（北京时间 UTC+8） | 说明 |
|---------|---------------|------------------------|------|
| 电影爬虫 | 每天 16:00 | 每天 00:00 | 爬取新电影，自动收集女优/厂商 |
| 女优爬虫 | 每天 00:00 | 每天 08:00 | 爬取女优详情和头像 |
| 厂商爬虫 | 每天 08:00 | 每天 16:00 | 爬取厂商详情和 logo |

**执行顺序设计**：电影爬虫 → 女优爬虫（8小时后）→ 厂商爬虫（8小时后）

这样确保女优/厂商爬虫运行时，已经有从电影爬虫收集的待爬取数据。

### 数据库脚本

数据库相关脚本位于 `packages/db/scripts/`：

- **migrate-relations.ts** - 迁移关联数据
- **clean-data.ts** - 清理重复或无效数据
- **apply-index-migration.ts** - 应用索引迁移
- **rollback-migration.ts** - 回滚数据库迁移

## 部署

项目部署到 Cloudflare：
- **API**: Cloudflare Workers
- **前端应用**: Cloudflare Pages
- **数据库**: D1 (Cloudflare SQLite)
- **文件存储**: R2 (Cloudflare Object Storage)

部署配置和环境变量通过 Cloudflare Dashboard 管理。

## License

Private Project
