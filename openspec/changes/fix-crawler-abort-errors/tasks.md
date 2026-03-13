# 爬虫反检测与错误恢复实施任务

## 1. 基础设施搭建

- [x] 1.1 创建 `CrawlerSession` 类用于管理 Cookie 和会话
- [x] 1.2 创建 `ErrorClassifier` 工具类，实现错误分类逻辑
- [x] 1.3 创建 `SuccessRateMonitor` 类，实现成功率监控
- [x] 1.4 创建 `DelayStrategy` 类，实现智能延迟计算
- [x] 1.5 创建 `HeaderRotator` 类，管理多套请求头配置

## 2. 配置系统增强

- [x] 2.1 在 `crawl.config.ts` 中添加反检测配置接口
- [x] 2.2 定义漫画爬虫的专用配置（baseDelay: 8000ms, maxRetries: 3）
- [x] 2.3 定义影片爬虫的专用配置（baseDelay: 6000ms, maxRetries: 2）
- [x] 2.4 实现配置验证函数 `validateAntiDetectionConfig`
- [x] 2.5 添加环境变量支持（`CRAWLER_BASE_DELAY`, `CRAWLER_MAX_RETRIES` 等）
- [ ] 2.6 添加配置文档（JSDoc + README）

## 3. 请求头伪装实现

- [x] 3.1 准备至少 2 套真实的浏览器请求头模板
- [x] 3.2 实现 `getRealUserAgent` 函数，获取真实 UA（在 HeaderRotator 中）
- [x] 3.3 实现 `applyEnhancedHeaders` 函数，应用完整请求头（在 CrawlerSession 中）
- [x] 3.4 在 `CrawlerSession.initialize` 中应用请求头伪装
- [x] 3.5 实现请求头轮换逻辑（错误时更换）

## 4. Cookie 和 Session 管理

- [x] 4.1 在 `CrawlerSession` 中实现 `initialize` 方法（访问首页建立会话）
- [x] 4.2 实现 `applyCookies` 方法，在后续请求中应用 Cookie
- [x] 4.3 实现 `refreshSession` 方法，处理会话过期
- [x] 4.4 添加会话超时检测逻辑
- [x] 4.5 添加会话重建日志记录

## 5. 智能延迟策略

- [x] 5.1 在 `DelayStrategy` 中实现 `calculateDelay` 方法
- [x] 5.2 实现基础延迟 + 随机化逻辑
- [x] 5.3 实现错误后增加延迟（errorBackoffMultiplier）
- [x] 5.4 实现最大延迟限制检查
- [x] 5.5 集成成功率监控，自动降速（成功率 < 70%）
- [x] 5.6 添加延迟调整日志输出

## 6. 错误分类与处理

- [x] 6.1 在 `ErrorClassifier` 中实现 `classifyError` 方法
- [x] 6.2 添加 ERR_ABORTED 错误识别和处理策略
- [x] 6.3 添加 TimeoutError 错误识别和处理策略
- [x] 6.4 添加 ERR_CONNECTION_REFUSED 错误识别和处理策略
- [x] 6.5 添加 HTTP 4xx/5xx 错误识别和处理策略
- [x] 6.6 实现 `handleCrawlError` 函数，根据错误类型返回处理决策

## 7. 智能重试逻辑

- [x] 7.1 创建 `CrawlContext` 接口，包含重试次数、延迟、超时等信息
- [x] 7.2 修改 `retryPageGoto` 函数，接受 `CrawlContext` 参数（替换为 _smartGoto）
- [x] 7.3 实现 ERR_ABORTED 的特殊重试逻辑（增加延迟 + 更换请求头）
- [x] 7.4 实现 Timeout 的重试逻辑（增加超时时间）
- [x] 7.5 实现 Connection Refused 的长时间退避（60秒）
- [x] 7.6 添加重试次数限制检查
- [x] 7.7 添加重试日志输出（包含第几次重试、使用的策略等）

## 8. 成功率监控

- [x] 8.1 在 `SuccessRateMonitor` 中实现 `record` 方法（记录到滑动窗口）
- [x] 8.2 实现 `getSuccessRate` 方法（计算成功率）
- [x] 8.3 实现 `shouldSlowDown` 方法（判断是否需要降速）
- [x] 8.4 在爬虫主循环中集成成功率监控（在 _smartGoto 中）
- [x] 8.5 在统计信息中添加成功率指标输出（在 ComicCrawler.run 结束时）

## 9. IP 封禁检测

- [x] 9.1 添加连续错误计数器（tracking consecutive ERR_CONNECTION_REFUSED）
- [x] 9.2 实现 `detectIpBan` 函数（连续 5 次 Connection Refused）
- [x] 9.3 实现 IP 封禁暂停逻辑（等待 5 分钟）- 在 ErrorClassifier 中处理
- [x] 9.4 实现恢复尝试逻辑（访问首页测试）- 通过会话刷新机制
- [x] 9.5 添加 IP 封禁警告日志

## 10. 失败任务记录

- [x] 10.1 创建 `FailedTask` 接口，定义失败记录结构
- [x] 10.2 实现 `recordFailedTask` 函数，记录失败信息
- [x] 10.3 在爬虫完成时输出失败摘要（按错误类型分组）
- [x] 10.4 添加失败 URL 列表输出
- [x] 10.5 可选：实现失败任务恢复功能（从记录中读取 URL 重新爬取）

## 11. 集成到漫画爬虫（site-92hm.ts）

- [x] 11.1 在 `Site92Hm` 类中添加 `CrawlerSession` 实例
- [x] 11.2 在 `getMangaList` 方法中应用增强的请求头（通过 _smartGoto）
- [x] 11.3 在 `getMangaInfo` 方法中使用新的错误处理逻辑（通过 _smartGoto）
- [x] 11.4 在 `getChapterContent` 方法中使用新的错误处理逻辑（通过 _smartGoto）
- [x] 11.5 替换现有的 `retryPageGoto` 为新的智能重试逻辑（_smartGoto）
- [x] 11.6 集成成功率监控和自动降速
- [x] 11.7 应用 Cookie 管理（在每个 page.goto 前调用 applyCookies）
- [x] 11.8 使用漫画爬虫专用配置

## 12. 更新 comic-crawler.ts

- [x] 12.1 在 `ComicCrawler` 中集成 `SuccessRateMonitor`（Site92Hm 中已集成）
- [x] 12.2 在 `processManga` 方法中使用新的错误分类器（Site92Hm 中已使用）
- [x] 12.3 更新错误处理逻辑，使用 `handleCrawlError`（Site92Hm 中已使用）
- [x] 12.4 添加失败任务记录
- [x] 12.5 在完成时输出失败摘要

## 13. 本地测试（漫画爬虫）

- [ ] 13.1 使用小批量测试（MAX_MANGAS=5）
- [ ] 13.2 验证请求头伪装是否生效（检查日志）
- [ ] 13.3 验证 Cookie 管理是否正常（检查 Cookie 保存和应用）
- [ ] 13.4 验证智能延迟是否工作（观察延迟时间变化）
- [ ] 13.5 验证错误重试是否正常（模拟错误场景）
- [ ] 13.6 验证成功率监控是否工作
- [ ] 13.7 确保成功率 > 90%

## 14. GitHub Actions 测试（漫画爬虫）

- [ ] 14.1 修改 `daily-manga-crawl.yml`，添加必要的环境变量
- [ ] 14.2 手动触发 workflow，使用小批量（max_mangas=10）
- [ ] 14.3 检查 Actions 日志，验证反检测逻辑正常运行
- [ ] 14.4 验证 ERR_ABORTED 错误是否已解决
- [ ] 14.5 验证成功率 > 90%
- [ ] 14.6 逐步增加批量（15, 20），确认稳定性

## 15. Movie 爬虫优化（可选）

- [ ] 15.1 在 `javbus.ts` 中集成反检测基础设施（可选）
- [ ] 15.2 调整并发参数（detailConcurrency: 2 -> 3）
- [ ] 15.3 略微减少延迟（base: 6000 -> 5000）
- [ ] 15.4 本地小批量测试（MAX_MOVIES=20）
- [ ] 15.5 对比新旧配置的速度和成功率
- [ ] 15.6 如成功率 < 95%，回滚配置

## 16. GitHub Actions 优化测试（Movie，可选）

- [ ] 16.1 手动触发 `daily-movie-crawl.yml`，使用优化配置
- [ ] 16.2 对比速度提升（目标：20+ 部/分钟）
- [ ] 16.3 验证成功率保持 > 95%
- [ ] 16.4 如失败，立即回滚到原配置
- [ ] 16.5 观察 7 天稳定性数据

## 17. 文档更新

- [ ] 17.1 更新 `packages/crawler/README.md`，添加反检测配置说明
- [ ] 17.2 添加配置示例（漫画 vs Movie）
- [ ] 17.3 添加故障排查指南（常见错误及解决方案）
- [ ] 17.4 添加性能优化建议
- [ ] 17.5 更新 GitHub Actions workflow 注释

## 18. 监控和日志优化

- [ ] 18.1 标准化日志格式（统一使用 emoji 和关键信息）
- [ ] 18.2 添加关键指标输出（成功率、平均延迟、重试率等）
- [ ] 18.3 改进错误日志，包含更多上下文信息
- [ ] 18.4 添加阶段性进度报告（每 10 个资源输出一次状态）
- [ ] 18.5 可选：添加 JSON 格式的统计输出（便于分析）

## 19. 回滚准备

- [ ] 19.1 在 GitHub Actions 中添加 `USE_LEGACY_MODE` 环境变量支持
- [ ] 19.2 实现 legacy mode 逻辑（使用原有的简单重试）
- [ ] 19.3 测试 legacy mode 可以正常工作
- [ ] 19.4 文档化回滚步骤

## 20. 最终验证

- [ ] 20.1 漫画爬虫在 GitHub Actions 中连续成功运行 3 次
- [ ] 20.2 ERR_ABORTED 错误率 < 5%
- [ ] 20.3 成功率 > 95%
- [ ] 20.4 Movie 爬虫保持稳定（或优化后稳定）
- [ ] 20.5 代码通过 lint 和 type-check
- [ ] 20.6 所有配置项都有文档说明
- [ ] 20.7 失败任务记录功能正常工作
