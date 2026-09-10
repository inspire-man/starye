# 性能监控配置指南

## Cloudflare Workers Analytics

### 已启用配置

在 `apps/api/wrangler.toml` 中配置：

```toml
[observability]

[observability.logs]
enabled = true
head_sampling_rate = 1
persist = true
invocation_logs = true

[observability.traces]
enabled = true
head_sampling_rate = 0.1
persist = true
```

### 监控指标

#### 日志监控
- **Invocation Logs**: 记录每次函数调用
- **采样率**: 100%（所有请求都记录）
- **持久化**: 启用

#### 追踪监控
- **Distributed Tracing**: 启用分布式追踪
- **采样率**: 10%（平衡性能和监控）
- **持久化**: 启用

## 自定义性能指标

### API 响应时间
```typescript
// 在 API 路由中添加
const startTime = Date.now()
// ... 执行业务逻辑
const duration = Date.now() - startTime
console.log(`API Duration: ${duration}ms`)
```

### 缓存命中率
```typescript
let cacheHits = 0
let cacheMisses = 0

// 在缓存逻辑中
if (cached) {
  cacheHits++
  console.log('Cache HIT')
} else {
  cacheMisses++
  console.log('Cache MISS')
}
```

### 数据库查询时间
```typescript
const queryStart = Date.now()
const result = await db.query(...)
const queryDuration = Date.now() - queryStart
console.log(`DB Query: ${queryDuration}ms`)
```

## Cloudflare Analytics Dashboard

### 关键指标

1. **Requests**
   - 总请求数
   - 唯一访问者
   - 请求来源国家/地区

2. **Performance**
   - 平均响应时间
   - P50、P95、P99 响应时间
   - 错误率

3. **Caching**
   - 缓存命中率
   - 缓存驱逐
   - 缓存大小

4. **Data Transferred**
   - 带宽使用量
   - 请求/响应大小

### 设置 Dashboard

1. 登录 Cloudflare Dashboard
2. 选择 starye.org 域名
3. 导航到 Analytics & Logs
4. 创建自定义 Dashboard
5. 添加上述关键指标

## 告警配置

### 响应时间告警
- **条件**: 平均响应时间 > 2 秒
- **持续时间**: 5 分钟
- **通知方式**: Email, Webhook

### 错误率告警
- **条件**: 错误率 > 5%
- **持续时间**: 3 分钟
- **通知方式**: Email, Webhook

### 缓存命中率告警
- **条件**: 缓存命中率 < 80%
- **持续时间**: 10 分钟
- **通知方式**: Email, Webhook

## 实时监控工具

### Cloudflare Web Analytics
```html
<!-- 在 HTML 中添加 -->
<script defer src='https://static.cloudflareinsights.com/beacon.min.js' data-cf-beacon='{"token": "YOUR_TOKEN"}'></script>
```

### 自定义监控端点
```typescript
// apps/api/src/routes/health.ts
app.get('/api/health', (c) => {
  return c.json({
    status: 'healthy',
    timestamp: Date.now(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  })
})
```

## 验证方法

1. **日志检查**
   ```bash
   wrangler tail
   ```

2. **Analytics Dashboard**
   - 访问 Cloudflare Analytics
   - 检查实时数据
   - 验证指标收集

3. **追踪验证**
   - 检查 Cloudflare Traces
   - 验证采样率
   - 检查追踪数据完整性