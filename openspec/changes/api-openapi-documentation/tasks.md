## Phase 1: 基础设施搭建

### 1.1 安装依赖包
- [ ] 安装 `hono-openapi` 和 `@hono/swagger-ui`
  ```bash
  pnpm add hono-openapi @hono/swagger-ui -F api
  ```

### 1.2 创建 Schema 目录结构
- [ ] 创建 `apps/api/src/schemas/` 目录
- [ ] 创建 `apps/api/src/schemas/common/` 子目录
- [ ] 创建 `apps/api/src/schemas/entities/` 子目录

### 1.3 实现通用响应模板
- [ ] 创建 `schemas/common/responses.ts`
  - 实现 `dataResponse<T>()` 辅助函数
  - 实现 `paginatedResponse<T>()` 辅助函数
  - 实现 `errorResponse` schema
  - 实现 `commonErrorResponses` 常量对象
  - 实现 `withCommonErrors()` 辅助函数
- [ ] 创建 `schemas/common/pagination.ts`
  - 实现 `paginationMeta` schema
- [ ] 添加 JSDoc 注释说明使用场景

### 1.4 创建示例 Entity Schema
- [ ] 创建 `schemas/entities/movie.schema.ts`
  - 实现 `movieSchema`（完整字段）
  - 实现 `movieListItemSchema`（列表项精简版）
  - 实现 `movieDetailSchema`（详情含关联数据）
- [ ] 创建 `schemas/entities/actor.schema.ts`
  - 实现 `actorSchema`
  - 实现 `actorListItemSchema`
  - 实现 `actorDetailSchema`

---

## Phase 2: POC 验证

### 2.1 配置 OpenAPI 生成端点
- [ ] 在 `apps/api/src/index.ts` 中引入 `openAPISpecs`
- [ ] 添加 `/openapi.json` 端点
  ```typescript
  import { openAPISpecs } from 'hono-openapi'
  
  app.get('/openapi.json', openAPISpecs({
    documentation: {
      openapi: '3.1.0',
      info: {
        title: 'Starye API',
        version: '1.0.0',
        description: '星野项目 API 文档'
      },
      servers: [
        { url: 'https://api.starye.com', description: 'Production' },
        { url: 'http://localhost:8787', description: 'Development' }
      ]
    }
  }))
  ```

### 2.2 集成 Swagger UI
- [ ] 在 `apps/api/src/index.ts` 中引入 `swaggerUI`
- [ ] 添加 `/docs` 端点
  ```typescript
  import { swaggerUI } from '@hono/swagger-ui'
  
  app.get('/docs', swaggerUI({ url: '/openapi.json' }))
  ```

### 2.3 为 health 路由添加文档
- [ ] 在 `routes/health/index.ts` 中添加 `describeRoute()`
  - 定义 response schema
  - 设置 tags 为 `['Health']`
  - 添加 summary 和 description
- [ ] 验证 `/openapi.json` 包含 health 路由
- [ ] 验证 Swagger UI 显示 health 路由

### 2.4 为 movies 路由添加完整文档
- [ ] 创建 `routes/movies/route-schemas.ts`
  - 定义 `movieListQuerySchema`
  - 定义 `movieListResponseSchema`
  - 定义 `movieListRouteConfig`
  - 定义 `movieDetailParamsSchema`
  - 定义 `movieDetailResponseSchema`
  - 定义 `movieDetailRouteConfig`
- [ ] 在 `routes/movies/index.ts` 中应用 `describeRoute()`
  - GET `/` - 电影列表
  - GET `/:identifier` - 电影详情

### 2.5 POC 验证清单
- [ ] 访问 `/openapi.json`，检查 schema 格式
  - [ ] request parameters 正确（query, params）
  - [ ] response schemas 正确（200, 403, 404, 500）
  - [ ] Zod union types 转换为 `oneOf`
- [ ] 访问 `/docs`，测试 Swagger UI
  - [ ] 界面加载正常
  - [ ] 可以执行接口调用
  - [ ] 响应示例显示正确
- [ ] 验证 RPC 兼容性
  - [ ] Dashboard 的 `hc<AppType>()` 类型推导正常
  - [ ] `apiClient.api.movies.$get()` 自动补全可用
  - [ ] TypeScript 编译无错误
- [ ] 检查嵌套路由 tags
  - [ ] `/api/movies/actors` 的 tags 不会影响 `/api/actors`
  - [ ] 每个路由的 tags 独立正确

### 2.6 输出 POC 报告
- [ ] 记录验证结果
  - RPC 兼容性评估
  - 文档生成质量评估
  - 发现的问题清单
- [ ] 估算全量迁移工作量
  - 每个路由平均耗时
  - 总体时间预估
- [ ] 决策：继续全量迁移 or 调整方案

---

## Phase 3: 全量迁移（按 POC 结果决定）

### 3.1 完成 P0 核心 API 文档

#### 3.1.1 actors 路由
- [ ] 创建 `routes/actors/route-schemas.ts`
- [ ] 为 GET `/` 添加文档（演员列表）
- [ ] 为 GET `/:slug` 添加文档（演员详情）

#### 3.1.2 publishers 路由
- [ ] 创建 `routes/publishers/route-schemas.ts`
- [ ] 为 GET `/` 添加文档（出版社列表）
- [ ] 为 GET `/:slug` 添加文档（出版社详情）

#### 3.1.3 创建缺失的 Entity Schema
- [ ] 创建 `schemas/entities/publisher.schema.ts`
- [ ] 创建 `schemas/entities/comic.schema.ts`（如需要）

### 3.2 完成 P1 公开 API 文档

#### 3.2.1 public/movies 路由
- [ ] 创建 `routes/public/movies/route-schemas.ts`（如需要）
- [ ] 为所有公开电影路由添加文档

#### 3.2.2 public/comics 路由
- [ ] 创建 `routes/public/comics/route-schemas.ts`
- [ ] 为所有公开漫画路由添加文档
- [ ] 定义 comic response schemas

#### 3.2.3 public/progress 路由
- [ ] 创建 `routes/public/progress/route-schemas.ts`
- [ ] 为进度记录路由添加文档

### 3.3 完成 P2 管理 API 文档

#### 3.3.1 admin/movies 路由
- [ ] 创建 `routes/admin/movies/route-schemas.ts`
- [ ] 为所有管理电影路由添加文档

#### 3.3.2 admin/actors 路由
- [ ] 创建 `routes/admin/actors/route-schemas.ts`
- [ ] 为所有管理演员路由添加文档

#### 3.3.3 admin/publishers 路由
- [ ] 创建 `routes/admin/publishers/route-schemas.ts`
- [ ] 为所有管理出版社路由添加文档

#### 3.3.4 admin/crawlers 路由
- [ ] 创建 `routes/admin/crawlers/route-schemas.ts`
- [ ] 为爬虫管理路由添加文档

#### 3.3.5 admin/audit-logs 路由
- [ ] 创建 `routes/admin/audit-logs/route-schemas.ts`
- [ ] 为审计日志路由添加文档

#### 3.3.6 admin/r18-whitelist 路由
- [ ] 创建 `routes/admin/r18-whitelist/route-schemas.ts`
- [ ] 为 R18 白名单路由添加文档

#### 3.3.7 admin/cache 路由
- [ ] 创建 `routes/admin/cache/route-schemas.ts`
- [ ] 为缓存管理路由添加文档

### 3.4 完成 P3 其他 API 文档

#### 3.4.1 auth 路由
- [ ] 创建 `routes/auth/route-schemas.ts`（如需要）
- [ ] 为认证相关路由添加文档

#### 3.4.2 upload 路由
- [ ] 创建 `routes/upload/route-schemas.ts`
- [ ] 为上传路由添加文档

#### 3.4.3 posts 路由
- [ ] 创建 `routes/posts/route-schemas.ts`
- [ ] 为文章路由添加文档

### 3.5 完成 comics 路由
- [ ] 创建 `routes/comics/route-schemas.ts`
- [ ] 为所有漫画路由添加文档

---

## Phase 4: 验证与优化

### 4.1 全量验证
- [ ] 检查所有路由都有 `describeRoute()`
  - 可通过 grep 搜索未添加的路由：`grep -r "\.get\|\.post\|\.patch\|\.delete" --include="*.ts" | grep -v describeRoute`
- [ ] 验证 OpenAPI spec 完整性
  - [ ] 访问 `/openapi.json`
  - [ ] 检查所有路由都在 `paths` 中
  - [ ] 检查所有 schemas 正确定义
- [ ] Swagger UI 全面测试
  - [ ] 测试所有 GET 接口
  - [ ] 测试所有 POST/PATCH/DELETE 接口
  - [ ] 验证参数验证是否正确

### 4.2 RPC 客户端回归测试
- [ ] Dashboard 集成测试
  - [ ] `hc<AppType>()` 类型推导完整
  - [ ] 所有 API 调用正常
  - [ ] TypeScript 编译无错误
- [ ] comic-app 和 movie-app（如需要）
  - [ ] 现有 axios 调用不受影响

### 4.3 代码质量检查
- [ ] 所有 Schema 文件都有 JSDoc 注释
- [ ] 命名符合规范（{entity}Schema, {route}{Action}RouteConfig）
- [ ] 无重复定义（使用 `withCommonErrors` 等辅助函数）
- [ ] 添加 ESLint 规则（可选）
  - 强制要求路由必须有 `describeRoute()`
  - 强制要求 Schema 有注释

### 4.4 文档优化（可选）
- [ ] 为关键接口添加 `examples`
- [ ] 为 admin API 添加 security schemes（JWT/Session）
- [ ] 添加更详细的 description

### 4.5 性能检查
- [ ] 验证 `/openapi.json` 响应时间
  - 目标：< 100ms
- [ ] 验证添加 `describeRoute()` 后的请求性能
  - 确保中间件不影响接口响应时间

---

## Phase 5: 文档与交付

### 5.1 更新项目文档
- [ ] 在 `apps/api/README.md` 中添加 OpenAPI 文档说明
  - 如何访问 Swagger UI
  - 如何查看 OpenAPI 规范
  - Schema 组织结构说明
- [ ] 更新开发指南
  - 新增路由时如何添加 `describeRoute()`
  - Schema 命名规范
  - 通用模板使用指南

### 5.2 CI/CD 集成（可选）
- [ ] 添加 OpenAPI spec 验证
  - 检查所有路由都有文档
  - 检查 schema 格式正确
- [ ] 生成静态文档（可选）
  - 使用 Redoc 或其他工具生成静态 HTML

### 5.3 通知团队
- [ ] 通知前端团队 Swagger UI 地址
- [ ] 通知外部开发者（如有）
- [ ] 更新 API 文档链接

---

## 回滚计划

如果在任何阶段发现严重问题，按以下步骤回滚：

### Phase 1 失败
- [ ] 删除 `schemas/` 目录
- [ ] 卸载依赖：`pnpm remove hono-openapi @hono/swagger-ui -F api`
- [ ] 无其他影响

### Phase 2 失败
- [ ] 移除 POC 路由的 `describeRoute()`
- [ ] 注释掉 `/openapi.json` 和 `/docs` 端点
- [ ] 保留 `schemas/` 目录供后续使用

### Phase 3 失败
- [ ] Git 回滚到上一个工作的 commit
- [ ] 已完成的路由保留，未完成的停止迁移
- [ ] 评估是否切换到其他方案

---

## 里程碑与时间估算

| 阶段 | 任务数 | 预估时间 | 里程碑 |
|------|-------|---------|-------|
| Phase 1 | 10 | 1-2 天 | 基础设施完成 |
| Phase 2 | 15 | 1 天 | POC 验证完成 |
| Phase 3.1 | 10 | 2-3 天 | P0 核心 API 完成 |
| Phase 3.2 | 8 | 2 天 | P1 公开 API 完成 |
| Phase 3.3 | 15 | 3-4 天 | P2 管理 API 完成 |
| Phase 3.4-3.5 | 8 | 1-2 天 | P3 其他 API 完成 |
| Phase 4 | 12 | 1 天 | 验证与优化完成 |
| Phase 5 | 6 | 0.5 天 | 文档与交付完成 |
| **总计** | **84** | **11-15 天** | **全部完成** |

---

## 注意事项

1. **每完成一组路由提交一次 commit**，便于回滚
2. **优先解决 POC 阶段发现的问题**，避免批量返工
3. **遇到 rhinobase/hono-openapi 的 bug 立即提 issue**，不要等待
4. **保持 Schema 命名一致性**，使用统一的命名规范
5. **充分利用通用模板**，避免重复代码
6. **定期测试 RPC 客户端**，确保类型推导不被破坏
