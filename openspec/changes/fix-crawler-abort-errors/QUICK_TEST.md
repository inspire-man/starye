# 快速测试指南

## 🧪 本地测试（推荐）

### 1. 测试漫画爬虫（小批量）

```powershell
# 设置环境变量
$env:CRAWLER_MAX_MANGAS = "3"
$env:CRAWLER_MAX_CHAPTERS_NEW = "2"
$env:CRAWLER_TIMEOUT_MINUTES = "10"
$env:CLOUDFLARE_ACCOUNT_ID = "your-account-id"
$env:R2_ACCESS_KEY_ID = "your-access-key"
$env:R2_SECRET_ACCESS_KEY = "your-secret-key"
$env:R2_BUCKET_NAME = "your-bucket"
$env:R2_PUBLIC_URL = "https://your-r2-domain"
$env:CRAWLER_SECRET = "your-crawler-secret"
$env:API_URL = "https://starye.org"

# 运行爬虫
pnpm --filter @starye/crawler start "https://www.92hm.life/booklist?end=0"
```

**预期输出**：
- 🔧 爬虫配置日志（显示反检测配置）
- [CrawlerSession] 🔧 Initializing crawler session...
- [CrawlerSession] ✅ Session initialized with X cookies
- 📊 成功率统计（应显示 > 90%）
- ❌ Failed Tasks Summary（如果有失败）

### 2. 查看日志关键点

关注以下日志：

```
[CrawlerSession] 🔧 Initializing crawler session...
[CrawlerSession] ✅ Session initialized with 2 cookies
[HeaderRotator] 🔄 Rotated to header template: Chrome-MacOS
[ErrorHandler] ⚠️  ERR_ABORTED detected for ... (attempt 1)
[ErrorHandler] 🔄 Will retry with increased delay (16000ms) and rotated headers
[DelayStrategy] ⚠️  Increasing delay multiplier to 1.50
📊 成功率统计:
  总请求: 20
  成功: 18
  失败: 2
  成功率: 90.0%
```

## 🚀 GitHub Actions 测试

### 1. 手动触发 Manga Crawl（小批量）

```bash
# 方式 1: 通过 GitHub UI
# 1. 打开 https://github.com/your-repo/starye/actions/workflows/daily-manga-crawl.yml
# 2. 点击 "Run workflow"
# 3. 不填写任何参数（使用默认 URL）

# 方式 2: 通过 gh CLI
gh workflow run daily-manga-crawl.yml
```

### 2. 监控 Actions 日志

关键指标：
- ✅ 无 `ERR_ABORTED` 错误（或 < 5%）
- ✅ 成功率 > 90%
- ✅ 完成 60 个漫画处理（约 5 小时）
- ✅ 有 `[CrawlerSession]` 和 `[ErrorHandler]` 日志

### 3. 查看失败任务摘要

在日志末尾查找：

```
❌ Failed Tasks Summary (X total):

  ERR_ABORTED (2):
    - https://www.92hm.life/book/1155
    - https://www.92hm.life/book/1154

  TIMEOUT (1):
    - https://www.92hm.life/book/1153
```

## 📊 成功标准

### 必须满足
- ✅ ERR_ABORTED 错误率 < 10%（首次测试）
- ✅ 整体成功率 > 85%（首次测试）
- ✅ 有会话管理日志（证明功能启用）
- ✅ 有错误重试日志（证明恢复机制工作）

### 理想目标
- ✅ ERR_ABORTED 错误率 < 5%
- ✅ 整体成功率 > 95%
- ✅ 处理完成 60 个漫画（充分利用时间）

## 🔧 调试建议

### 如果成功率 < 80%

```powershell
# 增加延迟
$env:CRAWLER_BASE_DELAY = "12000"  # 12 秒基础延迟

# 减少并发
$env:CRAWLER_MANGA_CONCURRENCY = "1"
$env:CRAWLER_CHAPTER_CONCURRENCY = "1"
```

### 如果出现大量 CONNECTION_REFUSED

```
# 可能 IP 被封禁，等待 30 分钟后重试
```

### 如果日志中没有 [CrawlerSession]

```powershell
# 检查配置是否正确加载
# 查看日志开头的 "🔧 爬虫配置加载完成" 部分
# 应该显示: session=启用
```

## 📈 性能对比

### 优化前
- 每次处理：15 个漫画
- ERR_ABORTED 错误率：~30%
- 成功率：~70%
- 时间利用：42 分钟（仅处理 8 个漫画）

### 优化后（预期）
- 每次处理：60 个漫画
- ERR_ABORTED 错误率：< 5%
- 成功率：> 95%
- 时间利用：~300 分钟（处理 60 个漫画）

## 🎯 下一步

1. **首次测试**：运行小批量本地测试（3 个漫画）
2. **验证功能**：确认反检测逻辑工作正常
3. **CI 测试**：手动触发 GitHub Actions
4. **观察 3 天**：监控成功率和错误分布
5. **微调参数**：根据实际表现调整配置
6. **逐步放量**：60 → 80 → 100（如果稳定）

## ⚠️  注意事项

- 首次测试建议使用小批量（3-5 个漫画）
- 观察日志中的反检测功能是否正常工作
- 如果成功率低于 80%，立即停止并检查
- CI 环境的网络可能比本地更容易被检测，正常现象
- 影片爬虫暂时保持原配置（稳定优先）
