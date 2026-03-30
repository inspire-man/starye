## ADDED Requirements

### Requirement: 系统 SHALL 实现三阶段名字匹配

系统 **MUST** 实现三阶段女优名字匹配算法，**SHALL** 按优先级依次尝试：精确匹配、索引搜索、本地缓存，**MUST** 在匹配成功后缓存映射关系。

#### Scenario: 精确匹配成功
- **WHEN** 系统尝试匹配 JavBus 女优名"三上悠亜"
- **THEN** 系统构建 Wiki URL `/d/三上悠亜`，访问成功（HTTP 200），返回 Wiki 名"三上悠亜"

#### Scenario: 精确匹配失败
- **WHEN** 系统尝试匹配 JavBus 女优名"森沢かな"，访问 `/d/森沢かな` 失败（HTTP 404）
- **THEN** 系统进入阶段 2（索引搜索）

#### Scenario: 索引搜索成功
- **WHEN** 精确匹配失败，系统定位五十音行"も"（森的读音），访问索引页 `/d/女優ページ一覧(ま)`
- **THEN** 系统在索引页中找到 "森沢かな = 飯岡かなこ"，返回主名"森沢かな"

#### Scenario: 本地缓存命中
- **WHEN** 系统已缓存"森沢かな"的映射，再次尝试匹配
- **THEN** 系统直接从缓存返回 Wiki 名，跳过网络请求

#### Scenario: 全部匹配失败
- **WHEN** 精确匹配、索引搜索都失败，缓存也无记录
- **THEN** 系统返回 null，记录女优为"未匹配"，不抛出异常

### Requirement: 系统 SHALL 维护持久化名字映射表

系统 **MUST** 将名字映射关系存储到本地文件 `.seesaawiki-actor-map.json`，**SHALL** 在启动时加载映射表，**MUST** 在新增映射后立即写入文件。

#### Scenario: 启动时加载映射表
- **WHEN** 系统启动 ActorCrawler
- **THEN** 系统读取 `.seesaawiki-actor-map.json`（如果存在），加载到内存 Map

#### Scenario: 新增映射后持久化
- **WHEN** 系统成功匹配一个新女优（从精确匹配或索引搜索）
- **THEN** 系统将 `{ javbusName: wikiName }` 写入映射表文件

#### Scenario: 处理映射表文件不存在
- **WHEN** 首次运行爬虫，`.seesaawiki-actor-map.json` 不存在
- **THEN** 系统创建空 Map，继续运行，匹配到的映射会逐步填充

#### Scenario: 合并索引阶段映射
- **WHEN** 索引爬虫完成，生成完整映射表
- **THEN** 系统将索引映射与现有映射合并（索引映射优先），写入文件

#### Scenario: 映射冲突处理
- **WHEN** 同一个 JavBus 名映射到不同 Wiki 名（罕见）
- **THEN** 系统使用最新的映射，记录警告日志

### Requirement: 系统 SHALL 支持别名双向查询

系统 **SHALL** 支持从别名查询主名，**MUST** 建立别名到主名的反向索引，**SHALL** 允许使用任何别名匹配到女优。

#### Scenario: 通过别名查询主名
- **WHEN** 系统尝试匹配 JavBus 名"飯岡かなこ"（这是"森沢かな"的别名）
- **THEN** 系统通过反向索引找到主名"森沢かな"，返回主名

#### Scenario: 建立反向索引
- **WHEN** 系统加载映射表或新增映射
- **THEN** 系统为每个别名建立到主名的映射（aliasToMain Map）

#### Scenario: 处理多个女优共享别名
- **WHEN** 两个女优有相同别名（极其罕见）
- **THEN** 系统记录警告，选择第一个匹配的主名（先到先得）

### Requirement: 系统 SHALL 支持五十音自动定位

系统 **MUST** 根据女优名自动定位对应的五十音行，**SHALL** 支持平假名、片假名和汉字的读音推断，**MUST** 处理特殊字符（如英文名）。

#### Scenario: 平假名自动定位
- **WHEN** 系统需要搜索"もりさわかな"
- **THEN** 系统识别首字"も"属于"ま行"，访问索引页 `/d/女優ページ一覧(ま)`

#### Scenario: 片假名自动定位
- **WHEN** 系统需要搜索"モリサワカナ"
- **THEN** 系统将片假名转换为平假名"もりさわかな"，定位到"ま行"

#### Scenario: 汉字读音推断
- **WHEN** 系统需要搜索"森沢かな"（混合汉字和假名）
- **THEN** 系统识别首个假名"か"属于"か行"，访问索引页 `/d/女優ページ一覧(か)`

#### Scenario: 纯汉字名处理
- **WHEN** 系统需要搜索纯汉字名"波多野結衣"
- **THEN** 系统无法推断读音，尝试所有五十音行（按频率优先级），或使用缓存映射

#### Scenario: 英文名处理
- **WHEN** 系统需要搜索英文名"AIKA"
- **THEN** 系统尝试"あ行"索引，或标记为特殊字符类别

### Requirement: 系统 SHALL 记录未匹配女优清单

系统 **MUST** 记录所有未能匹配的 JavBus 女优名，**SHALL** 输出到 `.seesaawiki-unmapped-actors.json`，**SHALL** 提供后续人工审核的基础。

#### Scenario: 记录未匹配女优
- **WHEN** 系统对女优"XXX"的所有匹配尝试都失败
- **THEN** 系统将 `{ javbusName: "XXX", attempts: ["exact", "index"], lastAttempt: timestamp }` 写入未匹配清单

#### Scenario: 避免重复尝试
- **WHEN** 系统在下次运行时遇到已在未匹配清单中的女优
- **THEN** 系统跳过匹配，直接标记为未匹配，节省时间

#### Scenario: 优先级排序
- **WHEN** 系统输出未匹配清单
- **THEN** 系统按女优的作品数量排序（高优先级女优在前），便于人工优先处理

#### Scenario: 人工补充映射
- **WHEN** 管理员在 Dashboard 中手动添加映射（javbusName → wikiName）
- **THEN** 系统将映射写入 `.seesaawiki-actor-map.json`，从未匹配清单中移除

### Requirement: 系统 SHALL 支持映射质量校验

系统 **SHALL** 提供映射质量检查工具，**MUST** 验证映射的准确性，**SHALL** 检测潜在的错误映射。

#### Scenario: 检查映射覆盖率
- **WHEN** 管理员运行映射质量检查
- **THEN** 系统统计：总女优数、已映射数、未映射数、映射覆盖率

#### Scenario: 检测冲突映射
- **WHEN** 系统检查映射表
- **THEN** 系统检测是否有多个 JavBus 名映射到同一个 Wiki 名（可能表示数据错误）

#### Scenario: 验证 Wiki 页面存在性
- **WHEN** 管理员运行深度校验（可选，耗时长）
- **THEN** 系统访问映射表中所有 Wiki URL，验证页面存在（HTTP 200），标记失效映射

#### Scenario: 输出质量报告
- **WHEN** 校验完成
- **THEN** 系统输出报告：覆盖率、冲突数、失效映射数、推荐人工审核的高优先级未匹配女优
