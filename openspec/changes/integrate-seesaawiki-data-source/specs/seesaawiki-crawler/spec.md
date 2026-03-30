## ADDED Requirements

### Requirement: 系统 SHALL 爬取 SeesaaWiki 索引页

系统 **SHALL** 能够爬取 SeesaaWiki 的女优索引页（按五十音分类），**MUST** 提取每个女优的名字、别名和详情页链接，**SHALL** 建立名字映射表。

#### Scenario: 爬取单个五十音索引页
- **WHEN** 系统访问 `/d/女優ページ一覧(あ)` 索引页
- **THEN** 系统解析页面，提取所有女优名、别名（"名字A = 名字B" 格式）和详情页链接

#### Scenario: 解析别名格式
- **WHEN** 索引页包含 "森沢かな = 飯岡かなこ" 格式的别名
- **THEN** 系统识别主名"森沢かな"和别名"飯岡かなこ"，建立双向映射

#### Scenario: 处理多别名
- **WHEN** 索引页包含 "名字A = 名字B = 名字C = 名字D" 格式
- **THEN** 系统识别主名（第一个）和所有别名（其余），建立多对一映射

#### Scenario: 处理箭头引用
- **WHEN** 索引页包含 "名字A ⇒ 名字B" 格式（表示改名）
- **THEN** 系统识别名字A为旧名，名字B为现役名，建立映射并标记改名关系

#### Scenario: 处理分页索引
- **WHEN** 某个五十音行有多页（如"あ"、"あ-2"、"あ-3"）
- **THEN** 系统爬取所有分页，合并提取的女优列表

### Requirement: 系统 SHALL 爬取女优详情页

系统 **SHALL** 能够爬取 SeesaaWiki 的女优详情页，**MUST** 提取女优的详细信息，**SHALL** 包含别名、出道日期、博客链接、社交媒体等字段。

#### Scenario: 解析女优基本信息
- **WHEN** 系统访问女优详情页 `/d/森沢かな`
- **THEN** 系统提取：主名"森沢かな"、读音"もりさわかな"、别名列表

#### Scenario: 提取出道日期
- **WHEN** 详情页包含"デビュー：2012年7月13日"或类似格式
- **THEN** 系统解析并存储出道日期为 Unix 时间戳

#### Scenario: 提取社交链接
- **WHEN** 详情页包含 Twitter、Instagram、YouTube、博客等链接
- **THEN** 系统提取所有社交媒体链接，存储为 JSON 格式

#### Scenario: 提取作品列表
- **WHEN** 详情页包含作品列表（格式：YYYY/MM/DD 品番 作品名）
- **THEN** 系统解析作品列表，提取品番、发售日期、厂商名（可选，用于交叉验证）

#### Scenario: 处理缺失字段
- **WHEN** 详情页缺少某些字段（如生日、身高等）
- **THEN** 系统将对应字段设置为 null，不影响其他字段的提取

#### Scenario: 处理页面不存在
- **WHEN** 访问不存在的女优页面（404）
- **THEN** 系统记录女优为"未找到"，不抛出异常，继续处理下一个

### Requirement: 系统 SHALL 爬取厂商详情页

系统 **SHALL** 能够爬取 SeesaaWiki 的厂商详情页，**MUST** 提取厂商的详细信息，**SHALL** 包含 Logo、官网、社交媒体、系列关系等字段。

#### Scenario: 解析厂商基本信息
- **WHEN** 系统访问厂商详情页 `/d/S1 wiki`
- **THEN** 系统提取：厂商名"S1"、Logo URL、官网链接

#### Scenario: 提取社交媒体
- **WHEN** 详情页包含 "Twitter: @S1_No1_Style" 和 "Instagram: s1_no1_style_"
- **THEN** 系统提取 Twitter handle 和 Instagram handle

#### Scenario: 提取系列关系
- **WHEN** 详情页包含系列关系标注（如"KMP系1レーベル"）
- **THEN** 系统提取母公司信息，存储到 `parentPublisher` 和 `brandSeries` 字段

#### Scenario: 解析 Logo 图片
- **WHEN** 详情页包含 Logo 图片链接
- **THEN** 系统提取图片 URL，支持多种格式（相对路径、绝对路径、CDN 链接）

#### Scenario: 处理表格化数据
- **WHEN** 厂商信息以表格形式展示
- **THEN** 系统解析表格，提取所有可用字段（Logo、官网、备注等）

### Requirement: 系统 SHALL 实现容错解析

系统 **MUST** 实现容错的 Wiki 标记语言解析器，**SHALL** 支持多种格式变体，**MUST** 在解析失败时记录错误但不中断爬虫。

#### Scenario: 处理标题格式变体
- **WHEN** 女优名标题使用不同格式（如"# 名字"、"## 名字"、"**名字**"）
- **THEN** 系统能够识别并提取女优名

#### Scenario: 处理别名分隔符变体
- **WHEN** 别名使用不同分隔符（"="、"／"、","、"、"）
- **THEN** 系统能够正确拆分别名列表

#### Scenario: 处理日期格式变体
- **WHEN** 日期使用不同格式（"2012年7月13日"、"2012/07/13"、"2012-07-13"）
- **THEN** 系统能够解析并统一为 Unix 时间戳

#### Scenario: 处理乱码和编码问题
- **WHEN** 页面包含特殊字符或编码问题
- **THEN** 系统正确处理日文编码（UTF-8），避免乱码

#### Scenario: 记录解析失败
- **WHEN** 某个字段解析失败（如日期格式无法识别）
- **THEN** 系统记录警告日志，该字段设置为 null，继续解析其他字段

### Requirement: 系统 SHALL 遵守 SeesaaWiki 反爬虫策略

系统 **MUST** 实现合理的请求延迟和频率控制，**SHALL** 避免过度负载 SeesaaWiki 服务器，**MUST** 支持反爬虫检测时的降速策略。

#### Scenario: 基础延迟策略
- **WHEN** 系统爬取 SeesaaWiki 页面
- **THEN** 系统在请求之间等待 8000ms + 随机延迟（0-4000ms）

#### Scenario: User-Agent 轮换
- **WHEN** 系统发起 HTTP 请求
- **THEN** 系统随机选择一个真实浏览器的 User-Agent

#### Scenario: 错误退避策略
- **WHEN** 系统连续遇到 3 次请求失败（429、503、超时等）
- **THEN** 系统将延迟增加到 20 秒，并在后续 10 次请求中保持

#### Scenario: 并发限制
- **WHEN** 系统爬取多个详情页
- **THEN** 系统限制并发数为 2，避免同时发起大量请求

#### Scenario: 索引页爬取频率
- **WHEN** 系统需要更新名字映射表
- **THEN** 系统限制索引页爬取频率为每周一次，避免频繁访问

### Requirement: 系统 SHALL 提供数据质量指标

系统 **SHALL** 统计爬取数据的完整度和质量，**MUST** 输出详细的统计报告，**SHALL** 帮助监控数据源的可靠性。

#### Scenario: 字段完整度统计
- **WHEN** 系统完成一批女优爬取
- **THEN** 系统输出各字段的填充率（如"别名: 85%"、"社交链接: 60%"）

#### Scenario: 对比 JavBus 基线
- **WHEN** 系统切换到 SeesaaWiki 数据源
- **THEN** 系统输出数据完整度对比（切换前 vs 切换后）

#### Scenario: 名字匹配成功率
- **WHEN** 系统尝试匹配 JavBus 女优名到 Wiki 名
- **THEN** 系统统计匹配成功率（目标 > 80%），输出未匹配名单

#### Scenario: 解析失败率
- **WHEN** 系统解析 Wiki 页面
- **THEN** 系统统计解析失败率（页面格式异常、字段提取失败等），目标 < 5%
