## ADDED Requirements

### Requirement: 女优优先级排序算法

系统 MUST 实现基于多因素的女优优先级排序算法，SHALL 根据 movieCount（作品数量）、crawlFailureCount（失败次数）、lastCrawlAttempt（上次尝试时间）计算优先级分数，MUST 优先爬取高热度、低失败率、从未尝试过的女优。

#### Scenario: 计算优先级分数
- **WHEN** 调用 `calculatePriority(actor)` 传入女优对象
- **THEN** 系统计算分数：`score = movieCount * 10 - crawlFailureCount * 20 + newActorBonus`，其中 newActorBonus 在 lastCrawlAttempt 为 null 时为 15

#### Scenario: 高热度女优优先
- **WHEN** 女优 A 有 50 部作品，女优 B 有 5 部作品，其他条件相同
- **THEN** 女优 A 的优先级分数为 500，女优 B 为 50，系统优先爬取女优 A

#### Scenario: 惩罚多次失败
- **WHEN** 女优 A 失败 0 次，女优 B 失败 2 次，movieCount 相同
- **THEN** 女优 B 的分数减少 40 分（2 * 20），排序靠后

#### Scenario: 新女优加成
- **WHEN** 女优 A 从未被爬取过（lastCrawlAttempt 为 null），女优 B 已尝试过
- **THEN** 女优 A 获得 15 分加成，优先级提高，确保新女优被尝试

### Requirement: 厂商优先级排序算法

系统 MUST 实现厂商优先级排序算法，SHALL 使用与女优相同的多因素公式，MUST 根据 movieCount、crawlFailureCount、lastCrawlAttempt 计算分数。

#### Scenario: 厂商分数计算
- **WHEN** 调用 `calculatePriority(publisher)` 传入厂商对象
- **THEN** 系统使用相同公式：`score = movieCount * 10 - crawlFailureCount * 20 + newPublisherBonus`

#### Scenario: 大厂优先
- **WHEN** 厂商 A 有 200 部作品，厂商 B 有 20 部作品
- **THEN** 厂商 A 优先级更高，优先爬取

### Requirement: 待爬取列表排序

系统 MUST 在 `GET /api/admin/actors/pending` 和 `GET /api/admin/publishers/pending` 端口中应用优先级排序，SHALL 使用数据库层的 `ORDER BY` 子句实现排序，MUST 确保返回的列表按优先级从高到低排列。

#### Scenario: 数据库层排序
- **WHEN** API 查询待爬取女优时
- **THEN** 系统使用 SQL `ORDER BY movieCount DESC, crawlFailureCount ASC, lastCrawlAttempt ASC NULLS FIRST` 进行排序

#### Scenario: Null 值优先
- **WHEN** 一些女优 `lastCrawlAttempt` 为 null（从未尝试），一些有值
- **THEN** 使用 `NULLS FIRST` 确保从未尝试的女优优先返回

#### Scenario: 二级排序
- **WHEN** 多个女优 movieCount 相同
- **THEN** 系统按 crawlFailureCount 升序排序（失败少的优先），如果仍相同则按 lastCrawlAttempt 升序（更久未尝试的优先）

### Requirement: 爬虫客户端排序

系统 MUST 在爬虫客户端（ActorCrawler, PublisherCrawler）中实现二次排序，SHALL 调用 `sortByPriority(items)` 方法对从 API 获取的列表进行排序，MUST 允许在客户端调整排序策略而不修改 API。

#### Scenario: 客户端排序实现
- **WHEN** ActorCrawler 从 API 获取 150 个待爬取女优后
- **THEN** 调用 `sortByPriority(actors)` 使用 `Array.toSorted()` 按优先级分数重新排序

#### Scenario: 不可变排序
- **WHEN** 调用 `toSorted()` 进行排序
- **THEN** 系统返回新数组，不修改原始数组，保持数据不可变性

#### Scenario: 自定义排序策略
- **WHEN** 未来需要调整排序公式（如增加"最近更新时间"因素）
- **THEN** 只需修改 `calculatePriority()` 方法，无需改动 API 端口

### Requirement: 排序性能优化

系统 MUST 确保排序操作的性能开销可接受，SHALL 在数据库查询中使用索引，MUST 确保排序 100-150 个记录的耗时 <100ms。

#### Scenario: 数据库索引
- **WHEN** 查询待爬取女优并排序时
- **THEN** 系统利用 `movieCount`, `crawlFailureCount`, `lastCrawlAttempt` 字段的索引，加速排序查询

#### Scenario: 客户端排序性能
- **WHEN** 在客户端对 150 个女优进行排序
- **THEN** 使用原生 JavaScript `toSorted()` 方法，耗时 <10ms，不影响爬虫启动速度

### Requirement: 排序策略文档化

系统 MUST 在代码注释中清晰说明排序策略和权重，SHALL 包含示例场景，MUST 便于未来调整和优化。

#### Scenario: 注释说明
- **WHEN** 阅读 `calculatePriority()` 方法代码
- **THEN** 代码包含注释说明各因素的权重（movieCount: 10x, crawlFailureCount: -20x, newBonus: +15）和设计理由

#### Scenario: 示例场景
- **WHEN** 代码注释中包含示例
- **THEN** 如 "例：女优 A (movieCount=50, crawlFailureCount=0, new=false) 分数 = 500，女优 B (movieCount=10, crawlFailureCount=0, new=true) 分数 = 115"
