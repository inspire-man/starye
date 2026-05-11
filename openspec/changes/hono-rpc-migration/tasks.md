## 1. 基础设施引入与共享能力建设

- [ ] 1.1 安装基础依赖：在 `apps/api` 中安装 `@hono/zod-openapi` 和 `@asteasolutions/zod-to-openapi`，以及在此次重构范围中的 Dashboard 项目（视情况是否需要补齐 `hono`）。完成标准：`package.json` 更新且 `pnpm install` 成功，服务能正常启动。
- [ ] 1.2 构建通用 Zod Schema：在 `apps/api` 提取通用的分页 Schema (`page`, `limit` 参数) 和标准的错误及成功响应规范，存放在统一复用的模块文件中。完成标准：生成了可复用的 Zod Schema 并在文件系统内可导出。
- [ ] 1.3 集成 Swagger UI：在 `apps/api` 入口处挂载 OpenAPI 文档输出端点并搭建 Swagger UI 可视化界面。完成标准：本地运行开发服务时，在浏览器中访问 `/api/swagger` 可看到带 UI 的接口文档界面骨架。

## 2. 试点接口的 OpenAPI 改造与类型导出

- [ ] 2.1 重构公共查询接口：将用于前台展示的 `actors` (女优) 和 `publishers` (厂商) 的基础查询接口，使用 `createRoute` 提供严格的请求 params/query 和响应体 Schema 定义。完成标准：接口逻辑迁移至 Zod OpenAPI 写法，并在 Swagger UI 中能正常预览。
- [ ] 2.2 重构 Admin 级别的女优接口：将后台管理端调用的 `/api/admin/actors`（包含 CRUD 与合并等操作）重构，并在 OpenAPI 层面添加安全声明。完成标准：对应的所有接口入参（Body/Query/Params）与返回值具备全量 `z.object` 类型声明和校验能力。
- [ ] 2.3 重构 Admin 级别的厂商接口：同样重构 `/api/admin/publishers` 并完善类型。完成标准：与上一步一致，保证相应的后端业务逻辑在新容器下通过请求体校验进行运转。
- [ ] 2.4 挂载路由并统一抛出类型：在 API 顶层入口（如 `index.ts`）聚合上述模块，完成规范的链式 `.route` 挂载，最后声明并导出唯一的 `AppType` 以便前端 Workspace 垮包依赖引入。完成标准：`apps/api` 正确导出 `export type AppType = typeof app`。

## 3. 前端通信链路替换与代码清理 (Dashboard 试点)

- [ ] 3.1 实例化 Hono RPC Client：在 Dashboard 的网络请求服务层引入 `hono/client`，并依靠 Workspace 引入的 `AppType` 构造单例，处理如原生 `fetch` 与 Auth 结合的请求流。完成标准：获得一个形如 `const client = hc<AppType>(baseUrl)` 且有智能提示的单例。
- [ ] 3.2 改造 Dashboard 女优管理页面链路：将页面里涉及的所有查询及增删改查动作，均切换为对应的 `client.api.admin.actors` 等 RPC 调用路径。完成标准：在编辑器中鼠标悬浮可识别由 Zod 声明下发的属性结构提示，并且增删改查前端功能均验证可用。
- [ ] 3.3 改造 Dashboard 厂商管理页面链路：将其所有查询与增删动作变更为 `client.api.admin.publishers` 的 RPC 触发方式。完成标准：页面通过 RPC 接口获取厂商数据，相关的表单修改均保存生效。
- [ ] 3.4 剥离与清理关联代码与类型：在完成上述替换后，把 Dashboard 中为此试点涉及的女优和厂商管理写的老旧手动接口类型和 `axios` (或其他冗余提取的请求方式) 从页面中移除打扫。完成标准：项目全仓运行 `pnpm run type-check` 与 linter 不触发涉及修改页面的新报错，保持代码清爽。
