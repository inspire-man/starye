## 1. 基础设施搭建（PR 1）

- [ ] 1.1 在 `apps/api` 移除 `zod` 和 `@hono/zod-validator` 依赖
- [ ] 1.2 在 `apps/api` 安装 `valibot`、`@valibot/to-json-schema`、`hono-openapi`、`@scalar/hono-api-reference` 最新版本
- [ ] 1.3 修改 `apps/api/tsconfig.json` 添加 `composite: true` 和 `declaration: true`
- [ ] 1.4 修改 `apps/dashboard/tsconfig.json` 添加 `references: [{ "path": "../api" }]`
- [ ] 1.5 运行 `pnpm type-check` 验证 TypeScript 配置正确
- [ ] 1.6 创建 `apps/api/src/schemas/` 目录结构
- [ ] 1.7 创建 `schemas/common.ts` 定义 PaginationSchema、SlugSchema、TimestampSchema
- [ ] 1.8 创建 `schemas/responses.ts` 定义 SuccessResponseSchema、ErrorResponseSchema 泛型
- [ ] 1.9 创建 `schemas/index.ts` 统一导出所有 schemas
- [ ] 1.10 在 `apps/api/src/index.ts` 配置 `openAPIRouteHandler` 生成 `/openapi.json` 端点
- [ ] 1.11 在 `apps/api/src/index.ts` 配置 Scalar UI 中间件挂载到 `/docs` 端点（theme: moon, darkMode: true）
- [ ] 1.12 启动 dev server 并访问 `/openapi.json` 验证基础 OpenAPI 结构返回
- [ ] 1.13 访问 `/docs` 验证 Scalar UI 正常加载和渲染
- [ ] 1.14 测试 Scalar UI 的搜索快捷键（Ctrl/Cmd+K）和主题显示

## 2. Comics 路由迁移（PR 2 第 1 部分）

- [ ] 2.1 创建 `schemas/comic.ts` 文件
- [ ] 2.2 定义 `ComicItemSchema` 使用 `v.pipe()` 添加 `.examples()` 和 `metadata({ ref: 'ComicItem' })`
- [ ] 2.3 定义 `ComicsListDataSchema` 包含 items 和 pagination
- [ ] 2.4 定义 `GetComicsQuerySchema` 使用 `v.entries(PaginationSchema)` 继承分页参数
- [ ] 2.5 在 `GetComicsQuerySchema` 的 page/limit 字段使用 `v.pipe(v.string(), v.toNumber())` 处理类型转换
- [ ] 2.6 修改 `routes/public/comics/index.ts` 替换 `zValidator` 为 `validator`
- [ ] 2.7 修改 `routes/public/comics/index.ts` 替换 Zod schemas import 为 Valibot schemas
- [ ] 2.8 为 `GET /comics` 添加 `describeRoute()` 元数据（summary、tags、operationId: 'getComicsList'）
- [ ] 2.9 为 `GET /comics/:slug` 添加 `describeRoute()` 元数据（operationId: 'getComicDetail'）
- [ ] 2.10 在 `/docs` 中验证 Comics tag 下的端点正确显示
- [ ] 2.11 测试 query 参数验证（page=abc 应返回 400 错误）
- [ ] 2.12 在 `apps/dashboard` 中测试 RPC 客户端调用 comics API 的类型推导
- [ ] 2.13 验证 OpenAPI 文档中 ComicItem schema 的 $ref 引用正确

## 3. Movies 路由迁移（PR 2 第 2 部分）

- [ ] 3.1 创建 `schemas/movie.ts` 定义 MovieItemSchema、MoviesListDataSchema
- [ ] 3.2 定义 `GetMoviesQuerySchema` 使用类型转换和 examples
- [ ] 3.3 修改 `routes/public/movies/index.ts` 替换 `zValidator` 为 `validator`
- [ ] 3.4 为所有 movies 端点添加 `describeRoute()` 元数据（tags: ['Movies']）
- [ ] 3.5 在 `/docs` 中验证 Movies tag 下的端点正确显示
- [ ] 3.6 测试 RPC 类型推导

## 4. Actors 路由迁移（PR 2 第 3 部分）

- [ ] 4.1 创建 `schemas/actor.ts` 定义 ActorItemSchema、GetActorsQuerySchema
- [ ] 4.2 修改 `routes/actors/index.ts` 和 `routes/actors/handlers/actors.handler.ts` 迁移验证逻辑
- [ ] 4.3 为所有 actors 端点添加 `describeRoute()` 元数据（tags: ['Actors']）
- [ ] 4.4 在 `/docs` 中验证 Actors tag 下的端点正确显示

## 5. Progress 路由迁移（PR 2 第 4 部分）

- [ ] 5.1 在 `schemas/common.ts` 或创建 `schemas/progress.ts` 定义进度相关 schemas
- [ ] 5.2 修改 `routes/public/progress/index.ts` 迁移 `SaveReadingProgressSchema`、`GetReadingProgressSchema` 等
- [ ] 5.3 为所有 progress 端点添加 `describeRoute()` 元数据（tags: ['Progress']）
- [ ] 5.4 测试阅读进度保存和获取的验证逻辑

## 6. Admin Comics 路由迁移（PR 3 第 1 部分）

- [ ] 6.1 扩展 `schemas/comic.ts` 添加 Admin 专用 schemas（CreateComicSchema、UpdateComicSchema）
- [ ] 6.2 修改 `routes/admin/comics/index.ts` 迁移所有 Admin comics 端点
- [ ] 6.3 为 Admin comics 端点添加 `describeRoute()` 元数据（tags: ['Admin']，security: cookieAuth）
- [ ] 6.4 在 `/docs` 中验证 Admin comics 端点显示认证要求

## 7. Admin Movies 路由迁移（PR 3 第 2 部分）

- [ ] 7.1 扩展 `schemas/movie.ts` 添加 Admin 专用 schemas
- [ ] 7.2 迁移 `routes/admin/movies/services/movie.service.ts` 的 `MovieFilterSchema` 到 Valibot
- [ ] 7.3 修改 `routes/admin/movies/index.ts` 迁移所有 Admin movies 端点
- [ ] 7.4 为 Admin movies 端点添加 `describeRoute()` 元数据

## 8. Admin Actors & Publishers 路由迁移（PR 3 第 3 部分）

- [ ] 8.1 扩展 `schemas/actor.ts` 添加 Admin 专用 schemas
- [ ] 8.2 修改 `routes/admin/actors/index.ts` 迁移所有 Admin actors 端点
- [ ] 8.3 修改 `routes/admin/publishers/index.ts` 迁移 publishers 端点（如存在）
- [ ] 8.4 为所有 Admin 端点添加 `describeRoute()` 元数据

## 9. Shared Schemas 迁移（PR 3 第 4 部分）

- [ ] 9.1 创建 `schemas/crawler.ts` 文件
- [ ] 9.2 迁移 `apps/api/src/types.ts` 中的 `ChapterSchema`、`MangaInfoSchema`、`MovieInfoSchema` 到 `schemas/crawler.ts`
- [ ] 9.3 更新所有引用 `types.ts` 的文件改为从 `schemas/crawler` 导入
- [ ] 9.4 删除 `apps/api/src/types.ts` 文件
- [ ] 9.5 验证 crawler 相关功能正常工作

## 10. Crawler 包迁移（PR 3 第 5 部分）

- [ ] 10.1 在 `packages/crawler` 移除 `zod` 依赖
- [ ] 10.2 在 `packages/crawler` 安装 `valibot` 最新版本
- [ ] 10.3 修改 `packages/crawler/src/lib/image-processor.ts` 迁移 `R2ConfigSchema` 到 Valibot `v.looseObject()`
- [ ] 10.4 更新 image-processor 的 import 语句
- [ ] 10.5 运行 crawler 相关 tests 验证功能正常

## 11. 全局清理与验证（PR 3 第 6 部分）

- [ ] 11.1 全局搜索 `import.*from ['"]zod['"]` 确认无残留 Zod import
- [ ] 11.2 全局搜索 `zValidator` 确认无残留调用
- [ ] 11.3 全局搜索 `@hono/zod-validator` 确认无残留 import
- [ ] 11.4 检查 `apps/api/package.json` 确认 dependencies 中无 zod 相关包
- [ ] 11.5 检查 `packages/crawler/package.json` 确认 dependencies 中无 zod
- [ ] 11.6 运行 `pnpm install` 更新 pnpm-lock.yaml
- [ ] 11.7 运行 `pnpm -r type-check` 验证所有包的类型检查通过
- [ ] 11.8 运行 `pnpm test` 验证所有测试通过

## 12. OpenAPI 文档完善（PR 3 第 7 部分）

- [ ] 12.1 检查所有 tags（Comics、Movies、Actors、Progress、Admin、Auth）在 OpenAPI info.tags 中定义
- [ ] 12.2 确认所有 operationIds 唯一且符合命名规范（getComicsList、createComic 等）
- [ ] 12.3 为关键 Public API schemas 补充 `.examples()` 示例数据
- [ ] 12.4 为所有字段添加 `.description()` 说明
- [ ] 12.5 在 `/docs` 中浏览所有 API 端点，确认文档清晰完整
- [ ] 12.6 测试 Scalar UI 的请求功能（使用 Better Auth cookie 测试 Admin 端点）

## 13. RPC 客户端验证（PR 3 第 8 部分）

- [ ] 13.1 在 `apps/dashboard` 中创建测试文件验证 RPC 类型推导
- [ ] 13.2 测试调用 `client.comics.$get()` 的类型提示
- [ ] 13.3 测试调用 `client.comics[':slug'].$get()` 的参数类型推导
- [ ] 13.4 测试调用 Admin 端点的类型推导
- [ ] 13.5 验证 response 数据的类型自动推导（无需手动 `as` 断言）

## 14. 最终检查与文档更新（PR 3 第 9 部分）

- [ ] 14.1 访问 `/openapi.json` 下载完整的 OpenAPI 规范并人工 review
- [ ] 14.2 使用 OpenAPI 在线验证工具检查规范合规性
- [ ] 14.3 在 `/docs` 中测试所有 HTTP 方法（GET、POST、PATCH、DELETE）
- [ ] 14.4 检查所有 response schemas 的 $ref 引用是否正确解析
- [ ] 14.5 更新项目 README 添加 `/docs` 端点说明（如需要）
- [ ] 14.6 创建 PR 并邀请 code review
