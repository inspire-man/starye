# 基准性能指标记录

## 目标指标（优化后）

### 前端性能指标
- **FCP (First Contentful Paint)**: < 1.8 秒
- **LCP (Largest Contentful Paint)**: < 2.5 秒
- **TTI (Time to Interactive)**: < 3.8 秒
- **CLS (Cumulative Layout Shift)**: < 0.1
- **FID (First Input Delay)**: < 100 毫秒

### API 性能指标
- **平均响应时间**: < 200 毫秒
- **P95 响应时间**: < 500 毫秒
- **P99 响应时间**: < 1000 毫秒
- **错误率**: < 0.1%

### 缓存性能指标
- **CDN 缓存命中率**: > 95%
- **KV 缓存命中率**: > 80%
- **内存缓存命中率**: > 90%

### 数据库性能指标
- **平均查询时间**: < 50 毫秒
- **慢查询率**: < 1%
- **连接池利用率**: < 70%

### 资源优化指标
- **首屏 JS 体积**: < 200 KB
- **首屏 CSS 体积**: < 50 KB
- **图片平均大小**: < 100 KB
- **带宽使用减少**: > 60%

## 当前基准（需要测量）

### 测量工具
1. **Lighthouse**: 前端性能测试
2. **WebPageTest**: 多地点性能测试
3. **Cloudflare Analytics**: CDN 和 API 指标
4. **Database Query Logs**: 数据库查询性能

### 测量步骤

#### 1. 前端性能测量
```bash
# 使用 Lighthouse CI
npx lighthouse https://starye.org --output=json --output-path=baseline-report.json

# 使用 WebPageTest
# 访问 https://www.webpagetest.org/ 输入 URL 进行测试
```

#### 2. API 性能测量
```bash
# 使用 Apache Bench
ab -n 1000 -c 10 https://api.starye.org/api/movies

# 使用 wrk
wrk -t4 -c100 -d30s https://api.starye.org/api/movies
```

#### 3. 缓存性能测量
```bash
# 检查 Cloudflare 缓存统计
# Cloudflare Dashboard > Analytics & Logs > Caching
```

#### 4. 数据库性能测量
```sql
-- 查询慢查询日志
SELECT * FROM query_logs WHERE duration > 100 ORDER BY duration DESC LIMIT 100;

-- 分析查询计划
EXPLAIN QUERY PLAN SELECT * FROM movie ORDER BY created_at DESC LIMIT 20;
```

## 记录模板

### 前端性能基准
| 指标 | 当前值 | 目标值 | 状态 |
|------|--------|--------|------|
| FCP | ___ | < 1.8s | ⏳ 待测量 |
| LCP | ___ | < 2.5s | ⏳ 待测量 |
| TTI | ___ | < 3.8s | ⏳ 待测量 |
| CLS | ___ | < 0.1 | ⏳ 待测量 |
| FID | ___ | < 100ms | ⏳ 待测量 |
| 首屏 JS 大小 | ___ | < 200KB | ⏳ 待测量 |
| 首屏 CSS 大小 | ___ | < 50KB | ⏳ 待测量 |

### API 性能基准
| 指标 | 当前值 | 目标值 | 状态 |
|------|--------|--------|------|
| 平均响应时间 | ___ | < 200ms | ⏳ 待测量 |
| P95 响应时间 | ___ | < 500ms | ⏳ 待测量 |
| P99 响应时间 | ___ | < 1000ms | ⏳ 待测量 |
| 错误率 | ___ | < 0.1% | ⏳ 待测量 |

### 缓存性能基准
| 指标 | 当前值 | 目标值 | 状态 |
|------|--------|--------|------|
| CDN 缓存命中率 | ___ | > 95% | ⏳ 待测量 |
| KV 缓存命中率 | ___ | > 80% | ⏳ 待测量 |
| 内存缓存命中率 | ___ | > 90% | ⏳ 待测量 |

### 数据库性能基准
| 指标 | 当前值 | 目标值 | 状态 |
|------|--------|--------|------|
| 平均查询时间 | ___ | < 50ms | ⏳ 待测量 |
| 慢查询率 | ___ | < 1% | ⏳ 待测量 |
| 连接池利用率 | ___ | < 70% | ⏳ 待测量 |

## 测量计划

### 阶段 1：基准测量
- 执行所有性能测试
- 记录当前指标
- 建立基准线

### 阶段 2：优化实施
- 按照优化计划实施
- 分阶段测试效果

### 阶段 3：对比验证
- 重新测量所有指标
- 对比优化效果
- 调整优化策略

### 阶段 4：持续监控
- 定期测量性能
- 跟踪指标变化
- 及时发现问题

## 自动化测量脚本

```bash
#!/bin/bash
# scripts/benchmark.sh

echo "=== Performance Benchmark ==="
echo "Date: $(date)"
echo ""

# 前端性能测试
echo "Frontend Performance:"
npx lighthouse https://starye.org --output=json --quiet | jq '.audits'

# API 性能测试
echo "API Performance:"
ab -n 1000 -c 10 https://api.starye.org/api/movies | grep "Requests per second"

# 数据库查询测试
echo "Database Performance:"
# 运行数据库性能测试脚本

echo "=== Benchmark Complete ==="
```

## 下一步

1. 执行基准测量
2. 填充当前值到记录模板
3. 分析性能瓶颈
4. 制定优化优先级