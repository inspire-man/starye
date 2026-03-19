# Starye

个人全栈项目，基于 Cloudflare Workers + D1 + Nuxt 3 + Vue 3 技术栈。

## 项目结构

```
starye/
├── apps/
│   ├── api/           # API Worker (Hono + Better Auth + D1)
│   ├── gateway/       # 网关 Worker (反向代理)
│   ├── dashboard/     # 管理后台 (Vue 3 + Vite)
│   ├── blog/          # 博客应用 (Nuxt 3)
│   ├── comic/         # 漫画应用 (Nuxt 3)
│   ├── movie/         # 影视应用 (Nuxt 3)
│   └── auth/          # 鉴权应用 (Nuxt 3)
└── packages/
    ├── db/            # Drizzle ORM + Schema
    ├── ui/            # 共享 UI 组件
    └── locales/       # 国际化资源
```

## 技术栈

- **后端**: TypeScript + Cloudflare Workers + D1 (SQLite) + Drizzle ORM
- **鉴权**: Better Auth (GitHub 登录，Session 存储在 D1)
- **前端**: Vue 3 + Nuxt 3 + TypeScript + Vite
- **网关**: Cloudflare Worker 反向代理
- **部署**: Cloudflare Pages + Workers
- **存储**: Cloudflare R2 Object Storage（图片和媒体文件）

## 核心功能

### Dashboard 管理后台
- 用户管理和 R18 白名单控制
- 漫画和电影元数据管理
- 演员和出版商资料管理
- **图片上传**：支持封面、头像等图片直接上传到 R2（仅管理员，最大 10MB）
- 爬虫任务监控和管理
- 操作审计日志查询和导出

### 用户应用
- 漫画/电影浏览和搜索
- 阅读进度和观看进度自动保存
- GitHub 登录和 R18 内容访问控制

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

### 服务启动顺序

**重要：必须按以下顺序启动服务，确保依赖关系正确。**

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
pnpm dev --filter comic

# Movie (端口 3001)
pnpm dev --filter movie

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

### 常见问题排查

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

# 启动所有服务（推荐按上述顺序分别启动）
pnpm dev

# 构建所有应用
pnpm build

# 代码检查
pnpm lint

# 类型检查
pnpm typecheck
```

## 部署

项目部署到 Cloudflare：
- **API**: Cloudflare Workers
- **前端应用**: Cloudflare Pages
- **数据库**: D1 (Cloudflare SQLite)
- **文件存储**: R2 (Cloudflare Object Storage)

部署配置和环境变量通过 Cloudflare Dashboard 管理。

## License

Private Project
