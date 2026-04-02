# Compress 中间件引发的爬虫 JSON 解析问题 - 完整修复

## 问题描述

### 根本原因
在 `hono-api-robustness` 变更中，为 API 添加了全局 `compress()` 中间件以优化响应大小。但这导致所有爬虫脚本在调用 API 时出现 JSON 解析错误：

```
SyntaxError: Unexpected token '', "�"... is not valid JSON
```

### 影响范围
**所有使用 `x-service-token` 或 `Authorization` 调用 API 的爬虫和内部服务：**

1. **Daily Movie Crawl** - 影片爬虫
   - 批量状态查询失败
   - API 同步失败

2. **Daily Actor Crawl** - 女优爬虫
   - 获取待爬取列表失败

3. **Daily Manga Crawl** - 漫画爬虫
   - 搜索索引构建失败

4. **Monthly Data Cleanup** - 数据清理
   - 无法获取数据统计

5. **其他内部脚本**
   - `verify-data-integrity.ts`
   - `test-real-movie-sync.ts`
   - `test-r2-mapping-storage.ts`

## 技术分析

### 为什么会发生？

1. **Node.js fetch (undici) 的默认行为**
   - Node.js 的原生 `fetch` 实现基于 undici
   - 默认情况下，undici 不会自动发送 `Accept-Encoding` 头
   - 当 API 返回压缩响应时，undici 可能无法正确解压缩

2. **API compress 中间件的行为**
   - Hono 的 `compress()` 中间件会自动压缩响应
   - 压缩后的响应需要客户端正确处理 `Content-Encoding`
   - 如果客户端不发送 `Accept-Encoding`，服务器仍可能压缩响应

3. **JSON 解析失败的链路**
   ```
   API (compress) → Gzip 压缩响应
      ↓
   Node.js fetch (undici) → 未正确解压
      ↓
   response.json() → 尝试解析二进制数据
      ↓
   SyntaxError: "�"... is not valid JSON
   ```

## 解决方案

### 方案 A：修复所有客户端（已采用）

**核心思路：** 确保所有调用 API 的客户端正确声明支持压缩

#### 1. 修复 ApiClient 类（所有爬虫共用）

**文件：** `packages/crawler/src/utils/api-client.ts`

**变更：**
- 添加 `buildHeaders()` 私有方法统一构建请求头
- 为所有 fetch 调用添加 `Accept-Encoding` 和 `Accept` 头

```typescript
private buildHeaders(additionalHeaders: Record<string, string> = {}): HeadersInit {
  return {
    'Accept': 'application/json',
    'Accept-Encoding': 'gzip, deflate, br',
    'x-service-token': this.config.token,
    ...additionalHeaders,
  }
}
```

**影响的方法：**
- `sync()` - POST 同步
- `batchQueryMovieStatus()` - 批量查询影片
- `fetchPendingActors()` - 获取待爬女优
- `batchQueryActorStatus()` - 批量查询女优
- `fetchPendingPublishers()` - 获取待爬厂商
- `batchQueryPublisherStatus()` - 批量查询厂商

#### 2. 修复独立脚本（直接使用 fetch）

**文件：**
- `packages/crawler/scripts/build-search.ts` - 漫画搜索索引
- `packages/crawler/scripts/verify-data-integrity.ts` - 数据完整性验证
- `packages/crawler/scripts/test-real-movie-sync.ts` - 影片同步测试
- `packages/crawler/scripts/test-r2-mapping-storage.ts` - R2 映射存储测试

**变更：** 所有 fetch 调用添加标准头：

```typescript
const response = await fetch(url, {
  headers: {
    'Accept': 'application/json',
    'Accept-Encoding': 'gzip, deflate, br',
    'x-service-token': API_TOKEN,  // 或 'Authorization': `Bearer ${token}`
  },
})
```

#### 3. API 端优化（已在前序 commit 完成）

**文件：** `apps/api/src/index.ts`

**变更：** 为 compress 中间件添加阈值配置

```typescript
app.use('*', compress({
  threshold: 1024, // 仅压缩大于 1KB 的响应
}))
```

**目的：**
- 避免压缩小型 JSON 响应（如简单的状态查询）
- 减少压缩开销
- 提高内部服务调用性能

### 方案 B：条件性压缩（未采用，保留备选）

**思路：** 检测请求来源，为内部服务禁用压缩

```typescript
// 示例实现
app.use('*', async (c, next) => {
  const isServiceRequest = c.req.header('x-service-token') || 
                          c.req.header('Authorization')?.startsWith('Bearer')
  
  if (isServiceRequest) {
    // 跳过压缩，直接执行下一个中间件
    return next()
  }
  
  // 浏览器请求才使用压缩
  return compress()(c, next)
})
```

**优点：**
- 无需修改客户端
- 减少内部服务的压缩/解压开销

**缺点：**
- 增加中间件复杂度
- 内部服务也可能受益于压缩（大量数据传输）
- 需要维护两套响应逻辑

**未采用原因：** 方案 A 更符合 HTTP 标准，且一次性解决所有客户端问题。

## 验证方法

### 1. 本地测试

```bash
# 1. 启动 API 服务
cd apps/api
pnpm dev

# 2. 测试各个爬虫脚本
cd packages/crawler

# 漫画搜索索引
pnpm tsx scripts/build-search.ts

# 数据完整性验证
pnpm tsx scripts/verify-data-integrity.ts

# 影片同步测试
pnpm tsx scripts/test-real-movie-sync.ts
```

### 2. CI/CD 验证

- 等待 GitHub Actions 完成
- 确认以下 workflow 成功：
  - ✅ Daily Movie Crawl
  - ✅ Daily Actor Crawl
  - ✅ Daily Manga Crawl
  - ✅ Monthly Data Cleanup

### 3. 生产环境验证

- 查看 Cloudflare Workers 日志
- 确认爬虫调度任务正常执行
- 检查数据库是否有新数据写入

## 最佳实践总结

### 客户端开发规范

**所有调用压缩响应 API 的客户端必须：**

1. **明确声明支持的压缩格式**
   ```typescript
   headers: {
     'Accept-Encoding': 'gzip, deflate, br',
   }
   ```

2. **声明期望的响应格式**
   ```typescript
   headers: {
     'Accept': 'application/json',
   }
   ```

3. **使用统一的请求工具类**
   - 集中管理请求头配置
   - 避免遗漏关键头部
   - 便于全局修改和维护

### API 开发规范

**使用全局压缩中间件时：**

1. **合理设置压缩阈值**
   ```typescript
   compress({
     threshold: 1024, // 仅压缩大于 1KB 的响应
   })
   ```

2. **文档化压缩策略**
   - 告知客户端开发者 API 使用压缩
   - 提供正确的请求头示例
   - 说明压缩格式支持情况

3. **监控压缩效果**
   - 记录压缩前后大小
   - 分析压缩率
   - 识别异常情况

## 参考资料

- [MDN: Accept-Encoding](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Accept-Encoding)
- [MDN: Content-Encoding](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Encoding)
- [Hono: Compress Middleware](https://hono.dev/docs/middleware/builtin/compress)
- [Node.js Undici Documentation](https://undici.nodejs.org/)

## 相关 Commits

1. `6279876` - 修复 CI 脚本的 JSON 解析错误（crawler 和 db）
2. `de4c827` - 为 compress 中间件添加 threshold 配置
3. `[当前]` - 全面修复 ApiClient 和所有独立脚本

## 经验教训

1. **引入全局中间件需谨慎**
   - 全面评估对现有客户端的影响
   - 提前测试所有集成点
   - 准备回滚方案

2. **HTTP 标准很重要**
   - 客户端必须正确使用 Accept-Encoding
   - 不能依赖服务器的"智能判断"
   - 遵循规范可避免大量问题

3. **集成测试覆盖度**
   - E2E 测试应包含真实 HTTP 场景
   - CI/CD 应覆盖所有爬虫和脚本
   - 监控生产环境的调用情况

4. **代码审查重点**
   - 评估全局变更的影响范围
   - 检查是否有独立的 fetch 调用
   - 确保所有客户端代码一致
