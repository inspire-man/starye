# 爬虫问题修复

## 问题 1：漫画爬虫内存溢出

### 症状
```
FATAL ERROR: Ineffective mark-compacts near heap limit 
Allocation failed - JavaScript heap out of memory
Exit status 134
```

### 根本原因
- 处理大量图片（267张）时，Node.js 默认堆内存不足（~4GB）
- GitHub Actions 运行时没有设置内存限制

### 解决方案
在 `.github/workflows/daily-manga-crawl.yml` 中添加 Node.js 内存限制：

```bash
NODE_OPTIONS="--max-old-space-size=6144" pnpm --filter @starye/crawler start "$TARGET"
```

- 设置最大堆内存为 6GB（6144MB）
- GitHub Actions 的 `ubuntu-latest` 有足够的内存（7GB）
- 留出 1GB 给系统和其他进程

### 验证
- 重新运行 Daily Manga Crawl workflow
- 观察是否还有内存溢出错误

---

## 问题 2：电影爬虫图片 403 错误

### 症状
```
⚠️  图片下载失败: Request failed with status code 403 (Forbidden): 
GET https://www.javbus.com/pics/cover/c3ou_b.jpg
```

### 根本原因
- javbus.com 有防盗链保护（检查 Referer header）
- 之前的 Referer 设置不正确：`new URL(imageUrl).origin`
  - 只发送 `https://www.javbus.com`
  - 应该发送完整的页面 URL 或 origin + `/`

### 解决方案

#### 1. 改进 Referer 设置
修改 `packages/crawler/src/lib/image-processor.ts`：

```typescript
// 优先使用传入的 refererUrl，否则使用 origin + '/'
const parsedUrl = new URL(imageUrl)
const defaultReferer = `${parsedUrl.origin}/`

const imageBuffer = await got(imageUrl, {
  headers: {
    'User-Agent': 'Mozilla/5.0 ...',
    'Referer': refererUrl || defaultReferer,  // 修复：添加尾部斜杠
    'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
  },
  // ...
})
```

#### 2. 支持传入 Referer URL
函数签名修改：

```typescript
async process(
  imageUrl: string, 
  keyPrefix: string, 
  filename: string, 
  refererUrl?: string  // 新增：可选的 referer URL
): Promise<ProcessedImage[]>
```

#### 3. 使用示例

在爬虫中调用时，传入影片详情页 URL：

```typescript
// 在 optimized-crawler.ts 或 JavBusCrawler 中
const results = await this.imageProcessor.process(
  movieInfo.coverImage!,
  keyPrefix,
  filename,
  movieDetailUrl  // 传入详情页 URL 作为 Referer
)
```

### 为什么这样修复有效？

1. **添加尾部斜杠**：`https://www.javbus.com/` vs `https://www.javbus.com`
   - 许多网站的防盗链检查需要完整的 origin URL（包含尾部斜杠）
   - 避免被识别为直接访问图片

2. **添加更多浏览器 headers**：
   - `Accept`: 告诉服务器我们接受图片格式
   - `Accept-Language`: 模拟真实浏览器

3. **支持传入自定义 Referer**：
   - 某些网站要求 Referer 是具体的内容页 URL
   - 允许爬虫传入详情页 URL

### 验证
1. 重新运行 Daily Movie Crawl workflow
2. 检查是否还有 403 错误
3. 如果仍有问题，可以在爬虫中传入详情页 URL

---

## 其他优化

### 1. 增加重试策略
```typescript
retry: {
  limit: 5,
  methods: ['GET'], // 只对 GET 请求重试
}
```

### 2. 并发控制
GitHub Actions workflow 中已经有合理的并发配置：
- 漫画爬虫：`manga=2, chapter=2, imageBatch=10` (总并发 40)
- 电影爬虫：`LIST=1, DETAIL=2, IMAGE=2, API=2`

### 3. 延迟控制
避免请求过快被限流：
- 漫画爬虫：`baseDelay=8000ms` (8秒)
- 电影爬虫：`listDelay=10000ms, detailDelay=6000ms, imageDelay=3000ms`

---

## 部署清单

- [x] 修改 `.github/workflows/daily-manga-crawl.yml`
- [x] 修改 `packages/crawler/src/lib/image-processor.ts`
- [ ] 测试漫画爬虫（等待下次自动运行或手动触发）
- [ ] 测试电影爬虫（等待下次自动运行或手动触发）
- [ ] 如果电影爬虫仍有 403，考虑在 JavBusCrawler 中传入详情页 URL

---

## 监控建议

### GitHub Actions
1. 查看 workflow 运行日志
2. 检查内存使用情况
3. 统计 403 错误数量

### 如果问题持续
1. **漫画爬虫内存**：
   - 减少 `imageBatch` 大小（10 → 5）
   - 增加内存限制（6144 → 8192）

2. **电影爬虫 403**：
   - 增加延迟（imageDelay: 3000 → 5000）
   - 在 JavBusCrawler 中传入详情页 URL 作为 Referer
   - 考虑使用代理

---

## 参考

- GitHub Actions Runners: 7 GB RAM
- Node.js `--max-old-space-size`: 设置最大堆内存（MB）
- HTTP Referer: 用于防盗链保护
- got retry 文档: https://github.com/sindresorhus/got#retry
