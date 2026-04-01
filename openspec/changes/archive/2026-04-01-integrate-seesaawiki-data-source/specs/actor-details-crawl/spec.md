## ADDED Requirements

### Requirement: ActorCrawler SHALL 使用 SeesaaWiki 作为主数据源

系统 **MUST** 将 ActorCrawler 的数据源从 JavBus 切换到 SeesaaWiki，**SHALL** 通过名字映射系统获取 Wiki 页面 URL，**MUST** 保持与现有 API 的兼容性。

#### Scenario: 获取待爬取女优列表
- **WHEN** ActorCrawler 启动
- **THEN** 系统调用 `GET /api/admin/actors/pending?limit=150`，获取待爬取女优列表（包含 JavBus 名）

#### Scenario: 名字映射到 Wiki
- **WHEN** 系统获得 JavBus 女优名 "森沢かな"
- **THEN** 系统调用名字映射模块，获取 Wiki 名和 Wiki URL（`/d/森沢かな`）

#### Scenario: 爬取 Wiki 详情页
- **WHEN** 系统获得 Wiki URL
- **THEN** 系统使用 SeesaaWikiStrategy 爬取详情页，提取所有可用字段

#### Scenario: 同步到 API
- **WHEN** 系统完成女优详情爬取
- **THEN** 系统调用 `PATCH /api/admin/actors/:id`，更新女优记录（包含新增字段）

#### Scenario: 处理名字匹配失败
- **WHEN** 名字映射模块返回 null（未能匹配）
- **THEN** 系统跳过该女优，记录到 `FailedTaskRecorder`，标记为 "name_mapping_failed"

### Requirement: 系统 SHALL 爬取女优别名信息

系统 **MUST** 提取女优的所有别名，**SHALL** 存储到 `aliases` 字段（JSON 数组），**MUST** 包含改名历史。

#### Scenario: 提取别名列表
- **WHEN** Wiki 页面包含 "別名：飯岡かなこ、○○○"
- **THEN** 系统提取别名数组 `["飯岡かなこ", "○○○"]`，存储到 `aliases` 字段

#### Scenario: 提取改名历史
- **WHEN** Wiki 页面包含 "旧名：飯岡かなこ（2012-2018）"
- **THEN** 系统将旧名添加到 `aliases` 数组，标注为历史名称

#### Scenario: 处理无别名
- **WHEN** Wiki 页面未包含别名信息
- **THEN** 系统将 `aliases` 设置为空数组 `[]`

#### Scenario: 去重别名
- **WHEN** 别名列表中包含重复项或与主名相同的项
- **THEN** 系统去重，保留唯一的别名

### Requirement: 系统 SHALL 爬取女优社交链接

系统 **MUST** 提取女优的社交媒体链接，**SHALL** 存储到对应字段，**MUST** 支持 Twitter、Instagram、博客等多种平台。

#### Scenario: 提取 Twitter 链接
- **WHEN** Wiki 页面包含 Twitter 链接（如 "https://twitter.com/xxx" 或 "@xxx"）
- **THEN** 系统提取 handle 或完整 URL，存储到 `twitter` 字段

#### Scenario: 提取 Instagram 链接
- **WHEN** Wiki 页面包含 Instagram 链接
- **THEN** 系统提取 handle，存储到 `instagram` 字段

#### Scenario: 提取博客链接
- **WHEN** Wiki 页面包含博客链接
- **THEN** 系统提取 URL，存储到 `blog` 字段

#### Scenario: 处理 socialLinks 字段
- **WHEN** Wiki 页面包含其他社交媒体（如 YouTube、TikTok、OnlyFans）
- **THEN** 系统将这些链接存储到 `socialLinks` JSON 字段（格式：`{ platform: url }`）

#### Scenario: 处理失效链接
- **WHEN** 提取的链接无效或已删除（可选验证）
- **THEN** 系统仍保存链接，标注为"未验证"

### Requirement: 系统 SHALL 爬取女优出道和退役信息

系统 **MUST** 提取女优的出道日期和退役日期，**SHALL** 存储到 `debutDate` 和 `retireDate` 字段，**MUST** 更新 `isActive` 状态。

#### Scenario: 提取出道日期
- **WHEN** Wiki 页面包含 "デビュー：2012年7月13日"
- **THEN** 系统解析日期，存储到 `debutDate` 字段（Unix 时间戳）

#### Scenario: 提取退役日期
- **WHEN** Wiki 页面包含 "引退：2022年12月31日"
- **THEN** 系统解析日期，存储到 `retireDate` 字段

#### Scenario: 更新活跃状态
- **WHEN** 系统提取到退役日期
- **THEN** 系统将 `isActive` 设置为 false

#### Scenario: 处理复出情况
- **WHEN** Wiki 页面标注 "引退後復帰"
- **THEN** 系统将 `isActive` 设置为 true，保留原退役日期作为历史记录

#### Scenario: 处理未知日期
- **WHEN** Wiki 页面仅标注 "2012年デビュー"（无具体日期）
- **THEN** 系统存储年份（如 "2012-01-01" 或仅保存年份）

### Requirement: 系统 SHALL 保留 Wiki 来源链接

系统 **MUST** 存储女优的 Wiki 页面 URL，**SHALL** 存储到 `wikiUrl` 字段，**MUST** 便于后续验证和更新。

#### Scenario: 存储 Wiki URL
- **WHEN** 系统成功爬取女优详情
- **THEN** 系统将 Wiki 页面完整 URL（如 "https://seesaawiki.jp/w/sougouwiki/d/森沢かな"）存储到 `wikiUrl` 字段

#### Scenario: 更新 source 字段
- **WHEN** 系统从 SeesaaWiki 爬取数据
- **THEN** 系统将 `source` 字段更新为 "seesaawiki"（原为 "javbus"）

#### Scenario: 保留 sourceId
- **WHEN** 系统爬取 Wiki 数据
- **THEN** 系统保留原 `sourceId`（JavBus ID），不覆盖

### Requirement: 系统 SHALL 计算数据完整度

系统 **MUST** 重新计算女优数据的完整度，**SHALL** 调整字段权重以反映 Wiki 数据的丰富性，**MUST** 输出完整度提升报告。

#### Scenario: 更新完整度权重
- **WHEN** 系统计算女优数据完整度
- **THEN** 系统使用新权重：`avatar: 30%, aliases: 15%, socialLinks: 15%, debutDate: 10%, bio: 10%, 其他: 20%`

#### Scenario: 对比切换前后完整度
- **WHEN** 系统完成一批女优爬取
- **THEN** 系统输出完整度对比报告（如 "平均完整度: 72% → 88%，提升 16%"）

#### Scenario: 标识高价值字段
- **WHEN** 系统统计字段填充率
- **THEN** 系统输出各字段填充率（如 "别名: 85%, 社交链接: 60%, 出道日期: 90%"）

### Requirement: 系统 SHALL 保持向后兼容

系统 **MUST** 保持与现有 API 和数据结构的兼容性，**SHALL** 不影响已有的女优数据（新增字段为 nullable），**MUST** 支持渐进式迁移。

#### Scenario: API 端点兼容
- **WHEN** 系统调用 `PATCH /api/admin/actors/:id` 更新女优
- **THEN** API 接受新增字段（`twitter`, `instagram`, `blog`, `wikiUrl`），旧字段保持不变

#### Scenario: 已有数据不受影响
- **WHEN** 数据库中存在旧女优数据（无新字段）
- **THEN** 系统不破坏旧数据，新字段为 null，查询和展示正常

#### Scenario: 渐进式迁移
- **WHEN** 系统开始使用 SeesaaWiki 爬取新女优
- **THEN** 新女优有完整数据，旧女优数据保持不变（可后续触发重新爬取）
