## Context

Starye API 当前使用 Zod 作为验证库，所有路由使用 `@hono/zod-validator` 的 `zValidator` 进行请求验证。项目缺乏标准化的 API 文档，前端开发者需要阅读代码或手动测试接口。Hono 官方推荐使用 Standard Schema Validator 配合 `hono-openapi` 实现验证和文档的自动化生成。Valibot 作为 Standard Schema 的实现之一，相比 Zod 具有更小的体积（4KB vs 14KB）和更灵活的 pipeline 设计。

**当前状态：**
- `apps/api/src/routes/` 中约 15+ 路由文件使用 `zValidator`
- `apps/api/src/types.ts` 定义了 `ChapterSchema`、`MangaInfoSchema`、`MovieInfoSchema` 等 Zod schemas
- `packages/crawler/src/lib/image-processor.ts` 使用 Zod 验证 R2 配置
- 无 OpenAPI 规范文档
- 无交互式 API 文档页面

**约束条件：**
- Cloudflare Workers 环境，bundle size 敏感
- 需保持 Hono RPC 类型推导正常工作
- 不能引入破坏性变更（对外 API 契约不变）
- 需同时支持开发和生产环境

## Goals / Non-Goals

**Goals:**
- 完全移除 Zod，使用 Valibot 替代所有验证逻辑
- 自动生成符合 OpenAPI 3.0 规范的 API 文档
- 提供现代化的交互式文档 UI（Scalar）
- 优化 TypeScript 配置以确保 RPC 类型推导稳定
- 建立 schema 组织的最佳实践（按领域分类）
- 减少 API bundle size

**Non-Goals:**
- 不修改对外 API 的请求/响应格式（仅内部验证库更换）
- 不为 `movie-app`、`comic-app` 等客户端应用添加 RPC 支持（它们使用 axios）
- 不改变现有路由的业务逻辑
- 不替换 Better Auth 认证系统
- 不在本次变更中添加 API 版本控制（v1/v2）

## Decisions

### 决策 1：Valibot vs Zod

**选择：Valibot**

**理由：**
- Bundle size 优势：4KB vs 14KB（减少 70%）
- 官方支持 Standard Schema 规范，与 `hono-openapi` 原生集成
- Pipeline 设计更灵活（`v.pipe(v.string(), v.toNumber(), v.integer())`）
- Valibot v1.2 新增的 `toNumber()`、`toBoolean()` 等 coercion actions 完美适配 query 参数处理
- `.examples()` 和 `metadata({ ref })` 直接支持 OpenAPI 文档增强

**替代方案：**
- 继续使用 Zod：bundle size 大，不支持 Standard Schema
- ArkType：学习曲线陡峭，社区小
- TypeBox：主要面向 JSON Schema，与 Hono 生态集成不如 Valibot

### 决策 2：hono-openapi vs 手动编写 OpenAPI

**选择：hono-openapi**

**理由：**
- `validator()` 自动从 Valibot schema 生成 OpenAPI request schema，无需手动编写
- `resolver()` 处理 response schema 到 JSON Schema 的转换
- `describeRoute()` 提供类型安全的元数据定义
- 版本 0.3.1+ 修复了类型推导问题，不影响 Hono RPC

**替代方案：**
- 手动维护 OpenAPI YAML/JSON：工作量大，容易与代码脱节
- Zod OpenAPI Hono：绑定 Zod，无法迁移到 Valibot
- Swagger JSDoc：注释驱动，不够类型安全

### 决策 3：Scalar UI vs Swagger UI vs Redoc

**选择：Scalar UI（moon 主题）**

**理由：**
- 现代化设计，深色模式优秀
- 原生 Hono 集成（`@scalar/hono-api-reference`）
- 支持自定义 CSS 和品牌色
- 搜索体验优秀（Cmd+K 快捷键）
- 性能优秀，适合 Cloudflare Workers

**替代方案：**
- Swagger UI：设计陈旧，不够现代
- Redoc：单向文档，无交互式请求测试
- RapiDoc：功能丰富但过于复杂

### 决策 4：v.object() vs v.looseObject()

**选择：分场景使用**

**API 请求验证：`v.object()`**
- 移除未知字段，防止潜在的注入攻击
- 生成 `additionalProperties: false` 到 OpenAPI

**配置文件验证：`v.looseObject()`**
- 允许未来扩展配置项
- 适合 R2Config、Crawler 配置等场景

### 决策 5：TypeScript Project References

**选择：启用 composite + references**

**理由：**
- 解决 RPC 类型推导在大型 monorepo 中的问题
- `composite: true` + `declaration: true` 生成独立的 .d.ts 文件
- `references` 建立明确的依赖关系，加速类型检查

**配置：**
```json
// apps/api/tsconfig.json
{ "compilerOptions": { "composite": true, "declaration": true } }

// apps/dashboard/tsconfig.json
{ "references": [{ "path": "../api" }] }
```

### 决策 6：保留 api-types 包

**选择：保留**

**理由：**
- 符合 Hono RPC 最佳实践（官方推荐在 monorepo 中使用独立包）
- 解耦客户端和服务端实现
- 未来可扩展：mock 工厂、类型守卫、辅助函数
- 避免 `apps/dashboard` 直接依赖 `apps/api` 的实现细节

### 决策 7：Query 参数类型处理

**选择：显式 coercion pipeline**

**模式：**
```typescript
const QuerySchema = v.object({
  page: v.pipe(
    v.string(),        // 接收 string
    v.toNumber(),      // 强制转换
    v.integer(),       // 验证整数
    v.minValue(1),     // 业务规则
  ),
})
```

**理由：**
- Query 参数永远是 string，需要显式转换
- `toNumber()` 内置 NaN 检测，比 `z.coerce` 更安全
- 语义清晰，易于理解和维护

### 决策 8：三阶段迁移策略

**选择：基础设施 → Public API → Admin API**

**Phase 1（PR 1）：基础设施（1 天）**
- 安装依赖、配置 TypeScript、创建 schemas 目录结构
- 配置 OpenAPI + Scalar UI
- 创建通用 schemas（common.ts、responses.ts）

**Phase 2（PR 2）：Public API（2-3 天）**
- 迁移 `/comics`、`/movies`、`/actors`、`/progress` 路由
- 验证 RPC 类型推导
- 测试 OpenAPI 文档生成

**Phase 3（PR 3）：Admin API + 清理（2 天）**
- 迁移 `/admin/*` 路由
- 迁移 `types.ts` 和 crawler schemas
- 移除所有 Zod 依赖

**理由：**
- 分阶段降低风险，每个 PR 可独立测试
- Public API 先行，快速验证技术方案
- Admin API 复杂度高，放在最后处理

## Risks / Trade-offs

### [风险] hono-openapi 版本要求

**问题：** `hono-openapi` < 0.3.1 存在 `describeRoute` 影响 RPC 类型推导的 bug

**缓解：** 使用 `pnpm add hono-openapi@latest` 确保安装 >= 0.3.1 版本，并在 PR 1 中验证 RPC 类型推导正常

---

### [风险] Query 参数类型转换遗漏

**问题：** 开发者可能忘记使用 `toNumber()` 而直接用 `v.number()`，导致 query 参数验证失败

**缓解：** 在 `schemas/common.ts` 提供 `PageNumberSchema`、`LimitSchema` 等预定义模板，统一处理类型转换

---

### [风险] RPC 类型推导失败

**问题：** TypeScript Project References 配置错误或 `AppType` 导出不正确

**缓解：**
- 在 PR 1 中完成 TypeScript 配置优化
- 在 PR 2 的每个路由迁移后立即测试 RPC 客户端调用
- 确保 `export type AppType = typeof routes` 在 `index.ts` 中正确导出

---

### [权衡] v.object() 移除未知字段 vs v.looseObject()

**权衡：** `v.object()` 提高安全性但可能影响向后兼容性

**决策：**
- 对外 API 使用 `v.object()`（安全优先）
- 内部配置使用 `v.looseObject()`（灵活优先）
- 如遇兼容性问题，可针对特定端点调整

---

### [权衡] Bundle size vs 功能丰富度

**权衡：** Valibot 体积小但生态和文档不如 Zod 成熟

**决策：** Valibot 已在 1.0+ 版本稳定，社区活跃，值得投入。若遇复杂验证场景，可使用 `v.custom()` 或 `v.rawCheck()` 自定义

---

### [风险] OpenAPI 文档与实际实现不一致

**问题：** 手动编写的 `describeRoute` responses 可能与实际 handler 返回值不一致

**缓解：**
- 在 tests 中验证实际响应与 schema 定义一致
- 使用 TypeScript 确保 `c.json()` 返回的类型与 response schema 匹配
- 定期 review OpenAPI 文档与代码实现

## Migration Plan

### Phase 1：基础设施搭建（PR 1）

**时间：第 1 天**

1. **依赖管理**
   ```bash
   cd apps/api
   pnpm remove zod @hono/zod-validator
   pnpm add valibot @valibot/to-json-schema hono-openapi @scalar/hono-api-reference
   ```

2. **TypeScript 配置**
   - 修改 `apps/api/tsconfig.json`：添加 `composite: true` 和 `declaration: true`
   - 修改 `apps/dashboard/tsconfig.json`：添加 `references: [{ "path": "../api" }]`
   - 验证：运行 `pnpm type-check`

3. **Schema 目录结构**
   ```bash
   mkdir -p apps/api/src/schemas
   touch apps/api/src/schemas/{common,responses,comic,movie,actor,crawler,index}.ts
   ```

4. **创建通用 Schemas**
   - `schemas/common.ts`：PaginationSchema、SlugSchema、TimestampSchema
   - `schemas/responses.ts`：SuccessResponseSchema、ErrorResponseSchema

5. **配置 OpenAPI + Scalar**
   - 修改 `apps/api/src/index.ts`
   - 添加 `app.get('/openapi.json', openAPIRouteHandler(...))`
   - 添加 `app.get('/docs', Scalar({ ... }))`
   - 配置 info、servers、tags、securitySchemes

6. **验证**
   - 启动 dev server：`pnpm dev`
   - 访问 `/openapi.json` 确认返回基础 OpenAPI 结构
   - 访问 `/docs` 确认 Scalar UI 正常加载

### Phase 2：Public API 迁移（PR 2）

**时间：第 2-3 天**

**迁移顺序：**
1. `/comics` 路由（作为模板）
2. `/movies` 路由
3. `/actors` 路由
4. `/progress` 路由

**每个路由的迁移步骤：**
1. 创建对应的 schema 文件（如 `schemas/comic.ts`）
2. 将 Zod schemas 转换为 Valibot schemas
3. 替换 `import { zValidator } from '@hono/zod-validator'` 为 `import { validator } from 'hono-openapi'`
4. 替换 `zValidator('query', schema)` 为 `validator('query', schema)`
5. 添加 `describeRoute()` 元数据
6. 测试 RPC 类型推导
7. 检查 OpenAPI 文档生成

**验证清单：**
- [ ] 所有端点在 `/docs` 中可见
- [ ] RPC 客户端类型推导正确（在 dashboard 中测试）
- [ ] Query 参数类型转换正常（测试 page/limit）
- [ ] Response schema 与实际返回值匹配
- [ ] Examples 在文档中正确展示

### Phase 3：Admin API + Crawler + 清理（PR 3）

**时间：第 4-5 天**

1. **Admin Routes 迁移**
   - `/admin/comics`
   - `/admin/movies`
   - `/admin/actors`
   - `/admin/publishers`

2. **Shared Types 迁移**
   - 将 `apps/api/src/types.ts` 内容迁移到 `schemas/crawler.ts`
   - 删除 `types.ts` 文件
   - 更新所有引用该文件的 import 路径

3. **Crawler 包迁移**
   - 修改 `packages/crawler/package.json`：移除 `zod`，添加 `valibot`
   - 迁移 `R2ConfigSchema` 到 Valibot（使用 `v.looseObject()`）
   - 更新 `image-processor.ts` 的 import

4. **最终清理**
   - 全局搜索 `import.*from ['"]zod['"]`，确认无残留
   - 全局搜索 `zValidator`，确认无残留
   - 运行 `pnpm install` 更新 lock 文件
   - 运行所有 tests 确保无回归

5. **文档完善**
   - 检查所有 tags 是否定义
   - 确认所有 operationIds 唯一且符合命名规范
   - 补充缺失的 examples 和 descriptions

### Rollback 策略

**如遇严重问题，按阶段回滚：**

- **Phase 1 失败**：删除新增依赖，恢复 Zod 依赖，删除 schemas 目录
- **Phase 2 失败**：保留基础设施，仅回滚已迁移的路由文件（git revert）
- **Phase 3 失败**：保留 Phase 1-2 成果，回滚 Admin 路由和 Crawler 迁移

## Technical Details

### Schema 组织架构

```
apps/api/src/schemas/
├── common.ts           # 通用类型（分页、slug、时间戳）
├── responses.ts        # 标准响应格式（SuccessResponse、ErrorResponse）
├── comic.ts            # 漫画相关 schemas
├── movie.ts            # 电影相关 schemas
├── actor.ts            # 演员相关 schemas
├── crawler.ts          # Crawler 使用的 schemas（从 types.ts 迁移）
└── index.ts            # 统一导出
```

### Valibot Schema 模式

**Query 参数（需要类型转换）：**
```typescript
const GetComicsQuerySchema = v.object({
  page: v.pipe(
    v.string(),
    v.toNumber(),
    v.integer(),
    v.minValue(1),
    v.examples(['1', '5', '10']),
  ),
  keyword: v.optional(v.pipe(
    v.string(),
    v.trim(),
    v.minLength(1),
    v.maxLength(50),
  )),
})
```

**Request Body（JSON）：**
```typescript
const CreateComicSchema = v.object({
  title: v.pipe(
    v.string(),
    v.minLength(1),
    v.maxLength(100),
  ),
  slug: v.pipe(
    v.string(),
    v.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  ),
  status: v.picklist(['ongoing', 'completed', 'hiatus']),
})
```

**Response Schema（带引用和示例）：**
```typescript
const ComicItemSchema = v.pipe(
  v.object({
    id: v.string(),
    title: v.string(),
    slug: v.string(),
    cover: v.nullable(v.pipe(v.string(), v.url())),
    status: v.picklist(['ongoing', 'completed', 'hiatus']),
  }),
  v.examples([{
    id: 'cm001',
    title: '海贼王',
    slug: 'one-piece',
    cover: 'https://cdn.example.com/one-piece.jpg',
    status: 'ongoing',
  }]),
  v.metadata({ ref: 'ComicItem' }),
)
```

### OpenAPI 配置结构

```typescript
app.get('/openapi.json', openAPIRouteHandler(app, {
  documentation: {
    openapi: '3.0.0',
    info: {
      title: 'Starye API',
      version: '1.0.0',
      description: '...',
      contact: { name: 'Starye Team', url: '...' },
    },
    servers: [
      { url: 'http://localhost:8787', description: '本地开发环境' },
      { url: 'https://api.starye.example.com', description: '生产环境' },
    ],
    tags: [
      { name: 'Comics', description: '漫画相关接口' },
      { name: 'Movies', description: '电影相关接口' },
      // ...
    ],
    components: {
      securitySchemes: {
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'better-auth.session_token',
        },
      },
    },
  },
}))
```

### Scalar UI 配置

```typescript
app.get('/docs', Scalar({
  url: '/openapi.json',
  theme: 'moon',
  configuration: {
    darkMode: true,
    searchHotKey: 'k',
    defaultOpenAllTags: true,
    tagsSorter: 'alpha',
    operationsSorter: 'alpha',
    authentication: {
      preferredSecurityScheme: 'cookieAuth',
    },
    customCss: `
      :root {
        --scalar-color-accent: #6366f1;
        --scalar-color-1: #1e293b;
        --scalar-color-2: #0f172a;
      }
    `,
  },
  pageTitle: 'Starye API Documentation',
}))
```

### 路由文档化模式

```typescript
import { describeRoute, resolver, validator } from 'hono-openapi'
import * as v from 'valibot'

publicComics.get(
  '/',
  describeRoute({
    summary: '获取漫画列表',
    description: '支持分页和关键词搜索',
    tags: ['Comics'],
    operationId: 'getComicsList',
    responses: {
      200: {
        description: '成功返回漫画列表',
        content: {
          'application/json': {
            schema: resolver(SuccessResponseSchema(ComicsListDataSchema)),
          },
        },
      },
      400: {
        description: '请求参数错误',
        content: {
          'application/json': { schema: resolver(ErrorResponseSchema) },
        },
      },
    },
  }),
  validator('query', GetComicsQuerySchema),  // 自动生成到 OpenAPI
  async (c) => {
    const query = c.req.valid('query')
    // 业务逻辑...
  }
)
```

## Open Questions

1. **品牌色具体取值**：`--scalar-color-accent` 应该使用什么颜色？（建议：#6366f1 indigo-500）

2. **生产环境域名**：`servers` 中的生产环境 URL 是什么？（建议：待部署后更新）

3. **是否需要为所有 schema 添加 examples**：还是只为关键的公开 API 添加？（建议：至少为 Public API 添加，Admin API 可选）

4. **是否需要 API 版本前缀**：如 `/api/v1/comics`？（建议：本次变更不引入，未来考虑）
