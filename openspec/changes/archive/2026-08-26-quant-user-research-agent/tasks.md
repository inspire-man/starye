## 1. 数据模型与迁移

- [x] 1.1 为 Quant 工作区表和 AI 配置补充 Drizzle schema、relations 和用户索引，并保持共享日线表不带用户归属；完成标准：`@starye/db` type-check 通过且 schema 类型包含 `userId`
- [x] 1.2 生成并检查 `0041_quant_user_scope.sql`，覆盖历史归属、复合唯一索引、同步状态隔离和 AI 配置表；完成标准：迁移 SQL 无明文 secret 字段，破坏性语句可解释
- [x] 1.3 扩展 D1 migration tests，验证用户隔离、starter seed 幂等、同股共享 daily bar 和历史 name 保留；完成标准：Quant migration test 通过

## 2. API 与认证边界

- [x] 2.1 让 `requireAuth` 写入已验证 `SessionUser`，Quant 路由改为普通登录用户并传递当前 user id；完成标准：匿名 401、普通用户 200、管理员行为保持可用
- [x] 2.2 将 Quant repository、sync、value selection、shareholder returns 和 snapshot 查询改为 user-scoped；完成标准：双用户集成测试证明读写互不串数据，D1 readback 与响应一致
- [x] 2.3 新增用户级 AI config domain、Valibot schema、AES-GCM 加密/解密和读写 API；完成标准：密钥不出现在响应，缺 Secret 返回 503 且数据库无明文
- [x] 2.4 新增 Gateway Quant session guard，普通登录用户可进入 `/quant/`，匿名仍保留 `next`；完成标准：Gateway 路由测试与普通用户回归通过

## 3. Quant 前端设置入口

- [x] 3.1 扩展 Quant API client/types 支持 AI config；完成标准：客户端测试覆盖读取、保存、清除和错误 envelope
- [x] 3.2 在 Quant header 增加可访问设置按钮和 AI 配置抽屉；完成标准：桌面/窄屏均可打开，保存/清除后的状态与 API 一致，输入框不回填密钥

## 4. 验证与后续边界

- [x] 4.1 运行受影响 package 的定向测试、type-check、build、OpenSpec strict validate 和 GitNexus detect_changes；完成标准：只影响预期 Quant/Auth/Gateway symbols
- [x] 4.2 通过 `http://localhost:8080/quant/` 回归匿名、普通登录、管理员和配置抽屉；完成标准：没有 `/blog/quant/` 跳转且用户数据隔离证据可记录
- [x] 4.3 在 change 设计中固化 AkShare bridge、策略注册、结构化证据报告和 SSE Agent 的下一阶段入口；完成标准：后续工作不再把 Python/AkShare 依赖直接引入 Worker
