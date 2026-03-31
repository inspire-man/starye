# 名字映射表更新流程

**日期**: 2026-03-31
**目的**: 定期维护女优和厂商的 JavBus ↔ SeesaaWiki 名字映射表

## 为什么需要定期更新

1. **新女优入行**: 每周都有新女优出道，需要建立映射
2. **名字变化**: 女优可能改名或添加别名
3. **数据源更新**: SeesaaWiki 可能添加新的词条
4. **映射质量**: 修正错误映射，提高匹配准确率

## 更新频率建议

| 映射表类型 | 建议频率 | 预计耗时 | 数据量 |
|-----------|---------|---------|--------|
| 女优映射表 | **每周** | 1-2小时 | 15000-20000条 |
| 厂商映射表 | **每月** | 10-15分钟 | 126条 |

## 更新流程

### 1. 运行女优索引爬虫

**脚本**: `packages/crawler/scripts/run-actor-index-crawler.ts`

```bash
# 进入爬虫目录
cd packages/crawler

# 运行索引爬虫（爬取所有五十音行）
pnpm tsx scripts/run-actor-index-crawler.ts
```

**输出文件**:
- `.actor-name-map.json`: 女优名字映射表（JavBus → SeesaaWiki）
- `.actor-alias-index.json`: 女优别名反向索引
- `.unmapped-actors.json`: 未匹配女优清单

**预期结果**:
- 总计女优：15000-20000个
- 映射成功率：85-95%
- 未匹配女优：500-1500个

### 2. 运行厂商索引爬虫

**脚本**: `packages/crawler/scripts/run-publisher-index-crawler.ts`

```bash
# 进入爬虫目录
cd packages/crawler

# 运行厂商索引爬虫（从首页提取）
pnpm tsx scripts/run-publisher-index-crawler.ts
```

**输出文件**:
- `.publisher-name-map.json`: 厂商名字映射表
- `.unmapped-publishers.json`: 未匹配厂商清单

**预期结果**:
- 总计厂商：126个
- 映射成功率：10-20%（SeesaaWiki 厂商页面较少）
- 未匹配厂商：100-110个

### 3. 验证映射表质量

**检查项**:
```bash
# 查看映射表数量
wc -l .actor-name-map.json
wc -l .publisher-name-map.json

# 检查未匹配清单（高优先级女优）
cat .unmapped-actors.json | jq '.[] | select(.movieCount > 50)'
```

**质量指标**:
- ✅ 映射覆盖率 > 85%
- ✅ 重复映射 = 0
- ✅ 高优先级女优（作品数 > 50）映射率 > 95%

### 4. 人工审核和补充（可选）

对于高优先级女优（作品数 > 50）的未匹配记录，可以人工查找并补充：

**步骤**:
1. 从 `.unmapped-actors.json` 中筛选高优先级女优
2. 在 SeesaaWiki 手动搜索正确名字
3. 添加到 `.actor-name-map.json`
4. 重新运行女优详情爬虫

**示例**（手动添加映射）:
```json
{
  "javbusName": "桜井彩",
  "wikiName": "さくらい あや",
  "wikiUrl": "https://seesaawiki.jp/w/sougouwiki/d/...",
  "lastUpdated": 1711843200
}
```

### 5. 触发详情爬虫

映射表更新后，触发详情爬虫以拉取新映射的女优/厂商详情：

```bash
# 触发女优详情爬虫（GitHub Actions）
gh workflow run daily-actor-crawl.yml

# 触发厂商详情爬虫（GitHub Actions）
gh workflow run daily-publisher-crawl.yml
```

## 自动化建议

### GitHub Actions 定时任务

创建 `.github/workflows/weekly-index-crawl.yml`:

```yaml
name: Weekly Index Crawl
on:
  schedule:
    - cron: '0 2 * * 0' # 每周日 02:00 UTC
  workflow_dispatch:

jobs:
  crawl-index:
    runs-on: ubuntu-latest
    timeout-minutes: 180 # 3小时
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: '24'
          cache: pnpm

      - run: pnpm install

      - name: 运行女优索引爬虫
        run: pnpm --filter @starye/crawler tsx scripts/run-actor-index-crawler.ts

      - name: 运行厂商索引爬虫
        run: pnpm --filter @starye/crawler tsx scripts/run-publisher-index-crawler.ts

      - name: 提交映射表更新
        run: |
          git config user.name "GitHub Actions Bot"
          git config user.email "actions@github.com"
          git add packages/crawler/.actor-name-map.json
          git add packages/crawler/.publisher-name-map.json
          git add packages/crawler/.unmapped-*.json
          git commit -m "chore: 更新名字映射表 $(date +%Y-%m-%d)" || echo "No changes"
          git push
```

## 监控和质量检查

### 映射质量指标

定期检查以下指标（建议每月）：

```bash
# 女优映射覆盖率
total_actors=$(wrangler d1 execute starye-db --command "SELECT COUNT(*) FROM actor" | grep -oP '\d+')
mapped_actors=$(cat .actor-name-map.json | jq 'length')
echo "映射覆盖率: $(bc <<< "scale=2; $mapped_actors / $total_actors * 100")%"

# 未匹配高优先级女优
cat .unmapped-actors.json | jq '[.[] | select(.movieCount > 50)] | length'
```

### 数据完整度趋势

对比切换前后的数据完整度：

| 指标 | 切换前（JavBus） | 切换后（SeesaaWiki） | 提升 |
|------|----------------|-------------------|------|
| 女优头像 | 60% | 90%+ | +30% |
| 女优别名 | 0% | 70%+ | +70% |
| 女优 SNS | 0% | 40%+ | +40% |
| 厂商 Logo | 30% | 35% | +5% |

## R2 映射文件自动上传

为了让 Dashboard 的名字映射管理功能完全可用，映射文件可以自动上传到 R2。

### 启用方法

在 `packages/crawler/.env` 中添加：

```bash
UPLOAD_MAPPINGS_TO_R2=true
```

### 上传的文件

- `mappings/actor-name-map.json` - 女优名字映射表
- `mappings/publisher-name-map.json` - 厂商名字映射表
- `mappings/unmapped-actors.json` - 未匹配女优清单
- `mappings/unmapped-publishers.json` - 未匹配厂商清单
- `mappings/series-to-publisher-map.json` - 系列→厂商映射
- `mappings/backups/*.json` - 历史版本备份（自动创建）

### 工作流程

1. 爬虫运行结束时自动保存本地文件
2. 如果启用 R2 上传，自动上传到 R2 并创建备份
3. Dashboard API 从 R2 读取数据
4. 用户通过 Dashboard 在线查看和管理映射

### 验证上传

```bash
# 快速验证 R2 配置
cd packages/crawler
pnpm tsx scripts/verify-r2-upload.ts

# 运行爬虫测试
MAX_ACTORS=10 UPLOAD_MAPPINGS_TO_R2=true pnpm crawl:actor
# 日志应显示 "✅ 映射文件已上传到 R2"
```

### Dashboard 集成

启用 R2 上传后，Dashboard 可以：
- 查看未匹配清单（按优先级排序）
- 手动添加映射（实时生效）
- 查看映射质量报告（覆盖率、冲突数）
- 查询版本历史（回溯数据变化）

**访问路径**:
- 名字映射管理：`/name-mapping-management`
- 映射质量报告：`/mapping-quality-report`

### 相关文档

- [R2 映射存储快速部署指南](../../docs/r2-mapping-quick-deploy-guide.md) - ⭐ 推荐从这里开始
- [R2 映射存储配置指南](../../docs/r2-mapping-storage-setup-guide.md)
- [R2 存储实施报告](../../docs/r2-mapping-storage-implementation-report.md)
- [环境变量配置说明](../../docs/r2-mapping-env-vars-guide.md)
- [Dashboard 映射管理功能](../../docs/dashboard-name-mapping-features-guide.md)

## 常见问题

### Q: 映射表文件过大怎么办？

A: 15000+ 条映射的 JSON 文件约 2-3MB，Git 可以正常处理。如确实过大，可以：
- 使用 Git LFS 管理映射表文件
- 或将映射表存储到数据库（新增 `name_mappings` 表）

### Q: 如何处理重复映射？

A: 映射表使用 `Map` 结构，同一个 JavBus 名字只会有一个映射。如需更新映射，直接修改 JSON 文件即可。

### Q: 未匹配清单会越来越大吗？

A: 是的。建议定期清理长期未匹配的低优先级女优（作品数 < 10）。

### Q: 索引爬虫失败了怎么办？

A: 索引爬虫有失败恢复机制：
```bash
# 查看失败任务
cat .index-crawl-log-*.json

# 恢复模式重试（未实现，需手动重跑）
pnpm tsx scripts/run-actor-index-crawler.ts
```

## 相关文档

- [SeesaaWiki 爬虫策略](./src/strategies/seesaawiki/README.md)
- [名字映射器设计](./src/lib/name-mapper.ts)
- [系列厂商区分报告](../../docs/series-publisher-separation-report-2026-03-31.md)
- [本地测试报告](../../docs/local-test-report-2026-03-31.md)
