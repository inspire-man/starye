# crawler-e2e-test Specification

## Purpose
TBD - created by archiving change smart-incremental-crawl. Update Purpose after archive.
## Requirements
### Requirement: 批量查询 E2E 测试

测试套件 SHALL 验证爬虫的批量状态查询功能，包括成功场景、错误处理、边界条件。测试必须使用真实的 API 客户端和 Mock HTTP 响应。

#### Scenario: 测试成功查询已存在内容

- **WHEN** 测试调用 `ApiClient.batchQueryMovieStatus(['code1', 'code2'])` 并 mock API 返回 `{ existingCodes: ['code1'] }`
- **THEN** 测试验证返回的 Set 包含 `'code1'` 且不包含 `'code2'`

#### Scenario: 测试空列表错误

- **WHEN** 测试调用 `ApiClient.batchQueryMovieStatus([])` 并 mock API 返回 400
- **THEN** 测试验证抛出包含 "codes parameter is required" 的错误

#### Scenario: 测试 401 未授权

- **WHEN** 测试调用批量查询并 mock API 返回 401
- **THEN** 测试验证抛出包含 "401" 的错误

#### Scenario: 测试网络超时

- **WHEN** 测试调用批量查询并 mock 网络超时
- **THEN** 测试验证抛出超时错误并正确处理

### Requirement: 增量过滤 E2E 测试

测试套件 SHALL 验证爬虫的增量过滤逻辑，确保已存在内容被正确跳过，仅爬取新内容。

#### Scenario: 测试过滤已存在内容

- **WHEN** 测试启动 `OptimizedCrawler`，mock 发现列表 `[A, B, C]`，批量查询返回 `[A, C]`
- **THEN** 测试验证爬虫仅调用详情页爬取逻辑处理 `B`，跳过 `A` 和 `C`

#### Scenario: 测试全部已存在

- **WHEN** 测试启动爬虫，批量查询返回所有待爬取代码
- **THEN** 测试验证爬虫输出 "所有内容已存在" 并正常退出（退出码 0），未调用详情页爬取

#### Scenario: 测试无已存在内容

- **WHEN** 测试启动爬虫，批量查询返回空列表
- **THEN** 测试验证爬虫处理所有待爬取内容

### Requirement: 配置传递测试

测试套件 SHALL 验证环境变量配置正确传递到爬虫配置对象和进度监控器。

#### Scenario: 测试 MAX_MOVIES 正确传递

- **WHEN** 测试设置 `process.env.MAX_MOVIES = '200'` 并初始化爬虫配置
- **THEN** 测试验证 `config.limits.maxMovies` 为 200

#### Scenario: 测试 ProgressMonitor 使用正确配置

- **WHEN** 测试初始化 `ProgressMonitor`，传入配置 `maxMovies: 200`
- **THEN** 测试验证进度条总数为 200，而非硬编码的 100

#### Scenario: 测试缺失环境变量错误

- **WHEN** 测试在未设置 `MAX_MOVIES` 时启动爬虫脚本
- **THEN** 测试验证脚本抛出 "MAX_MOVIES environment variable is required" 错误

### Requirement: 漫画爬虫增量测试

测试套件 SHALL 验证漫画爬虫的批量状态查询和增量过滤功能，确保与电影爬虫一致的行为。

#### Scenario: 测试漫画增量过滤

- **WHEN** 测试启动 `ComicCrawler`，mock 发现列表包含已存在和新漫画
- **THEN** 测试验证爬虫仅处理新漫画，跳过已存在漫画

#### Scenario: 测试漫画章节增量

- **WHEN** 测试爬取单个漫画，mock 章节列表包含已存在和新章节
- **THEN** 测试验证爬虫仅处理新章节，跳过已存在章节

### Requirement: 测试覆盖率要求

测试套件 SHALL 达到以下覆盖率目标：批量查询逻辑覆盖率 ≥ 90%，增量过滤逻辑覆盖率 ≥ 85%，配置传递逻辑覆盖率 100%。

#### Scenario: 验证覆盖率达标

- **WHEN** 测试运行完成并生成覆盖率报告
- **THEN** 报告显示批量查询逻辑覆盖率 ≥ 90%，增量过滤逻辑覆盖率 ≥ 85%，配置传递逻辑覆盖率 100%

#### Scenario: 测试在 CI 中运行

- **WHEN** CI 工作流执行 `pnpm test:crawler`
- **THEN** 所有测试必须通过，且覆盖率满足要求，否则 CI 失败

