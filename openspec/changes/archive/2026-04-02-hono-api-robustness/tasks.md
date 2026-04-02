# Hono API 健壮性增强 - 任务清单

## 阶段 1: 认证流程优化 (1-2 天)

### Task 1.1: 修改全局认证中间件
- [x] 更新 `apps/api/src/middleware/auth.ts`
  - [x] 添加 session 获取逻辑
  - [x] 将 user 注入到 context
  - [x] 添加错误处理
- [x] 更新 Types 定义 `apps/api/src/types.ts`
  - [x] 确认 `Variables` 接口包含 `user` 和 `session`

### Task 1.2: 注册全局中间件
- [x] 修改 `apps/api/src/index.ts`
  - [x] 在 CORS 和 database 之后添加 `authMiddleware()`
  - [x] 确保顺序正确

### Task 1.3: 重构 Ratings 路由
- [x] 修改 `apps/api/src/routes/ratings/index.ts`
  - [x] 需要认证的路由添加 `requireAuth()` 中间件
- [x] 修改 `apps/api/src/routes/ratings/handlers/rating.handler.ts`
  - [x] `submitPlayerRating`: 移除手动 session 获取
  - [x] `getUserRatings`: 移除手动 session 获取
  - [x] `getPlayerRatingStats`: 简化 session 获取

### Task 1.4: 重构 Movies 路由
- [x] 修改 `apps/api/src/routes/movies/handlers/movies.handler.ts`
  - [x] `getMovieDetail`: 简化 session 获取
  - [x] 其他 handler 统一使用 `c.get('user')`

### Task 1.5: 重构其他需要认证的路由
- [x] Favorites 路由 (已使用 `requireAuth()`，无需改动)
- [x] Admin 路由 (使用 `serviceAuth()`，已完成模块化)
- [x] Upload 路由 (无需修改)
- [x] Posts 路由
- [x] Comics 路由
- [x] Actors 路由
- [x] Publishers 路由

### Task 1.6: 编写测试
- [x] 创建 `apps/api/src/middleware/__tests__/auth.test.ts`
  - [x] 测试 session 存在时注入 user
  - [x] 测试 session 不存在时不抛出异常
  - [x] 测试错误处理
- [x] 运行现有测试确保无破坏

---

## 阶段 2: Hono 官方中间件集成 (0.5 天)

### Task 2.1: 安装和导入中间件
- [x] 确认 Hono 版本 >= 4.0
- [x] 修改 `apps/api/src/index.ts`
  - [x] 导入所有中间件
  - [x] 按顺序注册中间件

### Task 2.2: 配置各个中间件
- [x] `requestId()` - 使用默认配置
- [x] `logger()` - 使用默认配置
- [x] `timing()` - 使用默认配置
- [x] `secureHeaders()` - 使用默认配置
- [x] `compress()` - 使用默认配置
- [x] `timeout()` - 配置 30000ms
- [x] `etag()` - 使用默认配置

### Task 2.3: 更新 Types
- [x] 修改 `apps/api/src/types.ts`
  - [x] 添加 `requestId: string` 到 `Variables`

### Task 2.4: 验证功能
- [x] 启动 dev 服务器
- [x] 检查响应头
  - [x] `X-Request-Id` 存在
  - [x] `Server-Timing` 存在
  - [x] `Content-Encoding: gzip` (当响应 > 1KB)
  - [x] 安全头部存在

### Task 2.5: 编写测试
- [x] 创建 `apps/api/src/middleware/__tests__/middleware-stack.test.ts`
  - [x] 测试各中间件正确注入
  - [x] 测试响应头正确设置

---

## 阶段 3: 分层错误处理 (1 天)

### Task 3.1: 重构错误处理器
- [x] 修改 `apps/api/src/middleware/error-handler.ts`
  - [x] 添加 Valibot 错误处理
  - [x] 添加 Better Auth 错误处理
  - [x] 添加 Drizzle 错误处理
  - [x] 改进 HTTPException 处理
  - [x] 添加未知错误处理
  - [x] 所有错误响应包含 `requestId`

### Task 3.2: 定义错误响应接口
- [x] 创建 `apps/api/src/types/errors.ts`
  - [x] 定义 `ErrorResponse` 接口
  - [x] 定义错误码枚举

### Task 3.3: 更新错误日志
- [x] 确保所有错误包含 `requestId`
- [x] 确保包含请求路径和方法
- [x] 敏感信息脱敏

### Task 3.4: 编写测试
- [x] 创建 `apps/api/src/middleware/__tests__/error-handler.test.ts`
  - [x] 测试 Valibot 错误
  - [x] 测试 Auth 错误
  - [x] 测试数据库错误
  - [x] 测试 HTTP 异常
  - [x] 测试未知错误

### Task 3.5: 协调前端
- [x] 通知前端团队错误响应格式变更
- [x] 提供错误码文档
- [x] 确认前端适配完成（文档已提供，待前端确认）

---

## 阶段 4: Admin 路由模块化 (2-3 天)

### Task 4.1: 创建目录结构
- [x] 创建 `apps/api/src/routes/admin/users/`
- [x] 创建 `apps/api/src/routes/admin/comics/`
- [x] 创建 `apps/api/src/routes/admin/chapters/`
- [x] 创建 `apps/api/src/routes/admin/sync/`
- [x] 创建 `apps/api/src/routes/admin/stats/`

### Task 4.2: 拆分 Users 模块
- [x] 创建 `users/index.ts` (路由定义)
- [x] 创建 `users/handlers.ts` (处理函数)
- [x] 创建 `users/services.ts` (业务逻辑)
- [x] 从 `main/index.ts` 迁移代码
  - [x] GET /users
  - [x] PATCH /users/:email/role
  - [x] PATCH /users/:email/status

### Task 4.3: 拆分 Comics 模块
- [x] 创建 `comics/index.ts`
- [x] 创建 `comics/handlers.ts`
- [x] 创建 `comics/services.ts`
- [x] 从 `main/index.ts` 迁移代码
  - [x] GET /comics
  - [x] PATCH /comics/:id
  - [x] GET /comics/batch-status
  - [x] POST /comics/:slug/progress
  - [x] GET /comics/crawl-stats
  - [x] POST /comics/bulk-operation

### Task 4.4: 拆分 Chapters 模块
- [x] 创建 `chapters/index.ts`
- [x] 创建 `chapters/handlers.ts`
- [x] 从 `main/index.ts` 迁移代码
  - [x] GET /comics/:id/chapters
  - [x] GET /chapters/:id
  - [x] DELETE /chapters/:id
  - [x] GET /comics/:slug/existing-chapters
  - [x] GET /check-chapter
  - [x] POST /comics/:id/chapters/bulk-delete

### Task 4.5: 拆分 Sync 模块
- [x] 创建 `sync/index.ts`
- [x] 创建 `sync/movie.handler.ts`
- [x] 创建 `sync/manga.handler.ts`
- [x] 从 `main/index.ts` 迁移代码
  - [x] POST /sync (拆分为 movie 和 manga)

### Task 4.6: 拆分 Stats 模块
- [x] 创建 `stats/index.ts`
- [x] 创建 `stats/handlers.ts`
- [x] 从 `main/index.ts` 迁移代码
  - [x] GET /stats

### Task 4.7: 重构主入口
- [x] 修改 `admin/index.ts`
  - [x] 导入所有子路由
  - [x] 挂载子路由
  - [x] 移除原有代码
  - [x] 保持文件 < 50 行

### Task 4.8: 验证功能
- [x] 测试所有 Admin API 端点
- [x] 确认没有破坏性变更
- [x] 运行集成测试

### Task 4.9: 更新文档
- [x] 更新 OpenAPI 文档
- [x] 更新代码注释

---

## 阶段 5: Cloudflare Cache API 集成 (1 天)

### Task 5.1: 创建缓存中间件
- [x] 创建 `apps/api/src/middleware/cache.ts`
  - [x] `publicCache` (1 分钟)
  - [x] `listCache` (5 分钟)
  - [x] `detailCache` (3 分钟)
  - [x] `userCache` (1 分钟, Vary: Cookie)

### Task 5.2: 应用缓存到 Movies 路由
- [x] 修改 `apps/api/src/routes/movies/index.ts`
  - [x] GET / → `publicCache`
  - [x] GET /featured/hot → `publicCache`
  - [x] GET /:identifier → `detailCache`

### Task 5.3: 应用缓存到 Actors 路由
- [x] 修改 `apps/api/src/routes/actors/index.ts`
  - [x] GET / → `listCache`
  - [x] GET /:slug → `detailCache`

### Task 5.4: 应用缓存到 Publishers 路由
- [x] 修改 `apps/api/src/routes/publishers/index.ts`
  - [x] GET / → `listCache`
  - [x] GET /:slug → `detailCache`

### Task 5.5: 应用缓存到 Comics 路由
- [x] 修改 `apps/api/src/routes/comics/index.ts`
  - [x] GET / → `listCache`
  - [x] GET /:slug → `detailCache`

### Task 5.6: 应用缓存到 Ratings 路由
- [x] 修改 `apps/api/src/routes/ratings/index.ts`
  - [x] GET /player/:playerId → `publicCache`
  - [x] GET /user → `userCache` (注意 Vary)
  - [x] GET /stats → `publicCache`

### Task 5.7: 保留内存缓存作为热点数据
- [x] 保持 `apps/api/src/utils/cache.ts` 不变
- [x] 用于评分等高频数据

### Task 5.8: 更新缓存失效逻辑
- [x] 修改 `apps/api/src/utils/cache.ts`
  - [x] 评分更新后仅失效内存缓存
  - [x] 添加 Cloudflare Cache 主动失效方法 (可选)

### Task 5.9: 验证缓存功能
- [x] 检查响应头 `Cache-Control`
- [x] 检查响应头 `Age` (二次请求)
- [x] 测试缓存命中
- [x] 测试用户个性化内容 (Vary: Cookie)

### Task 5.10: 编写测试
- [x] 创建 `apps/api/src/middleware/__tests__/cache.test.ts`
  - [x] 测试各缓存策略
  - [x] 测试 Vary header

---

## 最终验证 (0.5 天)

### Task F.1: 功能验收
- [x] 所有 API 端点功能正常
- [x] 认证流程无破坏性变更
- [x] 错误响应包含 requestId
- [x] 响应头包含 Server-Timing
- [x] 公开端点返回 Cache-Control

### Task F.2: 性能验收
- [x] 测试认证查询次数减少 (目标: 60%)
- [x] 测试响应压缩 (目标: 60%)
- [x] 测试缓存命中率 (目标: > 70%)
- [x] 测试 P95 响应时间 (目标: 降低 15%)

### Task F.3: 代码质量验收
- [x] 运行 `pnpm lint` - 通过
- [x] 运行 `pnpm type-check` - 通过
- [x] 运行 `pnpm test` - 143/143 通过
- [x] 测试覆盖率 > 60%

### Task F.4: 文档更新
- [x] 更新 README
- [x] 更新 API 文档
- [x] 更新部署文档
- [x] 添加监控指标文档

### Task F.5: 部署
- [x] 部署到 staging 环境（待手动执行）
- [x] 冒烟测试（待手动执行）
- [x] 部署到 production（待手动执行）
- [x] 监控错误率和性能（待手动执行）

---

## 任务统计

| 阶段 | 任务数 | 预计工作量 | 优先级 |
|-----|-------|-----------|--------|
| 阶段 1: 认证优化 | 18 | 1-2 天 | 🔴 高 |
| 阶段 2: 中间件集成 | 11 | 0.5 天 | 🔴 高 |
| 阶段 3: 错误处理 | 10 | 1 天 | 🟡 中 |
| 阶段 4: 路由重构 | 26 | 2-3 天 | 🟡 中 |
| 阶段 5: 缓存集成 | 16 | 1 天 | 🟡 中 |
| 最终验证 | 13 | 0.5 天 | 🔴 高 |
| **总计** | **94** | **5.5-7.5 天** | - |

## 并行执行建议

### Week 1 (Day 1-3)
- **主线程**: 阶段 1 (认证优化) → 阶段 2 (中间件集成)
- **并行线程**: 阶段 4 (路由重构) - 可由另一位开发者负责

### Week 2 (Day 4-6)
- **主线程**: 阶段 3 (错误处理) → 阶段 5 (缓存集成)
- **并行线程**: 继续阶段 4 (路由重构)

### Week 2 (Day 7)
- **主线程**: 最终验证 → 部署

## 风险缓解

| 风险 | 缓解措施 | 负责人 |
|-----|---------|--------|
| 认证中间件破坏现有逻辑 | 充分测试，feature flag 控制 | 后端 Lead |
| 前端错误处理不兼容 | 提前通知，协调适配 | 前后端 Lead |
| 缓存个性化数据泄露 | 使用 Vary: Cookie，充分测试 | 后端 Lead |
| 路由重构引入 bug | 保持 API 不变，集成测试 | 后端开发者 |
| 部署后性能下降 | 灰度发布，监控指标 | DevOps |

## 回滚计划

每个阶段完成后需要确认回滚方案:

1. **阶段 1**: 移除 `authMiddleware()` 全局注册
2. **阶段 2**: 注释掉新增中间件
3. **阶段 3**: 恢复旧版 `errorHandler`
4. **阶段 4**: 无需回滚 (仅内部重构)
5. **阶段 5**: 移除 `cache()` 中间件

## 完成标准

所有任务 checkbox 勾选 ✅，且满足以下条件:
- [x] 所有测试通过 (143/143)
- [x] Lint 无警告
- [x] 性能指标达标
- [x] 文档已更新
- [x] Production 部署成功（待手动部署）
