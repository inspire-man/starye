## ADDED Requirements

### Requirement: Schema 目录结构组织

系统 MUST 在 `apps/api/src/schemas/` 创建按领域分类的目录结构，SHALL 包含 `common.ts`、`responses.ts`、`comic.ts`、`movie.ts`、`actor.ts`、`crawler.ts` 和统一导出的 `index.ts`。

#### Scenario: 通用 schema 管理
- **WHEN** 创建分页、slug、timestamp 等通用验证逻辑
- **THEN** 这些 schema 定义在 `schemas/common.ts` 中，并通过 `index.ts` 导出供其他路由使用

#### Scenario: 响应格式标准化
- **WHEN** 需要定义 `SuccessResponse`、`ErrorResponse` 等通用响应格式
- **THEN** 这些 schema 定义在 `schemas/responses.ts` 中，支持泛型参数以包装业务数据

#### Scenario: 领域 schema 隔离
- **WHEN** 定义漫画相关的 `ComicItemSchema`、`ChapterSchema`
- **THEN** 这些 schema 定义在 `schemas/comic.ts` 中，避免与电影或演员 schema 混杂

### Requirement: Valibot 类型强制转换

系统 SHALL 使用 Valibot 的 `pipe` 和转换 actions（如 `toNumber()`、`trim()`）处理 query 参数和 form 数据，MUST 对所有数值型 query 参数使用 `v.pipe(v.string(), v.toNumber())` 模式。

#### Scenario: 分页参数强制转换
- **WHEN** query 参数定义为 `page: v.pipe(v.string(), v.toNumber(), v.integer(), v.minValue(1))`
- **THEN** 接收到字符串 "5" 时自动转换为数字 5，并进行后续验证

#### Scenario: 字符串 trim 处理
- **WHEN** 搜索关键词定义为 `v.pipe(v.string(), v.trim(), v.minLength(1))`
- **THEN** 接收到 " 海贼王 " 时自动去除前后空格，得到 "海贼王"

#### Scenario: NaN 检测
- **WHEN** query 参数使用 `toNumber()` 转换失败（如输入 "abc"）
- **THEN** 系统返回 400 错误，提示数值转换失败

### Requirement: Object Schema 类型选择

系统 MUST 根据使用场景选择合适的 object schema 类型：API 请求使用 `v.object()`（移除未知字段），配置文件使用 `v.looseObject()`（允许扩展）。

#### Scenario: API 请求验证
- **WHEN** 定义 `CreateComicSchema = v.object({ title: v.string(), slug: v.string() })`
- **THEN** 接收到包含 `{ title: '海贼王', slug: 'one-piece', extra: 'ignored' }` 时，移除 `extra` 字段，只验证和保留 title 和 slug

#### Scenario: 配置文件验证
- **WHEN** 定义 `R2ConfigSchema = v.looseObject({ accountId: v.string(), ... })`
- **THEN** 允许配置文件包含未定义的额外字段，便于未来扩展

### Requirement: Schema Metadata 与引用

系统 SHALL 使用 `metadata({ ref: 'Name' })` 为可复用的 schema 添加引用名，MUST 在 OpenAPI 生成时使用 `$ref` 引用而非内联定义。

#### Scenario: 定义通用 schema 引用
- **WHEN** 定义 `PaginationSchema = v.pipe(v.object({ ... }), v.metadata({ ref: 'PaginationParams' }))`
- **THEN** 该 schema 在 OpenAPI 文档中注册为 `#/components/schemas/PaginationParams`

#### Scenario: 继承通用 schema
- **WHEN** 定义 `GetComicQuerySchema = v.object({ ...v.entries(PaginationSchema), keyword: v.optional(...) })`
- **THEN** 该 schema 继承 PaginationSchema 的所有字段，并添加额外的 keyword 字段

### Requirement: 示例数据标注

系统 MUST 为关键 schema 字段使用 `.examples()` 添加示例数据，SHALL 在字符串、数字等基础类型上使用 `.description()` 添加字段说明。

#### Scenario: Query 参数示例
- **WHEN** 定义 `keyword: v.pipe(v.string(), v.examples(['海贼王', 'one piece']), v.description('搜索关键词'))`
- **THEN** OpenAPI 文档包含示例和描述，帮助前端开发者理解字段用途

#### Scenario: 对象示例
- **WHEN** 定义 `ComicItemSchema = v.pipe(v.object({ ... }), v.examples([{ id: 'cm001', title: '海贼王', ... }]))`
- **THEN** OpenAPI 文档的 response 示例包含完整的结构化数据

### Requirement: 类型推导与导出

系统 SHALL 使用 `v.InferOutput<typeof Schema>` 推导 TypeScript 类型，MUST 为所有公开的 schema 导出对应的类型定义。

#### Scenario: Schema 类型导出
- **WHEN** 定义 `export const ComicItemSchema = v.object({ ... })` 和 `export type ComicItem = v.InferOutput<typeof ComicItemSchema>`
- **THEN** 其他模块可以导入 `ComicItem` 类型用于函数签名和变量声明

#### Scenario: 类型推导验证
- **WHEN** 使用 `const data = v.parse(ComicItemSchema, input)`
- **THEN** TypeScript 自动推导 `data` 的类型为 `ComicItem`，提供完整的类型安全

### Requirement: Zod 完全移除

系统 MUST 从所有文件中移除 Zod 相关 import 和 schema 定义，SHALL 确保 `apps/api/package.json` 和 `packages/crawler/package.json` 不包含 `zod` 或 `@hono/zod-validator` 依赖。

#### Scenario: API 依赖清理
- **WHEN** 执行 `pnpm remove zod @hono/zod-validator` 在 `apps/api`
- **THEN** package.json 的 dependencies 不再包含 Zod 相关包

#### Scenario: Crawler 依赖清理
- **WHEN** 执行 `pnpm remove zod` 在 `packages/crawler`
- **THEN** package.json 的 dependencies 不再包含 `zod`

#### Scenario: Import 语句替换
- **WHEN** 搜索所有 `import { z } from 'zod'` 和 `import { zValidator } from '@hono/zod-validator'`
- **THEN** 所有匹配的 import 被替换为 Valibot 和 hono-openapi 的 import
