## 1. 基础设施准备

- [ ] 1.1 创建 `packages/api-types` 目录结构
- [ ] 1.2 编写 `packages/api-types/package.json`（配置 exports 和 types 字段）
- [ ] 1.3 编写 `packages/api-types/tsconfig.json`（继承根配置）
- [ ] 1.4 编写 `packages/api-types/src/index.ts`（re-export AppType）
- [ ] 1.5 在根 `package.json` 的 workspace 中添加 `packages/api-types`
- [ ] 1.6 在 `apps/api` 中安装 Vitest（`pnpm add -D vitest @vitest/coverage-v8`）
- [ ] 1.7 创建 `apps/api/vitest.config.ts`（配置 test.globals、environment、alias）
- [ ] 1.8 在 `apps/api/package.json` 添加 test 脚本（`"test": "vitest"`）
- [ ] 1.9 创建 `apps/api/src/test/helpers.ts`（实现 createMockDb 和 createMockContext）
- [ ] 1.10 验证基础设施：运行 `pnpm -F api test` 确保 Vitest 启动成功

## 2. 通用查询构建器实现

- [ ] 2.1 创建 `apps/api/src/services/query-builder.ts`
- [ ] 2.2 实现 `FilterBuilder` 类的 `eq` 方法（带可选参数支持）
- [ ] 2.3 实现 `FilterBuilder` 类的 `like` 方法（模糊匹配）
- [ ] 2.4 实现 `FilterBuilder` 类的 `between` 方法（范围查询）
- [ ] 2.5 实现 `FilterBuilder` 类的 `jsonContains` 方法（JSON 字段查询）
- [ ] 2.6 实现 `FilterBuilder` 类的 `custom` 方法（自定义 SQL）
- [ ] 2.7 实现 `FilterBuilder` 类的 `build` 方法（返回 and(...filters)）
- [ ] 2.8 实现 `paginate` 助手函数（处理 limit/offset）
- [ ] 2.9 创建 `apps/api/src/__tests__/services/query-builder.test.ts`
- [ ] 2.10 编写测试：验证 eq 方法的可选参数忽略逻辑
- [ ] 2.11 编写测试：验证 like 方法的模糊匹配
- [ ] 2.12 编写测试：验证 between 方法的范围查询
- [ ] 2.13 编写测试：验证 build 方法返回 undefined 当无条件时
- [ ] 2.14 编写测试：验证 paginate 的分页计算逻辑
- [ ] 2.15 运行测试：确保 query-builder 测试通过

## 3. Movies Services 层实现

- [ ] 3.1 创建 `apps/api/src/routes/movies/services/` 目录
- [ ] 3.2 创建 `auth.service.ts`（提取 checkIsAdult 为 checkUserAdultStatus）
- [ ] 3.3 创建 `movie.service.ts`（实现 getMovies 函数）
- [ ] 3.4 在 `getMovies` 中使用 FilterBuilder 构建查询条件
- [ ] 3.5 实现 `getMovieByIdentifier` 函数（支持 slug 和 code 查询）
- [ ] 3.6 实现 `getHotMovies` 函数（按创建时间排序）
- [ ] 3.7 实现 `syncMovieData` 函数（同步电影数据逻辑）
- [ ] 3.8 创建 `actor.service.ts`（实现 getActors 和 getActorBySlug）
- [ ] 3.9 创建 `publisher.service.ts`（实现 getPublishers 和 getPublisherBySlug）
- [ ] 3.10 创建 `apps/api/src/routes/movies/__tests__/services/movie.service.test.ts`
- [ ] 3.11 编写测试：验证 getMovies 的成人内容过滤
- [ ] 3.12 编写测试：验证 getMovies 的分页逻辑
- [ ] 3.13 编写测试：验证 getMovieByIdentifier 的 slug 查询
- [ ] 3.14 编写测试：验证 getMovieByIdentifier 的 code 查询
- [ ] 3.15 编写测试：验证 checkUserAdultStatus 的权限校验逻辑
- [ ] 3.16 运行测试：确保 Services 层测试覆盖率 ≥ 80%

## 4. Movies Handlers 层实现

- [ ] 4.1 创建 `apps/api/src/routes/movies/handlers/` 目录
- [ ] 4.2 创建 `movies.handler.ts`（实现 getMovieList）
- [ ] 4.3 在 `getMovieList` 中解析 query 参数（page、pageSize、genres 等）
- [ ] 4.4 在 `getMovieList` 中调用 `getMovies` Service
- [ ] 4.5 实现 `getMovieDetail` Handler（调用 getMovieByIdentifier）
- [ ] 4.6 实现 `getHotMovies` Handler
- [ ] 4.7 创建 `sync.handler.ts`（实现 syncMovies Handler）
- [ ] 4.8 在 `syncMovies` 中添加 serviceAuth 中间件校验
- [ ] 4.9 创建 `actors.handler.ts`（实现 getActorsList 和 getActorDetail）
- [ ] 4.10 创建 `publishers.handler.ts`（实现 getPublishersList 和 getPublisherDetail）
- [ ] 4.11 创建 `home.handler.ts`（实现 getHomeFeatured 聚合接口）
- [ ] 4.12 创建 `apps/api/src/routes/movies/__tests__/handlers/movies.handler.test.ts`
- [ ] 4.13 编写测试：验证 getMovieList 的参数解析
- [ ] 4.14 编写测试：验证 getMovieDetail 的 404 错误处理
- [ ] 4.15 编写测试：验证 syncMovies 的权限校验
- [ ] 4.16 运行测试：确保 Handlers 层测试覆盖率 ≥ 60%

## 5. Movies 路由改造（方法链）

- [ ] 5.1 创建 `apps/api/src/routes/movies/index.ts`
- [ ] 5.2 导入所有 Handlers（getMovieList、getMovieDetail 等）
- [ ] 5.3 使用方法链定义 `moviesRoutes`（`new Hono<AppEnv>().get(...).get(...)`）
- [ ] 5.4 按功能分组添加路由注释（电影 CRUD、女优查询、厂商查询等）
- [ ] 5.5 确保所有 10 个路由使用链式语法
- [ ] 5.6 导出 `moviesRoutes`（`export const moviesRoutes = ...`）
- [ ] 5.7 在 `apps/api/src/index.ts` 中更新导入路径（`from './routes/movies'` → `from './routes/movies/index'`）
- [ ] 5.8 验证类型推导：使用 `export type AppType = typeof app`
- [ ] 5.9 在 `packages/api-types/src/index.ts` 中更新导出
- [ ] 5.10 运行 `pnpm type-check` 验证类型无错误

## 6. 删除旧文件并验证

- [ ] 6.1 备份 `apps/api/src/routes/movies.ts`（重命名为 `movies.ts.backup`）
- [ ] 6.2 在本地运行 `wrangler dev` 验证 API 启动成功
- [ ] 6.3 测试 `GET /movies` 接口（验证分页和过滤）
- [ ] 6.4 测试 `GET /movies/:slug` 接口（验证详情查询）
- [ ] 6.5 测试 `POST /movies/sync` 接口（验证同步功能）
- [ ] 6.6 测试 `GET /movies/actors/list` 接口
- [ ] 6.7 测试 `GET /movies/featured/hot` 接口
- [ ] 6.8 确认所有接口响应格式与旧版一致
- [ ] 6.9 确认无 ESLint 错误（运行 `pnpm -F api lint`）
- [ ] 6.10 删除 `movies.ts.backup`（确认无回退需求后）

## 7. Dashboard 集成验证

- [ ] 7.1 在 `apps/dashboard` 安装 `@starye/api-types`（`pnpm add -D @starye/api-types`）
- [ ] 7.2 在 Dashboard 中导入 `AppType`（`import type { AppType } from '@starye/api-types'`）
- [ ] 7.3 创建 Hono Client（`const client = hc<AppType>(baseUrl)`）
- [ ] 7.4 测试调用 `client.movies.$get({ query: { page: 1 } })`
- [ ] 7.5 验证 TypeScript 自动推导 query 参数类型
- [ ] 7.6 验证响应体类型推导正确
- [ ] 7.7 测试传递错误参数时 TypeScript 报错
- [ ] 7.8 在 Dashboard 中实际使用 RPC 客户端调用接口
- [ ] 7.9 运行 `pnpm -F dashboard type-check` 验证无类型错误
- [ ] 7.10 在浏览器中验证 Dashboard 功能正常

## 8. 文档与清理

- [ ] 8.1 在 `apps/api/src/routes/movies/README.md` 中记录目录结构
- [ ] 8.2 文档化 Services 层的使用方式（如何调用 getMovies）
- [ ] 8.3 文档化 FilterBuilder 的 API（提供示例代码）
- [ ] 8.4 文档化测试工具函数的使用（createMockDb、createMockContext）
- [ ] 8.5 更新根 `README.md` 中关于 API 模块的说明（如果有）
- [ ] 8.6 运行 `pnpm -F api test:coverage` 生成覆盖率报告
- [ ] 8.7 验证 Services 层覆盖率 ≥ 80%
- [ ] 8.8 验证 Handlers 层覆盖率 ≥ 60%
- [ ] 8.9 提交代码前运行完整检查（type-check + lint + test）
- [ ] 8.10 验证 CI/CD 流程正常（如果有 GitHub Actions）

## 9. 后续模块迁移（可选）

- [ ] 9.1 评估其他模块的迁移优先级（actors.ts、comics.ts、admin.ts）
- [ ] 9.2 复制 Movies 的 Services/Handlers 模式到 actors 模块
- [ ] 9.3 复制模式到 comics 模块
- [ ] 9.4 复制模式到 admin 模块
- [ ] 9.5 验证所有模块的测试覆盖率
- [ ] 9.6 更新 `packages/api-types` 导出所有新的路由类型
- [ ] 9.7 在 Dashboard 中测试所有新迁移模块的 RPC 调用
- [ ] 9.8 删除所有旧的路由文件（`actors.ts.backup` 等）
- [ ] 9.9 更新 Turborepo 的 `turbo.json`（如需调整 test 任务）
- [ ] 9.10 完成最终代码审查与性能测试
