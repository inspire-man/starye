## 1. 数据库 Schema 迁移

- [ ] 1.1 在 `packages/db/src/schema.ts` 的 `actors` 表新增字段：`blog`, `twitter`, `instagram`, `wikiUrl`
- [ ] 1.2 在 `packages/db/src/schema.ts` 的 `publishers` 表新增字段：`twitter`, `instagram`, `wikiUrl`, `parentPublisher`, `brandSeries`
- [ ] 1.3 运行 `pnpm --filter @starye/db generate` 生成 Drizzle 迁移 SQL
- [ ] 1.4 本地测试迁移 SQL（使用开发数据库）
- [ ] 1.5 验证新字段的默认值为 null，不影响现有数据

## 2. SeesaaWiki 爬虫策略核心实现

- [ ] 2.1 创建 `packages/crawler/src/strategies/seesaawiki/types.ts`，定义 Wiki 数据结构类型
- [ ] 2.2 创建 `packages/crawler/src/strategies/seesaawiki/parser.ts`，实现 Wiki 标记语言解析器
- [ ] 2.3 在 `parser.ts` 实现女优页面解析：提取主名、读音、别名
- [ ] 2.4 在 `parser.ts` 实现女优页面解析：提取社交链接（Twitter、Instagram、博客）
- [ ] 2.5 在 `parser.ts` 实现女优页面解析：提取出道日期和退役日期
- [ ] 2.6 在 `parser.ts` 实现厂商页面解析：提取 Logo、官网、社交媒体
- [ ] 2.7 在 `parser.ts` 实现厂商页面解析：提取系列关系（parentPublisher、brandSeries）
- [ ] 2.8 实现日期格式解析（支持"2012年7月13日"、"2012/07/13"等多种格式）
- [ ] 2.9 实现容错解析：处理格式变体、缺失字段、编码问题

## 3. SeesaaWiki 爬虫策略类

- [ ] 3.1 创建 `packages/crawler/src/strategies/seesaawiki/seesaawiki-strategy.ts`，实现基础类结构
- [ ] 3.2 实现 `fetchActorDetails(wikiUrl: string)` 方法，调用 parser 解析女优详情
- [ ] 3.3 实现 `fetchPublisherDetails(wikiUrl: string)` 方法，调用 parser 解析厂商详情
- [ ] 3.4 实现 `fetchIndexPage(gojuonLine: string)` 方法，爬取五十音索引页
- [ ] 3.5 在索引页解析中实现别名提取（格式："名字A = 名字B"）
- [ ] 3.6 在索引页解析中实现改名关系提取（格式："名字A ⇒ 名字B"）
- [ ] 3.7 实现分页索引处理（如"あ-2"、"あ-3"）
- [ ] 3.8 配置反爬虫策略：baseDelay=8000ms, randomDelay=4000ms, maxRetries=2

## 4. 名字映射系统实现

- [ ] 4.1 创建 `packages/crawler/src/lib/name-mapper.ts`，定义 `NameMapper` 类
- [ ] 4.2 实现映射表文件加载：读取 `.seesaawiki-actor-map.json` 和 `.seesaawiki-publisher-map.json`
- [ ] 4.3 实现精确匹配逻辑：直接构建 Wiki URL 并尝试访问
- [ ] 4.4 实现五十音自动定位：根据名字首字符定位五十音行
- [ ] 4.5 实现索引搜索逻辑：在索引页中搜索女优名和别名
- [ ] 4.6 实现别名反向索引：建立 aliasToMain Map
- [ ] 4.7 实现映射缓存持久化：新增映射后立即写入文件
- [ ] 4.8 实现未匹配名单记录：写入 `.seesaawiki-unmapped-actors.json` 和 `.seesaawiki-unmapped-publishers.json`
- [ ] 4.9 实现映射质量校验工具：统计覆盖率、冲突检测

## 5. 索引爬虫独立脚本

- [ ] 5.1 创建 `packages/crawler/src/scripts/crawl-seesaawiki-index.ts`，实现索引页全量爬取
- [ ] 5.2 遍历所有五十音行（あ、か、さ、た、な、は、ま、や、ら、わ），爬取女优索引
- [ ] 5.3 遍历所有五十音行，爬取厂商索引
- [ ] 5.4 合并索引数据，生成完整名字映射表
- [ ] 5.5 在 `packages/crawler/package.json` 添加 script: `"crawl:seesaawiki:index": "tsx src/scripts/crawl-seesaawiki-index.ts"`
- [ ] 5.6 本地运行索引爬虫，验证映射表生成

## 6. ActorCrawler 重构

- [ ] 6.1 修改 `packages/crawler/src/crawlers/actor-crawler.ts`，引入 `SeesaaWikiStrategy` 和 `NameMapper`
- [ ] 6.2 在 `ActorCrawler` 构造函数中初始化 `NameMapper`
- [ ] 6.3 修改 `processActor()` 方法：调用 `nameMapper.matchActorName()` 获取 Wiki URL
- [ ] 6.4 修改 `processActor()` 方法：调用 `seesaaWikiStrategy.fetchActorDetails()` 爬取详情
- [ ] 6.5 修改数据完整度计算权重：`avatar: 30%, aliases: 15%, socialLinks: 15%, debutDate: 10%, bio: 10%, 其他: 20%`
- [ ] 6.6 在同步到 API 时，包含新增字段：`twitter`, `instagram`, `blog`, `wikiUrl`
- [ ] 6.7 更新 `source` 字段为 "seesaawiki"
- [ ] 6.8 处理名字匹配失败：记录到 `FailedTaskRecorder`，标记为 "name_mapping_failed"
- [ ] 6.9 保留 JavBus 头像爬取作为备用（可选）

## 7. PublisherCrawler 重构

- [ ] 7.1 修改 `packages/crawler/src/crawlers/publisher-crawler.ts`，引入 `SeesaaWikiStrategy` 和 `NameMapper`
- [ ] 7.2 在 `PublisherCrawler` 构造函数中初始化 `NameMapper`
- [ ] 7.3 修改 `processPublisher()` 方法：调用 `nameMapper.matchPublisherName()` 获取 Wiki URL
- [ ] 7.4 修改 `processPublisher()` 方法：调用 `seesaaWikiStrategy.fetchPublisherDetails()` 爬取详情
- [ ] 7.5 修改数据完整度计算权重：`logo: 30%, website: 20%, twitter: 10%, instagram: 10%, description: 15%, 系列关系: 15%`
- [ ] 7.6 在同步到 API 时，包含新增字段：`twitter`, `instagram`, `wikiUrl`, `parentPublisher`, `brandSeries`
- [ ] 7.7 更新 `source` 字段为 "seesaawiki"
- [ ] 7.8 处理名字匹配失败：记录到 `FailedTaskRecorder`

## 8. API 端点扩展

- [ ] 8.1 在 `apps/api/src/routes/admin/actors.ts` 的 PATCH 端点，接受新字段：`twitter`, `instagram`, `blog`, `wikiUrl`
- [ ] 8.2 在 `apps/api/src/routes/admin/publishers.ts` 的 PATCH 端点，接受新字段：`twitter`, `instagram`, `wikiUrl`, `parentPublisher`, `brandSeries`
- [ ] 8.3 验证新字段的序列化和反序列化
- [ ] 8.4 验证向后兼容性：旧数据的新字段为 null，不影响查询和展示
- [ ] 8.5 （可选）新增别名查询端点：`GET /api/admin/actors/search-by-alias?alias=xxx`

## 9. GitHub Actions 调整

- [ ] 9.1 修改 `.github/workflows/daily-actor-crawl.yml`，无需修改环境变量（使用相同配置）
- [ ] 9.2 修改 `.github/workflows/daily-publisher-crawl.yml`，无需修改环境变量
- [ ] 9.3 验证 workflow 中的超时设置（360 分钟足够）
- [ ] 9.4 （可选）新增索引爬虫 workflow：每周运行一次，更新名字映射表

## 10. 本地测试和验证

- [ ] 10.1 本地运行 ActorCrawler：`pnpm --filter @starye/crawler run crawl:actor`，测试 10 个女优
- [ ] 10.2 验证名字匹配成功率（目标 > 80%）
- [ ] 10.3 验证女优数据完整度提升（预期从 70% → 85%+）
- [ ] 10.4 检查新字段是否正确填充（aliases, twitter, blog, wikiUrl）
- [ ] 10.5 本地运行 PublisherCrawler：`pnpm --filter @starye/crawler run crawl:publisher`，测试 10 个厂商
- [ ] 10.6 验证厂商数据完整度提升（预期从 70% → 90%+）
- [ ] 10.7 检查系列关系字段是否正确填充（parentPublisher, brandSeries）
- [ ] 10.8 检查 `.seesaawiki-unmapped-actors.json`，确认未匹配女优数量在预期范围内

## 11. 数据库迁移部署

- [ ] 11.1 备份生产数据库
- [ ] 11.2 在生产环境运行迁移 SQL：`pnpm --filter @starye/db migrate`
- [ ] 11.3 验证新字段已创建，现有数据不受影响
- [ ] 11.4 部署 API 新版本（包含新字段支持）
- [ ] 11.5 验证 API 端点正常工作（使用 Postman 或 curl 测试）

## 12. 索引爬虫初始化

- [ ] 12.1 在本地或服务器运行索引爬虫：`pnpm --filter @starye/crawler run crawl:seesaawiki:index`
- [ ] 12.2 监控爬取进度（预计 1-2 小时，约 100-200 页）
- [ ] 12.3 验证映射表质量：随机抽样 100 个女优，检查映射准确率
- [ ] 12.4 提交映射表到版本库：`git add .seesaawiki-actor-map.json .seesaawiki-publisher-map.json`
- [ ] 12.5 提交并推送：`git commit -m "feat: add seesaawiki name mapping tables"`

## 13. 生产环境爬虫部署

- [ ] 13.1 推送 ActorCrawler 和 PublisherCrawler 新版本代码
- [ ] 13.2 在 GitHub Actions 手动触发女优爬虫：`daily-actor-crawl.yml`
- [ ] 13.3 监控爬虫日志，检查错误率和匹配率
- [ ] 13.4 验证第一批女优数据质量（检查 Dashboard 中的数据）
- [ ] 13.5 在 GitHub Actions 手动触发厂商爬虫：`daily-publisher-crawl.yml`
- [ ] 13.6 监控厂商爬虫日志，检查系列关系提取是否正确
- [ ] 13.7 验证第一批厂商数据质量

## 14. 监控和优化

- [ ] 14.1 监控爬虫成功率（目标 > 90%）
- [ ] 14.2 监控名字匹配率（目标 > 85%）
- [ ] 14.3 分析未匹配女优清单，识别高优先级女优（作品数 > 50）
- [ ] 14.4 人工补充高优先级女优的名字映射
- [ ] 14.5 监控 Wiki 页面解析失败率（目标 < 5%）
- [ ] 14.6 优化解析器处理格式变体（根据失败案例）
- [ ] 14.7 输出数据完整度对比报告（切换前 vs 切换后）
- [ ] 14.8 评估是否需要触发历史数据重新爬取

## 15. Dashboard 集成（可选）

- [ ] 15.1 在 Dashboard 的女优详情页展示新字段：别名、Twitter、Instagram、博客
- [ ] 15.2 在 Dashboard 的厂商详情页展示新字段：Twitter、Instagram、系列关系
- [ ] 15.3 展示母公司链接（可点击跳转到母公司详情页）
- [ ] 15.4 展示子品牌列表
- [ ] 15.5 （可选）实现名字映射管理界面：支持手动添加映射、查看未匹配清单
- [ ] 15.6 （可选）实现映射质量报告页面：显示覆盖率、冲突数、失效映射数

## 16. 文档和回滚准备

- [ ] 16.1 更新 `packages/crawler/README.md`，记录 SeesaaWiki 数据源切换
- [ ] 16.2 记录名字映射表的更新流程（每周运行索引爬虫）
- [ ] 16.3 记录未匹配女优的人工审核流程
- [ ] 16.4 记录数据完整度提升情况（作为文档或 CHANGELOG）
- [ ] 16.5 准备回滚计划：如需回滚到 JavBus，需要恢复哪些文件
- [ ] 16.6 （可选）创建数据质量监控仪表板（Grafana 或类似工具）
