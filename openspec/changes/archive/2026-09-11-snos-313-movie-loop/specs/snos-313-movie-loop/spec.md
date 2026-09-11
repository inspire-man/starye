## ADDED Requirements

### Requirement: 种子影片爬取
系统 MUST 支持按 JavBus 影片详情 URL 爬取指定番号，不得要求先遍历列表页。

#### Scenario: 只爬 SNOS-313
- **WHEN** 配置 seedMovieUrls 或 startUrl 为 https://www.javbus.com/SNOS-313
- **THEN** 爬虫只处理该详情页并尝试同步影片、磁链、预览图、女优和厂商

### Requirement: 製作商与發行商同时入库
电影同步 MUST 把 JavBus 製作商和發行商都写入 publisher 及 movie_publisher，女优 MUST 保留 star sourceUrl。

#### Scenario: SNOS-313 关联 label/9x
- **WHEN** 影片發行商为 S1 NO.1 STYLE 且 URL 为 /label/9x
- **THEN** publisher 表存在该發行商记录，并与该电影关联

### Requirement: 發行商列表页身份
系统 MUST 从 JavBus label/studio 列表页解析名称和 sourceId；没有 logo 时 MUST 仍返回身份，不得假装详情完整。

#### Scenario: label/9x 无 logo
- **WHEN** 發行商页没有 .logo
- **THEN** 解析结果包含 name 与 sourceId，logo 为空

### Requirement: 管理端增删改
管理端 MUST 能更新/删除影片，并创建/更新/删除女优和厂商。删除 MUST 以 D1 为准并写审计。

#### Scenario: 删除女优后读回
- **WHEN** 管理员删除一名女优
- **THEN** D1 中该记录不存在，关联 movie_actor 被级联删除
