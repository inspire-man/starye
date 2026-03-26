# Actor Publisher Crawler - API 测试计划

## Phase 1: API 端点测试

### 前置条件
```bash
# 启动 API server
cd apps/api
pnpm dev

# 或使用 wrangler
pnpm wrangler dev
```

### 测试环境变量
```bash
CRAWLER_SECRET=your-secret-here
DATABASE_URL=path/to/sqlite.db
```

---

## 1. 女优批量状态查询

### 测试 1.1: 批量查询女优状态
```bash
curl -X GET "http://localhost:8787/api/admin/actors/batch-status?ids=actor1,actor2,actor3" \
  -H "x-crawler-secret: your-secret"
```

**预期响应**:
```json
{
  "actor1": {
    "exists": true,
    "hasDetailsCrawled": false,
    "crawlFailureCount": 0,
    "movieCount": 10,
    "lastCrawlAttempt": null,
    "sourceUrl": "https://..."
  },
  "actor2": { "exists": false },
  "actor3": { ... }
}
```

**验证项**:
- [ ] 响应时间 < 500ms（10 个 ID）
- [ ] 不存在的 ID 返回 `exists: false`
- [ ] 超过 200 个 ID 返回 400 错误
- [ ] 无认证时返回 401

### 测试 1.2: 获取待爬取女优列表
```bash
curl -X GET "http://localhost:8787/api/admin/actors/pending?limit=150" \
  -H "x-crawler-secret: your-secret"
```

**预期响应**:
```json
{
  "actors": [
    {
      "id": "...",
      "name": "女优名",
      "sourceUrl": "https://...",
      "movieCount": 50,
      "crawlFailureCount": 0,
      "lastCrawlAttempt": null
    }
  ],
  "total": 150,
  "highPriority": 80
}
```

**验证项**:
- [ ] 按 movieCount DESC 排序
- [ ] 只返回 `hasDetailsCrawled=false` 的记录
- [ ] 只返回 `sourceUrl IS NOT NULL` 的记录
- [ ] 只返回 `crawlFailureCount < 3` 的记录
- [ ] highPriority 统计正确（movieCount >= 10）

### 测试 1.3: 同步女优详情
```bash
curl -X POST "http://localhost:8787/api/admin/actors/actor123/details" \
  -H "x-crawler-secret: your-secret" \
  -H "Content-Type: application/json" \
  -d '{
    "avatar": "https://example.com/avatar.jpg",
    "bio": "简介",
    "birthDate": "1990-01-01",
    "height": 165,
    "measurements": "B85-W60-H88",
    "nationality": "日本"
  }'
```

**预期响应**:
```json
{
  "success": true,
  "dataCompleteness": 0.85
}
```

**验证项**:
- [ ] 数据库中 `hasDetailsCrawled` 被设置为 true
- [ ] `crawlFailureCount` 被重置为 0
- [ ] `lastCrawlAttempt` 被更新
- [ ] 数据完整度计算正确（avatar 25%, bio 20%, birthDate 15%, height 15%, measurements 10%, nationality 15%）
- [ ] 缓存被清除

### 测试 1.4: 批量同步女优
```bash
curl -X POST "http://localhost:8787/api/admin/actors/batch-sync" \
  -H "x-crawler-secret: your-secret" \
  -H "Content-Type: application/json" \
  -d '{
    "actors": [
      { "name": "女优A", "sourceUrl": "https://..." },
      { "name": "女优B", "sourceUrl": "https://..." }
    ]
  }'
```

**预期响应**:
```json
{
  "success": true,
  "created": 1,
  "updated": 1,
  "total": 2
}
```

**验证项**:
- [ ] 新女优被创建（hasDetailsCrawled=false）
- [ ] 已存在女优的 sourceUrl 被更新
- [ ] 缓存被清除

---

## 2. 厂商批量状态查询

### 测试 2.1-2.4: 厂商端点
重复女优测试流程，端点为：
- `/api/admin/publishers/batch-status`
- `/api/admin/publishers/pending`
- `/api/admin/publishers/:id/details`
- `/api/admin/publishers/batch-sync`

**数据完整度权重（厂商）**:
- logo: 30%
- website: 20%
- description: 20%
- foundedYear: 15%
- country: 15%

---

## 3. 性能测试

### 测试 3.1: 批量查询性能
```bash
# 查询 100 个女优
curl -X GET "http://localhost:8787/api/admin/actors/batch-status?ids=id1,id2,...,id100" \
  -H "x-crawler-secret: your-secret" \
  -w "\nTime: %{time_total}s\n"
```

**验证项**:
- [ ] 响应时间 < 1000ms
- [ ] 日志中输出性能统计

### 测试 3.2: 批量同步性能
```bash
# 同步 50 个女优
curl -X POST "http://localhost:8787/api/admin/actors/batch-sync" \
  -H "x-crawler-secret: your-secret" \
  -H "Content-Type: application/json" \
  -d '{ "actors": [ ... 50 items ... ] }' \
  -w "\nTime: %{time_total}s\n"
```

**验证项**:
- [ ] 响应时间 < 3000ms

---

## 4. 错误处理测试

### 测试 4.1: 无效参数
```bash
# 空 IDs
curl -X GET "http://localhost:8787/api/admin/actors/batch-status?ids=" \
  -H "x-crawler-secret: your-secret"

# 预期: 400 Bad Request
```

### 测试 4.2: 不存在的资源
```bash
curl -X POST "http://localhost:8787/api/admin/actors/non-existent-id/details" \
  -H "x-crawler-secret: your-secret" \
  -H "Content-Type: application/json" \
  -d '{ "avatar": "..." }'

# 预期: 404 Not Found
```

### 测试 4.3: 认证失败
```bash
curl -X GET "http://localhost:8787/api/admin/actors/pending"

# 预期: 401 Unauthorized
```

---

## 测试清单总结

- [ ] 1.14: batch-status 查询 10 个 ID，响应时间 <500ms
- [ ] 1.15: pending 接口返回按优先级排序的列表
- [ ] 1.16: details 端口更新成功并返回完整度
- [ ] 2.11: 所有厂商端口功能正常
- [ ] 3.7: batch-sync 正确创建/更新记录

## 自动化测试

可以将上述测试转换为自动化测试脚本：

```bash
# test/api/actor-publisher-crawler.test.sh
#!/bin/bash

API_URL="http://localhost:8787"
SECRET="test-secret"

# ... 测试脚本
```

或集成到现有的 `test/e2e/flow.test.ts` 中。
