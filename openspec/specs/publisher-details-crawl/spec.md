# publisher-details-crawl Specification

## Purpose
TBD - created by archiving change integrate-seesaawiki-data-source. Update Purpose after archive.
## Requirements
### Requirement: PublisherCrawler SHALL 使用 SeesaaWiki 作为主数据源

系统 **MUST** 将 PublisherCrawler 的数据源从 JavBus 切换到 SeesaaWiki，**SHALL** 通过名字映射系统获取 Wiki 页面 URL，**MUST** 保持与现有 API 的兼容性。

#### Scenario: 获取待爬取厂商列表
- **WHEN** PublisherCrawler 启动
- **THEN** 系统调用 `GET /api/admin/publishers/pending?limit=100`，获取待爬取厂商列表（包含 JavBus 名）

#### Scenario: 名字映射到 Wiki
- **WHEN** 系统获得 JavBus 厂商名 "S1"
- **THEN** 系统调用名字映射模块，获取 Wiki 名和 Wiki URL（`/d/S1 wiki`）

#### Scenario: 爬取 Wiki 详情页
- **WHEN** 系统获得 Wiki URL
- **THEN** 系统使用 SeesaaWikiStrategy 爬取详情页，提取所有可用字段

#### Scenario: 同步到 API
- **WHEN** 系统完成厂商详情爬取
- **THEN** 系统调用 `PATCH /api/admin/publishers/:id`，更新厂商记录（包含新增字段）

#### Scenario: 处理名字匹配失败
- **WHEN** 名字映射模块返回 null（未能匹配）
- **THEN** 系统跳过该厂商，记录到 `FailedTaskRecorder`，标记为 "name_mapping_failed"

### Requirement: 系统 SHALL 爬取厂商官网和社交媒体

系统 **MUST** 提取厂商的官网和社交媒体链接，**SHALL** 存储到对应字段，**MUST** 支持 Twitter、Instagram 等平台。

#### Scenario: 提取官网链接
- **WHEN** Wiki 页面包含 "公式サイト: http://www.s1s1s1.com/"
- **THEN** 系统提取官网 URL，存储到 `website` 字段

#### Scenario: 提取 Twitter 链接
- **WHEN** Wiki 页面包含 "Twitter: @S1_No1_Style"
- **THEN** 系统提取 Twitter handle，存储到 `twitter` 字段

#### Scenario: 提取 Instagram 链接
- **WHEN** Wiki 页面包含 "Instagram: s1_no1_style_"
- **THEN** 系统提取 Instagram handle，存储到 `instagram` 字段

#### Scenario: 处理多个社交媒体
- **WHEN** Wiki 页面包含其他社交媒体（如 Facebook、YouTube）
- **THEN** 系统将这些链接存储到 `socialLinks` JSON 字段（如果该字段存在）

#### Scenario: 处理缺失链接
- **WHEN** Wiki 页面未包含官网或社交媒体链接
- **THEN** 系统将对应字段设置为 null

### Requirement: 系统 SHALL 爬取厂商 Logo

系统 **MUST** 提取厂商的 Logo 图片，**SHALL** 上传到 R2 存储，**MUST** 支持多种图片格式和来源。

#### Scenario: 提取 Wiki 托管的 Logo
- **WHEN** Wiki 页面包含本地托管的 Logo 图片
- **THEN** 系统下载图片，上传到 R2，更新 `logo` 字段为 R2 URL

#### Scenario: 提取外链 Logo
- **WHEN** Wiki 页面链接到外部 Logo（如 FANZA CDN）
- **THEN** 系统下载外部图片，上传到 R2（避免链接失效）

#### Scenario: 处理无 Logo
- **WHEN** Wiki 页面未包含 Logo 图片
- **THEN** 系统将 `logo` 字段设置为 null，不影响其他字段爬取

#### Scenario: Logo 质量优先级
- **WHEN** Wiki 页面包含多个 Logo（如不同尺寸）
- **THEN** 系统优先选择高分辨率 Logo（基于文件大小或尺寸判断）

### Requirement: 系统 SHALL 爬取厂商描述信息

系统 **MUST** 提取厂商的描述信息，**SHALL** 存储到 `description` 字段，**MUST** 包含厂商的特色、历史等内容。

#### Scenario: 提取简介文本
- **WHEN** Wiki 页面包含厂商简介段落
- **THEN** 系统提取文本内容，存储到 `description` 字段（最多 1000 字符）

#### Scenario: 清理 Wiki 标记
- **WHEN** 描述文本包含 Wiki 标记语法（如 `[[链接]]`、`**加粗**`）
- **THEN** 系统清理标记，保留纯文本或转换为 HTML

#### Scenario: 处理多段描述
- **WHEN** Wiki 页面包含多个描述段落
- **THEN** 系统合并段落，使用换行符分隔

#### Scenario: 处理无描述
- **WHEN** Wiki 页面未包含描述信息
- **THEN** 系统将 `description` 字段设置为 null

### Requirement: 系统 SHALL 爬取厂商系列关系

系统 **MUST** 提取厂商的系列关系信息，**SHALL** 存储到 `parentPublisher` 和 `brandSeries` 字段，**MUST** 识别母公司和品牌系列。

#### Scenario: 提取母公司信息
- **WHEN** Wiki 页面包含 "KMP系1レーベル" 标注
- **THEN** 系统提取母公司名"KMP"，存储到 `parentPublisher` 字段

#### Scenario: 提取品牌系列标签
- **WHEN** Wiki 页面包含 "Premium系列" 标签
- **THEN** 系统提取标签，存储到 `brandSeries` 字段

#### Scenario: 处理复杂系列描述
- **WHEN** Wiki 页面包含详细的系列描述文本
- **THEN** 系统提取关键信息（母公司、系列特征），忽略冗余描述

#### Scenario: 处理独立厂商
- **WHEN** Wiki 页面未包含系列关系信息
- **THEN** 系统将 `parentPublisher` 和 `brandSeries` 设置为 null

### Requirement: 系统 SHALL 保留 Wiki 来源链接

系统 **MUST** 存储厂商的 Wiki 页面 URL，**SHALL** 存储到 `wikiUrl` 字段，**MUST** 便于后续验证和更新。

#### Scenario: 存储 Wiki URL
- **WHEN** 系统成功爬取厂商详情
- **THEN** 系统将 Wiki 页面完整 URL（如 "https://seesaawiki.jp/w/sougouwiki/d/S1 wiki"）存储到 `wikiUrl` 字段

#### Scenario: 更新 source 字段
- **WHEN** 系统从 SeesaaWiki 爬取数据
- **THEN** 系统将 `source` 字段更新为 "seesaawiki"（原为 "javbus"）

#### Scenario: 保留 sourceId
- **WHEN** 系统爬取 Wiki 数据
- **THEN** 系统保留原 `sourceId`（JavBus ID），不覆盖

### Requirement: 系统 SHALL 计算数据完整度

系统 **MUST** 重新计算厂商数据的完整度，**SHALL** 调整字段权重以反映 Wiki 数据的丰富性，**MUST** 输出完整度提升报告。

#### Scenario: 更新完整度权重
- **WHEN** 系统计算厂商数据完整度
- **THEN** 系统使用新权重：`logo: 30%, website: 20%, twitter: 10%, instagram: 10%, description: 15%, 系列关系: 15%`

#### Scenario: 对比切换前后完整度
- **WHEN** 系统完成一批厂商爬取
- **THEN** 系统输出完整度对比报告（如 "平均完整度: 70% → 90%，提升 20%"）

#### Scenario: 标识高价值字段
- **WHEN** 系统统计字段填充率
- **THEN** 系统输出各字段填充率（如 "官网: 75%, 社交媒体: 50%, 系列关系: 60%"）

### Requirement: 系统 SHALL 保持向后兼容

系统 **MUST** 保持与现有 API 和数据结构的兼容性，**SHALL** 不影响已有的厂商数据（新增字段为 nullable），**MUST** 支持渐进式迁移。

#### Scenario: API 端点兼容
- **WHEN** 系统调用 `PATCH /api/admin/publishers/:id` 更新厂商
- **THEN** API 接受新增字段（`twitter`, `instagram`, `wikiUrl`, `parentPublisher`, `brandSeries`），旧字段保持不变

#### Scenario: 已有数据不受影响
- **WHEN** 数据库中存在旧厂商数据（无新字段）
- **THEN** 系统不破坏旧数据，新字段为 null，查询和展示正常

#### Scenario: 渐进式迁移
- **WHEN** 系统开始使用 SeesaaWiki 爬取新厂商
- **THEN** 新厂商有完整数据，旧厂商数据保持不变（可后续触发重新爬取）

