# 数据质量监控仪表板（未实现）

**状态**: 📋 设计文档
**优先级**: P3（可选）
**预计工时**: 2-3 天

## 概述

数据质量监控仪表板用于实时监控 SeesaaWiki 数据源集成后的数据质量指标，帮助团队及时发现和解决数据问题。

## 核心指标

### 1. 爬虫成功率

| 指标名称 | 定义 | 目标值 | 告警阈值 |
|---------|------|--------|---------|
| 女优爬虫成功率 | 成功爬取女优 / 尝试爬取女优 | ≥ 90% | < 85% |
| 厂商爬虫成功率 | 成功爬取厂商 / 尝试爬取厂商 | ≥ 15% | < 10% |
| 影片爬虫成功率 | 成功爬取影片 / 尝试爬取影片 | ≥ 95% | < 90% |

### 2. 名字映射覆盖率

| 指标名称 | 定义 | 目标值 | 告警阈值 |
|---------|------|--------|---------|
| 女优映射覆盖率 | 已映射女优 / 总女优数 | ≥ 90% | < 85% |
| 高优先级女优覆盖率 | 已映射高优先级女优 / 总高优先级女优 | ≥ 95% | < 90% |
| 厂商映射覆盖率 | 已映射厂商 / 总厂商数 | ≥ 15% | < 10% |

### 3. 数据完整度

| 指标名称 | 定义 | 目标值 |
|---------|------|--------|
| 女优头像覆盖率 | 有头像女优 / 总女优数 | ≥ 90% |
| 女优别名覆盖率 | 有别名女优 / 总女优数 | ≥ 70% |
| 女优 SNS 覆盖率 | 有 SNS 女优 / 总女优数 | ≥ 40% |
| 系列字段填充率 | 有系列信息影片 / 总影片数 | ≥ 95% |

### 4. 爬虫性能

| 指标名称 | 定义 | 目标值 |
|---------|------|--------|
| 女优爬虫平均耗时 | 总耗时 / 女优数量 | ≤ 10 秒/女优 |
| 厂商爬虫平均耗时 | 总耗时 / 厂商数量 | ≤ 8 秒/厂商 |
| 名字匹配平均耗时 | 总匹配耗时 / 匹配次数 | ≤ 5 秒/次 |

### 5. 错误率

| 指标名称 | 定义 | 告警阈值 |
|---------|------|---------|
| SeesaaWiki 404 率 | 404 错误 / 总请求 | > 20% |
| 超时错误率 | 超时错误 / 总请求 | > 10% |
| API 错误率 | API 失败 / 总 API 调用 | > 5% |

## 仪表板布局

### 页面结构

```
┌─────────────────────────────────────────────────────────────┐
│ Starye 数据质量监控                      🟢 系统正常         │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│ 📊 爬虫成功率 (24小时)                                       │
│   ┌─────────────┬─────────────┬─────────────┐              │
│   │ 女优: 92%   │ 厂商: 12%   │ 影片: 96%   │              │
│   │ ████████░   │ ██░░░░░░░   │ █████████░  │              │
│   └─────────────┴─────────────┴─────────────┘              │
│                                                               │
│ 🎯 数据完整度                                                │
│   女优头像: 91% ██████████░                                  │
│   女优别名: 72% ████████░░░                                  │
│   女优 SNS: 43% █████░░░░░░                                  │
│   系列信息: 97% ██████████                                   │
│                                                               │
│ 📈 趋势图 (7天)                                              │
│   [女优爬虫成功率折线图]                                    │
│   [名字映射覆盖率折线图]                                    │
│                                                               │
│ ⚠️  告警列表                                                 │
│   • 女优爬虫成功率低于目标 (84%)                   1小时前   │
│   • 高优先级女优未映射数量增加                     2小时前   │
│                                                               │
│ 📋 最近爬虫运行记录                                          │
│   [表格: 时间 | 类型 | 数量 | 成功率 | 耗时]                │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## 技术方案

### 方案 1: Grafana + Prometheus（推荐）

**优点**:
- ✅ 开源免费
- ✅ 功能强大，可定制性高
- ✅ 支持多种数据源
- ✅ 内置告警功能

**实施步骤**:

1. **部署 Prometheus**
   ```yaml
   # docker-compose.yml
   version: '3'
   services:
     prometheus:
       image: prom/prometheus
       volumes:
         - ./prometheus.yml:/etc/prometheus/prometheus.yml
       ports:
         - 9090:9090
   ```

2. **添加指标导出器**
   ```typescript
   // packages/crawler/src/utils/metrics.ts
   import { Counter, Gauge, Registry } from 'prom-client'

   export const actorCrawlSuccessRate = new Gauge({
     name: 'actor_crawl_success_rate',
     help: '女优爬虫成功率',
   })

   export const actorMappingCoverage = new Gauge({
     name: 'actor_mapping_coverage',
     help: '女优映射覆盖率',
   })
   ```

3. **配置 Grafana 仪表板**
   - 导入预设仪表板模板
   - 配置数据源指向 Prometheus
   - 设置告警规则

### 方案 2: 自定义 Web 仪表板

**优点**:
- ✅ 完全自定义
- ✅ 可集成到现有 Dashboard
- ✅ 无需额外部署

**技术栈**:
- 前端：Vue 3 + ECharts
- 后端：Cloudflare Workers + D1
- 数据存储：D1 database

**实施步骤**:

1. **创建指标表**
   ```sql
   CREATE TABLE metrics (
     id TEXT PRIMARY KEY,
     metric_name TEXT NOT NULL,
     metric_value REAL NOT NULL,
     timestamp INTEGER NOT NULL,
     labels TEXT
   );

   CREATE INDEX idx_metrics_name_time ON metrics(metric_name, timestamp);
   ```

2. **添加指标收集 API**
   ```typescript
   // apps/api/src/routes/metrics/index.ts
   app.post('/metrics', async (c) => {
     const { name, value, labels } = await c.req.json()
     await c.env.DB.prepare(
       'INSERT INTO metrics (id, metric_name, metric_value, timestamp, labels) VALUES (?, ?, ?, ?, ?)'
     ).bind(
       crypto.randomUUID(),
       name,
       value,
       Date.now(),
       JSON.stringify(labels)
     ).run()
     return c.json({ success: true })
   })
   ```

3. **创建仪表板页面**
   ```vue
   <!-- apps/dashboard/src/views/Metrics.vue -->
   <template>
     <div class="metrics-dashboard">
       <h1>数据质量监控</h1>

       <div class="metrics-grid">
         <MetricCard title="女优爬虫成功率" :value="actorSuccessRate" />
         <MetricCard title="厂商爬虫成功率" :value="publisherSuccessRate" />
         <MetricCard title="影片爬虫成功率" :value="movieSuccessRate" />
       </div>

       <EChartLine :data="trendData" />
     </div>
   </template>
   ```

### 方案 3: GitHub Actions + Markdown 报告

**优点**:
- ✅ 零成本
- ✅ 无需额外部署
- ✅ 集成到 Git 工作流

**实施步骤**:

1. **创建指标收集脚本**
   ```bash
   # scripts/collect-metrics.sh
   #!/bin/bash

   # 收集爬虫成功率
   actor_success=$(cat .actor-crawl-log.json | jq '.successRate')

   # 生成报告
   cat > docs/metrics-report.md <<EOF
   # 数据质量报告 $(date +%Y-%m-%d)

   ## 爬虫成功率
   - 女优: ${actor_success}%
   - 厂商: ${publisher_success}%

   ## 趋势
   [图表占位]
   EOF
   ```

2. **创建定时 Actions**
   ```yaml
   # .github/workflows/metrics-report.yml
   name: Daily Metrics Report
   on:
     schedule:
       - cron: '0 0 * * *'

   jobs:
     generate-report:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - run: bash scripts/collect-metrics.sh
         - run: git add docs/metrics-report.md
         - run: git commit -m "chore: 更新指标报告"
         - run: git push
   ```

## 告警规则

### Slack 告警（推荐）

```yaml
# alerting/rules.yml
groups:
  - name: crawler_alerts
    interval: 5m
    rules:
      - alert: ActorCrawlSuccessRateLow
        expr: actor_crawl_success_rate < 85
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: 女优爬虫成功率过低
          description: '当前成功率 {{ $value }}%，低于目标 85%'

      - alert: SeesaaWikiDown
        expr: seesaawiki_404_rate > 50
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: SeesaaWiki 可能不可访问
          description: '404 错误率 {{ $value }}%'
```

### Email 告警

可使用 Cloudflare Workers 的 Email Routing 功能：

```typescript
// apps/api/src/utils/alerting.ts
export async function sendAlert(title: string, message: string) {
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'alerts@starye.com',
      to: 'admin@starye.com',
      subject: `[Starye 告警] ${title}`,
      text: message,
    }),
  })
}
```

## 实施优先级

### P0（必须）- 无需额外工具

- [x] 爬虫日志输出成功率
- [ ] 每日生成 Markdown 报告到 `docs/`
- [ ] GitHub Actions 运行失败时发送通知

### P1（推荐）- 需要额外工具

- [ ] 部署 Grafana 仪表板
- [ ] 配置 Slack/Email 告警
- [ ] 设置关键指标监控

### P2（可选）- 锦上添花

- [ ] 创建自定义 Web 仪表板
- [ ] 集成到 Dashboard 应用
- [ ] 添加历史趋势对比
- [ ] 支持自定义查询和分析

## 参考资源

- [Prometheus 文档](https://prometheus.io/docs/)
- [Grafana 文档](https://grafana.com/docs/)
- [ECharts 文档](https://echarts.apache.org/)
- [GitHub Actions Marketplace](https://github.com/marketplace?type=actions)

## 总结

数据质量监控仪表板是**长期运维的重要工具**，但不是初期必须的。建议：

1. **短期（1 周内）**: 使用 P0 方案（Markdown 报告 + GitHub Actions 通知）
2. **中期（1 月内）**: 评估是否需要更高级的监控（Grafana）
3. **长期（3 月内）**: 根据团队需求决定是否构建自定义仪表板

优先保证**爬虫稳定运行**和**数据质量**，监控工具可以逐步完善。
