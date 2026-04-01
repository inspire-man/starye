# Starye API

基于 Hono.js 构建的高性能 API 服务，运行在 Cloudflare Workers 上。

## 特性

✅ **认证与授权**
- Better Auth 集成
- JWT 令牌验证
- 角色权限管理
- 服务间认证

✅ **性能优化**
- Cloudflare Cache API 边缘缓存
- 响应压缩 (gzip/br)
- ETag 支持
- 请求超时控制

✅ **可观测性**
- 请求 ID 追踪
- Server-Timing 头
- 结构化日志
- 错误监控

✅ **安全性**
- Secure Headers (CSP, HSTS, etc.)
- CORS 支持
- 速率限制
- 输入验证 (Valibot)

✅ **开发体验**
- TypeScript 类型安全
- OpenAPI 文档
- 单元测试 (Vitest)
- 热重载

## 技术栈

- **框架**: [Hono.js](https://hono.dev/) v4.12.9
- **运行时**: Cloudflare Workers
- **数据库**: [Drizzle ORM](https://orm.drizzle.team/)
- **认证**: [Better Auth](https://www.better-auth.com/)
- **验证**: [Valibot](https://valibot.dev/)
- **测试**: [Vitest](https://vitest.dev/)

## 快速开始

### 安装依赖

```bash
pnpm install
```

### 开发

```bash
pnpm dev
```

API 服务将在 `http://localhost:8787` 运行。

### 构建

```bash
pnpm build
```

### 测试

```bash
# 运行所有测试
pnpm test

# 运行单个测试文件
pnpm test -- src/middleware/__tests__/cache.test.ts

# 类型检查
pnpm type-check

# Lint
pnpm lint
```

## 项目结构

```
apps/api/
├── src/
│   ├── middleware/        # 中间件
│   │   ├── auth.ts       # 认证中间件
│   │   ├── cache.ts      # 缓存中间件
│   │   ├── error-handler.ts  # 错误处理
│   │   └── service-auth.ts    # 服务认证
│   ├── routes/           # 路由模块
│   │   ├── actors/       # 演员相关
│   │   ├── movies/       # 影片相关
│   │   ├── comics/       # 漫画相关
│   │   ├── ratings/      # 评分相关
│   │   └── admin/        # 管理后台
│   ├── schemas/          # Valibot 验证模式
│   ├── utils/            # 工具函数
│   ├── types/            # TypeScript 类型
│   └── index.ts          # 入口文件
├── wrangler.toml         # Cloudflare Workers 配置
└── package.json
```

## API 文档

### 认证

所有需要认证的端点都需要在请求头中包含 JWT 令牌：

```bash
Authorization: Bearer <token>
```

### 端点

#### Movies

- `GET /api/movies` - 获取影片列表
- `GET /api/movies/:id` - 获取影片详情
- `GET /api/movies/featured/hot` - 获取热门影片

#### Actors

- `GET /api/actors` - 获取演员列表
- `GET /api/actors/:slug` - 获取演员详情

#### Comics

- `GET /api/comics` - 获取漫画列表（需要认证）
- `GET /api/comics/:slug` - 获取漫画详情（需要认证）

#### Ratings

- `POST /api/ratings` - 提交评分（需要认证）
- `GET /api/ratings/user` - 获取用户评分历史（需要认证）
- `GET /api/ratings/player/:id` - 获取播放源评分统计

#### Admin

- `GET /api/admin/users` - 用户管理
- `GET /api/admin/movies` - 影片管理
- `GET /api/admin/stats` - 统计数据

详细的 API 文档请查看 OpenAPI 规范。

## 中间件

### 认证中间件

- `authMiddleware()` - 解析 JWT 令牌
- `requireAuth()` - 要求用户认证
- `serviceAuth()` - 服务间认证

### 缓存中间件

- `publicCache()` - 公开内容缓存 (1 分钟)
- `listCache()` - 列表缓存 (5 分钟)
- `detailCache()` - 详情缓存 (3 分钟)
- `userCache()` - 用户个性化缓存 (1 分钟)

详见 [Cloudflare Cache 文档](./CLOUDFLARE_CACHE.md)

### 其他中间件

- `requestId` - 生成请求 ID
- `logger` - 日志记录
- `timing` - 性能计时
- `secureHeaders` - 安全响应头
- `compress` - 响应压缩
- `cors` - 跨域支持

## 错误处理

API 使用统一的错误响应格式：

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "验证失败",
    "details": [],
    "requestId": "req_abc123",
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
}
```

错误码参考：
- `VALIDATION_ERROR` - 输入验证失败
- `AUTHENTICATION_ERROR` - 认证失败
- `AUTHORIZATION_ERROR` - 权限不足
- `NOT_FOUND` - 资源不存在
- `RATE_LIMIT_EXCEEDED` - 速率限制
- `INTERNAL_SERVER_ERROR` - 服务器错误

详见 [错误响应格式文档](../../openspec/changes/hono-api-robustness/ERROR_RESPONSE_FORMAT.md)

## 环境变量

在 `wrangler.toml` 中配置：

```toml
[vars]
ENVIRONMENT = "development"
DATABASE_URL = "..."
BETTER_AUTH_SECRET = "..."
```

## 部署

### Cloudflare Workers

```bash
# 部署到 production
pnpm deploy

# 部署到 staging
pnpm deploy:staging
```

## 监控

### 性能指标

通过 `Server-Timing` 响应头查看各中间件的执行时间：

```
Server-Timing: auth;dur=5.2, db;dur=12.8, total;dur=28.4
```

### 缓存命中率

通过 `X-Cache` 响应头查看缓存状态：

```
X-Cache: HIT
```

### 日志

所有请求都会记录结构化日志：

```json
{
  "requestId": "req_abc123",
  "method": "GET",
  "path": "/api/movies",
  "status": 200,
  "duration": 28.4,
  "userId": "user_123"
}
```

## 贡献

欢迎提交 Issue 和 Pull Request！

## 许可证

MIT
