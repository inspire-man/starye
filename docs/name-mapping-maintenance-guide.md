# 名字映射表维护指南

**文档版本**: 1.0  
**最后更新**: 2026-03-31

## 概述

名字映射表是 SeesaaWiki 数据源集成的核心组件，负责将 JavBus 使用的名字映射到 SeesaaWiki 的标准名字。定期维护映射表可以确保：

- 新入行女优的数据覆盖
- 名字变更的及时更新
- 高优先级女优的映射完整性
- 整体数据质量的持续提升

## 映射表文件说明

### 女优映射表

| 文件名 | 说明 | 示例记录数 |
|--------|------|-----------|
| `.actor-name-map.json` | JavBus → SeesaaWiki 名字映射 | 15000-20000 |
| `.actor-alias-index.json` | 别名反向索引 | 5000-8000 |
| `.unmapped-actors.json` | 未匹配女优清单 | 500-1500 |

### 厂商映射表

| 文件名 | 说明 | 示例记录数 |
|--------|------|-----------|
| `.publisher-name-map.json` | JavBus → SeesaaWiki 名字映射 | 10-20 |
| `.unmapped-publishers.json` | 未匹配厂商清单 | 100-110 |

### 系列映射表

| 文件名 | 说明 | 示例记录数 |
|--------|------|-----------|
| `.series-to-publisher-map.json` | 系列 → 真实厂商映射 | 100-200 |

## 定期维护流程

### 每周维护（女优映射表）

**时间**: 建议每周日凌晨 02:00 UTC

**步骤**:

1. **运行女优索引爬虫**
   ```bash
   cd packages/crawler
   pnpm tsx scripts/run-actor-index-crawler.ts
   ```

2. **验证映射表更新**
   ```bash
   # 查看新增映射数量
   git diff .actor-name-map.json | grep '^+' | wc -l
   
   # 查看删除映射数量（不应该有）
   git diff .actor-name-map.json | grep '^-' | wc -l
   ```

3. **检查高优先级未匹配女优**
   ```bash
   # 查看作品数 > 50 的未匹配女优
   cat .unmapped-actors.json | jq '[.[] | select(.movieCount > 50)]'
   ```

4. **（可选）人工补充高优先级映射**
   - 在 SeesaaWiki 手动搜索未匹配女优
   - 找到后直接编辑 `.actor-name-map.json` 添加映射
   - 格式参考现有记录

5. **提交更新**
   ```bash
   git add .actor-name-map.json .actor-alias-index.json .unmapped-actors.json
   git commit -m "chore: 更新女优名字映射表 $(date +%Y-%m-%d)"
   git push
   ```

### 每月维护（厂商映射表）

**时间**: 建议每月1日

**步骤**:

1. **运行厂商索引爬虫**
   ```bash
   cd packages/crawler
   pnpm tsx scripts/run-publisher-index-crawler.ts
   ```

2. **验证并提交**
   ```bash
   git add .publisher-name-map.json .unmapped-publishers.json
   git commit -m "chore: 更新厂商名字映射表 $(date +%Y-%m-%d)"
   git push
   ```

3. **检查系列映射表**
   ```bash
   # 系列映射表由影片爬虫自动维护，无需手动更新
   cat .series-to-publisher-map.json | jq 'length'
   ```

## 自动化方案

### 方案 1: GitHub Actions 定时任务（推荐）

创建 `.github/workflows/weekly-index-crawl.yml`:

```yaml
name: Weekly Index Crawl

on:
  schedule:
    - cron: '0 2 * * 0'  # 每周日 02:00 UTC
  workflow_dispatch:      # 支持手动触发

jobs:
  update-name-mappings:
    runs-on: ubuntu-latest
    timeout-minutes: 180
    
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        
      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '24'
          cache: 'pnpm'
      
      - name: Install dependencies
        run: pnpm install
      
      - name: Run actor index crawler
        run: pnpm --filter @starye/crawler tsx scripts/run-actor-index-crawler.ts
        env:
          PUPPETEER_EXECUTABLE_PATH: /usr/bin/google-chrome
      
      - name: Run publisher index crawler
        run: pnpm --filter @starye/crawler tsx scripts/run-publisher-index-crawler.ts
        env:
          PUPPETEER_EXECUTABLE_PATH: /usr/bin/google-chrome
      
      - name: Commit and push
        run: |
          git config user.name "GitHub Actions Bot"
          git config user.email "actions@github.com"
          git add packages/crawler/.actor-name-map.json
          git add packages/crawler/.actor-alias-index.json
          git add packages/crawler/.publisher-name-map.json
          git add packages/crawler/.unmapped-*.json
          git commit -m "chore: 更新名字映射表 $(date +%Y-%m-%d)" || echo "No changes to commit"
          git push || echo "Nothing to push"
```

### 方案 2: 本地 Cron 任务

如果有本地服务器，可以配置 cron：

```bash
# 编辑 crontab
crontab -e

# 添加任务（每周日 02:00）
0 2 * * 0 cd /path/to/starye/packages/crawler && pnpm tsx scripts/run-actor-index-crawler.ts && git add . && git commit -m "chore: 更新女优映射表" && git push
```

## 映射表格式说明

### 女优映射记录

```json
{
  "javbusName": "三佳詩",
  "wikiName": "三佳詩",
  "wikiUrl": "https://seesaawiki.jp/w/sougouwiki/d/%bb%b0%b2%c1%bb%ed",
  "lastUpdated": 1711843200
}
```

**字段说明**:
- `javbusName`: JavBus 显示的女优名
- `wikiName`: SeesaaWiki 标准名字
- `wikiUrl`: SeesaaWiki 页面 URL（EUC-JP 编码）
- `lastUpdated`: Unix 时间戳（秒）

### 别名索引记录

```json
{
  "alias": "みか うた",
  "mainName": "三佳詩",
  "wikiUrl": "https://seesaawiki.jp/w/sougouwiki/d/%bb%b0%b2%c1%bb%ed"
}
```

### 未匹配记录

```json
{
  "name": "未知女优",
  "movieCount": 5,
  "attempts": ["cache", "exact", "index"],
  "lastAttempt": 1711843200
}
```

## 质量保证

### 人工审核流程

对于高优先级女优（作品数 > 50）的未匹配记录：

1. **筛选目标**
   ```bash
   cat .unmapped-actors.json | jq '[.[] | select(.movieCount > 50)] | sort_by(.movieCount) | reverse'
   ```

2. **手动查找**
   - 访问 https://seesaawiki.jp/w/sougouwiki/
   - 使用站内搜索功能
   - 尝试不同的名字变体（平假名、片假名、空格）

3. **添加映射**
   - 直接编辑 `.actor-name-map.json`
   - 或通过 Dashboard 管理界面添加（未来功能）

4. **验证映射**
   ```bash
   # 重新运行该女优的详情爬虫
   # 确认可以正确获取 SeesaaWiki 数据
   ```

### 映射冲突解决

如果发现多个 JavBus 名字映射到同一个 SeesaaWiki 页面：

1. **检查别名关系**：可能是同一女优的不同名字
2. **检查错误映射**：可能是映射错误，需要修正
3. **保留主名映射**：使用最常见的名字作为主映射

## 性能优化

### 索引爬虫优化建议

1. **并发控制**：避免过高并发导致被限流
   - 女优索引：并发度 = 1-2
   - 厂商索引：并发度 = 1

2. **延迟设置**：保证请求间隔
   - 基础延迟：8-10秒
   - 随机延迟：±2秒

3. **分批处理**：超大量数据可分批运行
   ```bash
   # 分五十音行运行
   GOJUON_LINE=あ行 pnpm tsx scripts/run-actor-index-crawler.ts
   GOJUON_LINE=か行 pnpm tsx scripts/run-actor-index-crawler.ts
   # ... 依此类推
   ```

## 监控和告警

### 建议监控指标

1. **映射覆盖率**：≥ 85%
2. **高优先级映射率**：≥ 95%（作品数 > 50）
3. **映射表增长**：每周新增 50-200 条
4. **未匹配清单大小**：< 2000 条

### 告警规则（可选）

使用 GitHub Actions 或监控工具设置告警：

```yaml
# 示例：映射覆盖率低于 80% 时发送通知
- name: Check mapping coverage
  run: |
    coverage=$(calculate_coverage)
    if [ $coverage -lt 80 ]; then
      echo "::warning::映射覆盖率过低: ${coverage}%"
      # 发送 Slack/Email 通知
    fi
```

## 总结

名字映射表是 SeesaaWiki 数据源的基础设施，定期维护可以：

- ✅ 保持数据覆盖率 > 85%
- ✅ 及时跟进新女优和名字变化
- ✅ 提供高质量的女优元数据
- ✅ 支持人工审核和优化

建议通过 **GitHub Actions 自动化**实现每周更新，减少人工维护成本。
