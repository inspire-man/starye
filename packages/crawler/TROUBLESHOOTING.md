# 爬虫故障排查指南

## 常见问题

### 1. DNS 解析失败：`getaddrinfo ENOTFOUND .r2.cloudflarestorage.com`

#### 问题症状

```
Failed to process image https://www.dmmbus.cyou/pics/cover/c3t5_b.jpg: Error: getaddrinfo ENOTFOUND ***..r2.cloudflarestorage.com
⚠️  图片下载失败: getaddrinfo ENOTFOUND ***..r2.cloudflarestorage.com
⚠️  API 返回错误 500: ***/api/movies/sync
```

#### 问题原因

爬虫脚本无法加载 R2 配置环境变量，导致 `ImageProcessor` 使用空的 `accountId` 创建无效的 R2 endpoint：
- 正确的 endpoint: `https://27c162f54c8f59fff74224775a59937e.r2.cloudflarestorage.com`
- 错误的 endpoint: `https://.r2.cloudflarestorage.com` (注意开头的空字符)

#### 解决方案

**方案 1: 使用配置检查脚本（推荐）**

```bash
# 在项目根目录运行
pnpm --filter @starye/crawler exec tsx scripts/check-config.ts
```

这个脚本会：
- ✅ 检查所有必需的环境变量是否设置
- ✅ 显示 R2 endpoint 配置
- ✅ 提供清晰的错误信息和修复建议

**方案 2: 手动检查环境变量**

确保 `packages/crawler/.env` 文件包含以下配置：

```env
# R2 Configuration
CLOUDFLARE_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret_key
R2_BUCKET_NAME=starye-media
R2_PUBLIC_URL=https://cdn.starye.org

# API Configuration
API_URL=http://localhost:8787
CRAWLER_SECRET=your_crawler_secret

# Puppeteer
PUPPETEER_EXECUTABLE_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe
```

> 💡 提示：可以从 `apps/api/.dev.vars` 文件复制 R2 相关配置。

**方案 3: 测试图片上传功能**

```bash
# 测试 ImageProcessor 是否能正确初始化
pnpm --filter @starye/crawler exec tsx scripts/test-image-upload.ts
```

#### 预防措施

本次修复已经添加了以下改进：

1. **配置验证**：`ImageProcessor` 现在会在初始化时验证 R2 配置，如果配置无效会提供清晰的错误信息。

2. **dotenv 加载**：所有爬虫脚本现在都正确导入 `dotenv/config`，确保环境变量被加载。

3. **诊断工具**：提供 `check-config.ts` 和 `test-image-upload.ts` 脚本用于快速诊断配置问题。

### 2. 其他常见问题

#### 问题：Chrome 可执行文件未找到

**解决方案**：

在 `.env` 文件中设置正确的 Chrome 路径：

```env
# Windows
PUPPETEER_EXECUTABLE_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe

# macOS
PUPPETEER_EXECUTABLE_PATH=/Applications/Google Chrome.app/Contents/MacOS/Google Chrome

# Linux
PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
```

#### 问题：API 连接失败

**解决方案**：

1. 确保 API 服务正在运行：
   ```bash
   pnpm dev
   ```

2. 检查 API URL 配置：
   ```env
   API_URL=http://localhost:8787
   ```

3. 验证 CRAWLER_SECRET 与 API 配置一致。

## 运行爬虫

### 完整流程测试

```bash
# 爬取 3 部影片，验证完整功能
pnpm --filter @starye/crawler test:full
```

### 优化爬虫测试

```bash
# 使用优化配置运行爬虫
pnpm --filter @starye/crawler test:optimized
```

### 单个影片测试

```bash
# 测试单个影片的爬取
pnpm --filter @starye/crawler test:single https://www.javbus.com/SONE-001
```

## 配置说明

### 并发控制

```env
LIST_CONCURRENCY=1       # 列表页并发数
DETAIL_CONCURRENCY=2     # 详情页并发数
IMAGE_CONCURRENCY=3      # 图片上传并发数
API_CONCURRENCY=2        # API 调用并发数
```

### 延迟设置

```env
LIST_DELAY=8000          # 列表页延迟（毫秒）
DETAIL_DELAY=5000        # 详情页延迟（毫秒）
IMAGE_DELAY=2000         # 图片延迟（毫秒）
API_DELAY=1000           # API 延迟（毫秒）
```

### 限制设置

```env
MAX_MOVIES=100           # 最大影片数
MAX_PAGES=10             # 最大页数
USE_RANDOM_MIRROR=true   # 使用随机镜像
```

## 调试技巧

### 启用详细日志

```env
SHOW_PROGRESS=true       # 显示进度
SHOW_STATS=true          # 显示统计
STATS_INTERVAL=30000     # 统计间隔（毫秒）
```

### 使用代理

```env
PROXY_SERVER=http://proxy.example.com:8080
PROXY_USERNAME=user
PROXY_PASSWORD=pass
```

## 获取帮助

如果以上方法都无法解决问题，请：

1. 运行配置检查脚本并截图输出
2. 检查 `.env` 文件是否存在且配置正确
3. 查看爬虫日志中的完整错误信息
4. 在 GitHub Issues 中报告问题
