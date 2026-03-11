## 1. 数据库 Schema 变更

- [x] 1.1 在 `packages/db/src/schema.ts` 的 `comics` 表中添加爬取状态字段（crawl_status, last_crawled_at, total_chapters, crawled_chapters, is_serializing）
- [x] 1.2 运行 `pnpm --filter @starye/db generate` 生成迁移文件
- [x] 1.3 在本地运行迁移验证字段正确添加：`wrangler d1 execute starye-db --local --command "PRAGMA table_info(comics);"`
- [ ] 1.4 运行生产迁移：`wrangler d1 execute starye-db --command "<migration SQL>"`（或使用 migrate 命令）

## 2. 配置系统实现

- [x] 2.1 创建 `packages/crawler/src/config/crawl.config.ts` 文件，定义 `CRAWL_CONFIG` 对象结构
- [x] 2.2 实现环境检测逻辑（检查 `process.env.CI`）
- [x] 2.3 实现环境变量覆盖逻辑（读取 `CRAWLER_*` 环境变量）
- [x] 2.4 添加配置验证函数（检查并发数、超时时间合法性）
- [x] 2.5 在爬虫启动时输出配置日志（使用 `Object.freeze` 冻结配置）

## 3. API 批量查询端点

- [x] 3.1 在 `apps/api/src/routes/admin.ts` 添加 `GET /api/admin/comics/batch-status` 端点
- [x] 3.2 实现批量查询逻辑（使用 SQL `WHERE slug IN (...)` 一次查询所有漫画）
- [x] 3.3 添加 `serviceAuth` 中间件保护端点
- [x] 3.4 实现参数验证（检查 `slugs` 参数非空）
- [x] 3.5 添加性能日志（记录查询耗时）

## 4. API 进度更新端点

- [x] 4.1 在 `apps/api/src/routes/admin.ts` 添加 `POST /api/admin/comics/:slug/progress` 端点
- [x] 4.2 实现进度更新逻辑（更新 crawl_status, crawled_chapters, last_crawled_at）
- [x] 4.3 使用数据库事务确保原子性
- [x] 4.4 添加 `serviceAuth` 中间件保护端点

## 5. API 爬取统计端点

- [x] 5.1 在 `apps/api/src/routes/admin.ts` 添加 `GET /api/admin/comics/crawl-stats` 端点
- [x] 5.2 实现统计查询（按 crawl_status 分组计数）
- [x] 5.3 支持 `since` 参数过滤时间范围（可选）
- [x] 5.4 添加 `serviceAuth` 中间件保护端点

## 6. 并发控制库集成

- [x] 6.1 添加 `p-map` 依赖到 `packages/crawler/package.json`：`pnpm --filter @starye/crawler add p-map`
- [x] 6.2 在 `comic-crawler.ts` 导入 `pMap` 函数

## 7. 图片批量并发处理

- [x] 7.1 修改 `comic-crawler.ts` 的图片处理逻辑（第 140-158 行）
- [x] 7.2 实现图片分批函数（chunk 数组，每批 N 张）
- [x] 7.3 使用 `Promise.all` 并发处理每批图片
- [x] 7.4 添加批次完成日志："批次 X/Y 完成，已处理 Z 张图片"
- [ ] 7.5 测试单个章节的图片处理时间（预期从 14 分钟降到 < 1 分钟）

## 8. 章节级并发处理

- [x] 8.1 修改 `comic-crawler.ts` 的章节处理循环（第 128-174 行）
- [x] 8.2 使用 `pMap` 并发处理章节，并发数从 `CRAWL_CONFIG.concurrency.chapter` 读取
- [x] 8.3 保留单个章节的错误处理逻辑（失败不影响其他章节）
- [x] 8.4 添加章节完成日志："处理章节 X/Y - {title}"

## 9. 漫画级并发处理

- [x] 9.1 修改 `comic-crawler.ts` 的漫画处理循环（第 53-60 行）
- [x] 9.2 使用 `pMap` 并发处理漫画，并发数从 `CRAWL_CONFIG.concurrency.manga` 读取
- [x] 9.3 保留单个漫画的错误处理逻辑（失败不影响其他漫画）

## 10. 批量状态查询集成

- [x] 10.1 在 `comic-crawler.ts` 的 `processUrl` 方法开头添加批量状态查询
- [x] 10.2 构建 slugs 参数：`const slugs = mangas.map(url => extractSlug(url)).join(',')`
- [x] 10.3 调用 `GET /api/admin/comics/batch-status?slugs={slugs}` 获取所有漫画状态
- [x] 10.4 将状态信息存储到 Map 中供后续使用

## 11. 漫画级别去重逻辑

- [x] 11.1 在 `processManga` 方法开头检查漫画状态（从批量查询结果中获取）
- [x] 11.2 如果 `status = 'complete' AND is_serializing = false`，跳过漫画并记录日志
- [x] 11.3 如果 `status = 'complete' AND is_serializing = true`，仅处理新章节
- [x] 11.4 如果 `status = 'pending' OR 'partial'`，应用章节数量限制

## 12. 章节数量限制逻辑

- [x] 12.1 在 `processManga` 方法中根据 `crawl_status` 确定要处理的章节列表
- [x] 12.2 如果是 `pending` 状态，限制为前 `maxChaptersPerNew` 章
- [x] 12.3 如果是 `partial` 状态，从 `crawled_chapters + 1` 开始，最多 `maxChaptersPerNew` 章
- [x] 12.4 如果是 `complete` 状态（连载中），仅处理新章节，最多 `maxChaptersPerUpdate` 章
- [x] 12.5 记录限制日志："限制章节数: 处理 X/Y 章（状态: {status}）"

## 13. 优先级队列排序

- [x] 13.1 在 `processUrl` 方法中，根据批量状态查询结果对漫画列表排序
- [x] 13.2 实现优先级函数：连载中+有新章节 > 新漫画 > 部分完成 > 其他
- [x] 13.3 同优先级内按 `lastCrawledAt` 升序（最久未爬的优先）
- [x] 13.4 应用 `maxMangasPerRun` 限制，只处理前 N 个

## 14. 爬取状态更新集成

- [x] 14.1 在 `processManga` 开始时调用进度更新 API（标记开始时间）
- [x] 14.2 每处理完一个章节后更新 `crawled_chapters` 计数
- [x] 14.3 处理完所有章节后更新 `crawl_status`（partial 或 complete）
- [x] 14.4 使用 try-finally 确保即使失败也更新状态

## 15. 软超时机制

- [x] 15.1 在 `processUrl` 方法开头记录启动时间：`const startTime = Date.now()`
- [x] 15.2 在漫画处理循环中检查运行时长
- [x] 15.3 如果超过 `timeoutMinutes`，停止接收新漫画任务（break 循环）
- [x] 15.4 记录超时日志："接近超时限制 ({elapsed}分钟)，优雅退出"

## 16. 内存监控（可选）

- [x] 16.1 在批次处理完成后记录内存使用：`process.memoryUsage()`
- [x] 16.2 如果 heapUsed > 80% 阈值，记录警告日志
- [x] 16.3 添加 `--max-old-space-size=5120` 到 GitHub Actions workflow 的 Node.js 启动参数（注释形式提供）

## 17. GitHub Actions 配置调整

- [x] 17.1 在 `.github/workflows/daily-manga-crawl.yml` 中添加新的环境变量（如需覆盖默认配置）
- [x] 17.2 确认 `CRAWLER_SECRET` 已配置（用于批量 API 认证）
- [x] 17.3 添加 Node.js 内存限制参数（可选，已通过注释说明）

## 18. 本地测试

- [x] 18.1 本地运行迁移，确认数据库字段正确
- [x] 18.2 手动调用批量状态查询 API，验证响应格式
- [x] 18.3 本地启动爬虫（限制 3 个漫画），观察并发行为和日志
- [x] 18.4 验证配置加载和环境检测逻辑
- [ ] 18.5 测试软超时机制（设置 `timeoutMinutes=1` 验证）

## 19. CI 测试

- [x] 19.1 使用 `workflow_dispatch` 手动触发爬虫（设置 `maxMangasPerRun=5` 灰度测试）
- [x] 19.2 观察 GitHub Actions 日志，确认并发逻辑正常
- [x] 19.3 检查内存使用峰值（预期 < 3GB）
- [x] 19.4 验证运行时长（预期 5 个漫画 < 2 小时）
- [x] 19.5 检查数据库中漫画状态是否正确更新

## 20. 性能验证和文档

- [x] 20.1 记录优化前后的性能对比数据（时长、成功率、内存）
- [x] 20.2 更新爬虫 README 文档（如有），说明新的并发配置
- [x] 20.3 在 GitHub Actions workflow 中添加注释说明配置参数
- [ ] 20.4 创建性能监控仪表板（可选，记录每次运行统计）

## 21. 生产部署

- [ ] 21.1 将 `maxMangasPerRun` 逐步增加：5 → 10 → 15
- [ ] 21.2 观察每次运行的稳定性和性能
- [ ] 21.3 如发现问题，回滚配置或代码
- [ ] 21.4 最终部署完整配置（15 个漫画/次）
