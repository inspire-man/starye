# 性能监控 Dashboard 配置指南

## Cloudflare Analytics Dashboard

### Dashboard 配置

#### 创建步骤

1. 登录 Cloudflare Dashboard
2. 选择 starye.org 域名
3. 导航到 Analytics & Logs > Dashboards
4. 点击 "Create Dashboard"
5. 配置以下面板

### 推荐面板配置

#### 面板 1: 请求概览
- **标题**: 请求概览
- **指标**:
  - Total Requests（总请求数）
  - Unique Visitors（唯一访问者）
  - Requests by Country（按国家分布）
- **时间范围**: Last 24 hours
- **图表类型**: 折线图 + 地图

#### 面板 2: 响应时间
- **标题**: API 响应时间
- **指标**:
  - Average Response Time（平均响应时间）
  - P50 Response Time
  - P95 Response Time
  - P99 Response Time
- **时间范围**: Last 24 hours
- **图表类型**: 折线图

#### 面板 3: 缓存性能
- **标题**: 缓存性能
- **指标**:
  - Cache Hit Ratio（缓存命中率）
  - Cache Status（缓存状态分布）
  - Edge Cache Hits
  - Browser Cache Hits
- **时间范围**: Last 24 hours
- **图表类型**: 折线图 + 饼图

#### 面板 4: 错误监控
- **标题**: 错误监控
- **指标**:
  - 4xx Errors
  - 5xx Errors
  - Error Rate（错误率）
  - HTTP Status Codes（状态码分布）
- **时间范围**: Last 24 hours
- **图表类型**: 折线图 + 柱状图

#### 面板 5: 带宽使用
- **标题**: 带宽使用
- **指标**:
  - Bandwidth Used（带宽使用量）
  - Requests by Size（请求大小分布）
  - Response Size（响应大小分布）
- **时间范围**: Last 24 hours
- **图表类型**: 折线图 + 饼图

#### 面板 6: 实时流量
- **标题**: 实时流量
- **指标**:
  - Real-time Requests（实时请求数）
  - Real-time Visitors（实时访客数）
- **时间范围**: Real-time
- **图表类型**: 实时折线图

## Grafana Dashboard 配置（可选）

如果使用 Grafana，可以使用以下配置：

### 数据源配置

```json
{
  "name": "Cloudflare Analytics",
  "type": "cloudflare",
  "url": "https://api.cloudflare.com/client/v4",
  "access": "proxy",
  "jsonData": {
    "apiToken": "YOUR_API_TOKEN",
    "accountTag": "YOUR_ACCOUNT_TAG"
  }
}
```

### Dashboard JSON

```json
{
  "dashboard": {
    "title": "Starye Performance Dashboard",
    "panels": [
      {
        "title": "API Response Time",
        "type": "graph",
        "targets": [
          {
            "expr": "cloudflare_workers_response_time_seconds"
          }
        ]
      },
      {
        "title": "Cache Hit Rate",
        "type": "stat",
        "targets": [
          {
            "expr": "cloudflare_cache_hit_rate"
          }
        ]
      },
      {
        "title": "Error Rate",
        "type": "gauge",
        "targets": [
          {
            "expr": "cloudflare_error_rate"
          }
        ]
      }
    ]
  }
}
```

## 自定义性能端点

### 性能数据收集端点

在 `apps/api/src/routes/performance.ts` 中创建：

```typescript
import { Hono } from 'hono'

const app = new Hono()

// 性能指标端点
app.get('/api/performance/metrics', (c) => {
  const metrics = {
    api: {
      responseTime: {
        avg: 150, // ms
        p50: 120,
        p95: 250,
        p99: 400
      },
      errorRate: 0.05, // %
      requestCount: 1000
    },
    cache: {
      hitRate: {
        cdn: 0.95,
        kv: 0.85,
        memory: 0.92
      }
    },
    database: {
      avgQueryTime: 45, // ms
      slowQueryRate: 0.8, // %
      connectionPoolUtilization: 0.65
    }
  }

  return c.json(metrics)
})

// 健康检查端点
app.get('/api/health', (c) => {
  return c.json({
    status: 'healthy',
    timestamp: Date.now(),
    services: {
      api: 'ok',
      database: 'ok',
      cache: 'ok'
    }
  })
})
```

## 告警配置

### 告警规则

#### 规则 1: 高响应时间告警
- **名称**: High Response Time Alert
- **条件**: P95 响应时间 > 500ms
- **持续时间**: 5 分钟
- **严重性**: Warning
- **通知方式**: Email + Slack

#### 规则 2: 高错误率告警
- **名称**: High Error Rate Alert
- **条件**: 错误率 > 1%
- **持续时间**: 3 分钟
- **严重性**: Critical
- **通知方式**: Email + Slack + SMS

#### 规则 3: 低缓存命中率告警
- **名称**: Low Cache Hit Rate Alert
- **条件**: 缓存命中率 < 80%
- **持续时间**: 10 分钟
- **严重性**: Warning
- **通知方式**: Email

## 实施步骤

### 1. Cloudflare Dashboard 设置
1. 登录 Cloudflare Dashboard
2. 按照"推荐面板配置"创建面板
3. 设置时间范围和刷新频率
4. 保存并分享 Dashboard

### 2. 性能端点部署
1. 创建性能路由文件
2. 实现指标收集逻辑
3. 部署到 Cloudflare Workers
4. 测试端点可用性

### 3. 告警配置
1. 在 Cloudflare 中配置告警规则
2. 设置通知渠道
3. 测试告警触发

### 4. 持续优化
1. 定期审查 Dashboard
2. 根据需求调整面板
3. 优化告警阈值

## 验证方法

1. **Dashboard 可访问性**
   - 访问 Cloudflare Dashboard
   - 检查所有面板正常显示
   - 验证数据实时更新

2. **性能端点测试**
   ```bash
   curl https://api.starye.org/api/performance/metrics
   curl https://api.starye.org/api/health
   ```

3. **告警测试**
   - 手动触发告警条件
   - 验证通知发送
   - 检查告警内容准确性