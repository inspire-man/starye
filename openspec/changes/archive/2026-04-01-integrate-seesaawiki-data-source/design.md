## Context

当前爬虫架构使用 JavBus 作为唯一数据源，分为三层：
1. **影片层**：`JavbusCrawler` 爬取影片基础信息（标题、番号、女优名、厂商名）
2. **女优详情层**：`ActorCrawler` 补全女优信息（仅头像，其他字段基本为空）
3. **厂商详情层**：`PublisherCrawler` 补全厂商信息（仅 Logo）

数据完整度问题：
- 女优信息权重：头像 70%，其他字段 30%（因为其他字段几乎无数据）
- 厂商信息权重：Logo 70%，其他字段 30%
- 关键缺失：别名、社交链接、出道日期、系列关系等核心信息

SeesaaWiki 优势：
- 33,000+ 女优条目，社区维护，数据详细
- 标准化 Wiki 结构，有明确编辑规范
- 包含别名、改名历史、博客链接、作品列表
- 厂商页面包含 Logo、官网、社交媒体、系列关系（如"KMP系1レーベル"）

约束：
- 需要保留 JavBus 影片爬虫（影片基础信息仍从 JavBus 获取）
- 必须兼容现有数据库 schema 和 API 端点
- GitHub Actions 6 小时超时限制
- 反爬虫策略：SeesaaWiki 禁止过度负载服务器

## Goals / Non-Goals

**Goals:**
- 将女优和厂商详情爬取的数据源从 JavBus 替换为 SeesaaWiki
- 实现名字匹配系统，解决 JavBus 名与 SeesaaWiki 名不一致问题
- 获取别名、出道日期、社交链接、系列关系等 JavBus 缺失的核心数据
- 保持爬虫稳定性和反爬虫策略
- 数据完整度目标：女优信息从 70% 提升到 85%+，厂商信息从 70% 提升到 90%+

**Non-Goals:**
- 不修改影片爬虫（JavBus 仍用于影片基础信息）
- 不迁移历史数据（仅影响新爬取的数据）
- 不支持多语言女优名匹配（仅日文）
- 不实现实时爬取（保持定时任务模式）

## Decisions

### 决策 1: 数据源策略 - SeesaaWiki 作为唯一详情源

**选择**：完全替换 JavBus 详情爬取，使用 SeesaaWiki 作为女优和厂商的唯一详情数据源。

**理由**：
- JavBus 女优/厂商数据过于简单（仅名字和图片），保留价值低
- SeesaaWiki 数据质量和完整度远超 JavBus
- 单一数据源降低维护成本，避免数据融合冲突

**替代方案**：
- 方案 A（已否决）：双源互补，同时保留 JavBus 和 SeesaaWiki → 复杂度高，数据融合困难
- 方案 B（已否决）：优先级源，优先 SeesaaWiki 失败时降级 JavBus → JavBus 兜底价值低

### 决策 2: 名字匹配策略 - 三阶段匹配算法

**选择**：实现三阶段名字匹配系统：
1. **阶段 1：精确匹配** - 直接用 JavBus 名构建 Wiki URL 并尝试访问
2. **阶段 2：索引搜索** - 在 Wiki 五十音索引页中搜索女优名
3. **阶段 3：本地缓存** - 建立并持久化名字映射表（`actor-name-map.json`）

**理由**：
- 精确匹配可覆盖 40-60% 的简单案例（如"三上悠亜"）
- 索引搜索可处理别名和改名情况（如"森沢かな = 飯岡かなこ"）
- 本地缓存避免重复搜索，提升性能

**实现细节**：
```
匹配流程
┌───────────────────────────────────────────────┐
│ 输入: JavBus 女优名 (如"森沢かな")             │
│                                               │
│ Step 1: 查询本地缓存                          │
│   IF 缓存命中 → 返回 Wiki 名                  │
│                                               │
│ Step 2: 精确匹配                              │
│   访问: /d/[女優名]                           │
│   IF 成功 → 缓存并返回                        │
│                                               │
│ Step 3: 索引页搜索                            │
│   定位五十音行: "森" → "ま行"                 │
│   爬取: /d/女優ページ一覧(ま)                 │
│   解析别名: "森沢かな = 飯岡かなこ"           │
│   IF 找到 → 缓存并返回                        │
│                                               │
│ Step 4: 失败处理                              │
│   记录未匹配女优                              │
│   标记为需要人工确认                          │
└───────────────────────────────────────────────┘
```

**替代方案**：
- 方案 A（已否决）：仅精确匹配 → 覆盖率低（40-60%）
- 方案 B（已否决）：全量索引预爬取 → 初始化时间长（2-3 小时）

### 决策 3: 页面解析策略 - 专用 Parser + 容错设计

**选择**：创建 `SeesaaWikiParser` 专门处理 Wiki 标记语言解析，使用容错设计处理格式变化。

**理由**：
- SeesaaWiki 使用自有标记语言（非 MediaWiki）
- 虽有编辑规范，但社区维护可能存在格式不一致
- 需要提取表格、列表、链接等多种元素

**解析目标**：

女优页面：
```
输入 HTML:
# 森沢かな（もりさわかな）
別名：飯岡かなこ

## DVD・BD作品
2025/01/15 SSIS-123 [[作品名(S1)>FANZA_URL]]
...

输出 JSON:
{
  "name": "森沢かな",
  "reading": "もりさわかな",
  "aliases": ["飯岡かなこ"],
  "works": [...],
  "debutDate": "2012-07-13",
  "blog": "...",
  "twitter": "..."
}
```

厂商页面：
```
输入 HTML:
# S1 wiki
[Logo画像]
公式サイト: http://www.s1s1s1.com/
Twitter: @S1_No1_Style

输出 JSON:
{
  "name": "S1",
  "logo": "...",
  "website": "http://www.s1s1s1.com/",
  "twitter": "@S1_No1_Style",
  "parentCompany": "株式会社WILL"
}
```

### 决策 4: 数据库 Schema 扩展 - 向后兼容增量迁移

**选择**：在现有 `actors` 和 `publishers` 表上新增字段，保持现有字段不变。

**新增字段**：

```typescript
// actors 表新增
{
  blog: text('blog'),                    // 博客链接
  twitter: text('twitter'),              // Twitter handle
  instagram: text('instagram'),          // Instagram handle
  wikiUrl: text('wiki_url'),             // Wiki页面URL
  // aliases 已存在（JSON），保持不变
}

// publishers 表新增
{
  twitter: text('twitter'),
  instagram: text('instagram'),
  wikiUrl: text('wiki_url'),
  parentPublisher: text('parent_publisher'),  // 母公司/品牌
  brandSeries: text('brand_series'),          // 品牌系列标识
}
```

**迁移策略**：
- 新字段设置为 nullable
- 现有数据不受影响
- 新爬取数据填充新字段
- 后续可触发重新爬取历史数据

**替代方案**：
- 方案 A（已否决）：创建新表分离 Wiki 数据 → 查询复杂度增加
- 方案 B（已否决）：JSON 字段存储所有扩展信息 → 查询性能差

### 决策 5: 爬取顺序 - 两阶段爬取

**选择**：拆分为两个独立阶段：
1. **索引阶段**（一次性）：爬取所有五十音索引页，建立名字映射表
2. **详情阶段**（日常）：基于映射表爬取女优/厂商详情

**理由**：
- 索引页数量有限（约 100-200 页），一次性爬取可建立完整映射
- 详情页爬取可按需进行，避免不必要的请求
- 名字映射表可持久化，加速后续爬取

**实现**：
```
Phase 1: 索引阶段（新增独立脚本）
  pnpm run crawl:seesaawiki:index
  
  → 输出: packages/crawler/.seesaawiki-actor-map.json
  → 格式: { "JavBus名": "Wiki名" }
  → 频率: 每周一次

Phase 2: 详情阶段（修改现有 workflow）
  pnpm run crawl:actor  (修改为使用 SeesaaWiki)
  pnpm run crawl:publisher  (修改为使用 SeesaaWiki)
  
  → 频率: 每天
```

### 决策 6: 反爬虫策略 - 复用现有配置并调整

**选择**：复用 `DEFAULT_MOVIE_ANTI_DETECTION` 配置，微调延迟参数。

**配置**：
```typescript
SEESAAWIKI_ANTI_DETECTION = {
  baseDelay: 8000,        // 8 秒（与 JavBus 一致）
  randomDelay: 4000,      // 0-4 秒随机
  maxRetries: 2,          // 降低重试（Wiki 更稳定）
  enableSessionManagement: false,  // Wiki 无需会话
  enableHeaderRotation: true,      // User-Agent 轮换
}
```

**理由**：
- Wiki 为公开站点，反爬虫策略相对宽松
- 8 秒延迟符合社区友好原则
- 索引页爬取频率低，不会触发限制

## Risks / Trade-offs

### 风险 1: 名字匹配准确率不足
**风险**：预估匹配率 80-85%，仍有 15-20% 女优无法匹配。  
**缓解**：
- 建立未匹配名单，支持人工审核
- 提供管理后台手动添加映射的功能
- 对于高优先级女优（作品数 > 50），人工确认映射

### 风险 2: Wiki 页面格式不统一
**风险**：社区维护的 Wiki 可能存在格式变体，导致解析失败。  
**缓解**：
- 实现容错解析器，支持多种格式变体
- 使用正则表达式 + DOM 解析双重策略
- 记录解析失败案例，持续优化解析器

### 风险 3: SeesaaWiki 反爬虫封禁
**风险**：大规模爬取可能触发 IP 封禁。  
**缓解**：
- 8 秒请求延迟 + 随机延迟
- 索引页爬取限制为每周一次
- 详情页爬取限制并发为 2
- 如触发封禁，支持代理池切换

### 风险 4: 数据源维护停滞
**风险**：SeesaaWiki 可能停止维护或关闭。  
**缓解**：
- 保留 JavBus Strategy 代码作为备份
- 数据库保留 `source` 字段标记数据来源
- 支持快速回滚到 JavBus

### Trade-off 1: 爬取时间增加
- **增加**：索引阶段需要额外 1-2 小时（每周一次）
- **减少**：详情阶段因数据更准确，失败率降低，总时间可能持平
- **接受理由**：数据质量提升远超时间成本

### Trade-off 2: 实现复杂度
- **增加**：名字匹配系统、索引页解析、映射缓存
- **减少**：单一数据源，无需数据融合逻辑
- **接受理由**：一次性投入，长期收益

## Migration Plan

### 阶段 1: 准备（第 1 天）
1. 数据库 schema 迁移
   ```bash
   # 生成迁移 SQL
   pnpm --filter @starye/db generate
   
   # 应用到生产数据库
   pnpm --filter @starye/db migrate
   ```

2. 部署新增字段的 API 端点
   - 部署前验证新字段的序列化/反序列化
   - 确保向后兼容（旧数据的新字段为 null）

### 阶段 2: 索引建立（第 1-2 天）
1. 本地运行索引爬虫
   ```bash
   pnpm --filter @starye/crawler run crawl:seesaawiki:index
   ```

2. 验证名字映射表质量
   - 随机抽样 100 个女优
   - 检查映射准确率
   - 目标：> 80% 匹配成功

3. 提交映射表到版本库
   ```bash
   git add packages/crawler/.seesaawiki-actor-map.json
   git commit -m "feat: add seesaawiki actor name mapping"
   ```

### 阶段 3: 详情爬虫替换（第 3 天）
1. 先部署女优爬虫（优先级更高）
   - 在 GitHub Actions 中手动触发 `daily-actor-crawl.yml`
   - 监控日志，验证数据质量
   - 对比数据完整度提升

2. 后部署厂商爬虫
   - 手动触发 `daily-publisher-crawl.yml`
   - 验证系列关系数据正确性

### 阶段 4: 监控和优化（持续）
- 监控爬虫成功率（目标 > 90%）
- 监控名字匹配率（目标 > 85%）
- 持续优化解析器处理格式变体
- 每月更新名字映射表

### 回滚策略
如果 SeesaaWiki 数据质量不符合预期：

1. **快速回滚**（5 分钟内）
   ```bash
   # 恢复旧版本 ActorCrawler 和 PublisherCrawler
   git revert <commit-hash>
   git push
   ```

2. **数据回滚**（可选）
   - 新字段保留（不删除）
   - 重新触发 JavBus 爬虫补全数据

## Open Questions

1. **图片策略**：SeesaaWiki 是否提供女优头像？还是仅链接到 FANZA？
   - 如果无头像：保留 JavBus 头像爬取
   - 如果有头像：评估图片质量后决定

2. **索引更新频率**：名字映射表多久更新一次？
   - 建议：每周一次（新女优出道频率较低）
   - 可根据实际情况调整

3. **未匹配女优处理**：15-20% 无法匹配的女优如何处理？
   - 方案 A：标记为"需要人工确认"，在 Dashboard 中提供界面
   - 方案 B：保留 JavBus 头像作为最小信息
   - 待用户反馈后决定

4. **厂商系列关系建模**：如何在数据库中表示"KMP系1レーベル"这种关系？
   - 方案 A：使用 `parentPublisher` 和 `brandSeries` 字符串字段
   - 方案 B：创建 `publisher_relations` 关联表
   - 倾向方案 A（简单），后续可扩展
