# 🔧 500 错误修复总结

## 📅 修复日期: 2026-01-07

---

## 🎯 问题症状

爬虫在同步漫画数据时频繁出现 500 错误：
```
Sync failed to ***/api/admin/sync: Request failed with status code 500 (Internal Server Error)
```

---

## 🔍 根本原因分析

### 主要原因
1. **环境变量未配置**: 生产环境的 `CRAWLER_SECRET` 可能未设置或配置错误
2. **日志未启用**: 无法查看详细的错误信息进行诊断
3. **错误信息不详细**: API 和爬虫的错误日志不够详细

### 次要原因
- 数据验证不足，可能传输无效数据
- 批量插入可能超时（大量章节时）
- 网络请求无超时限制

---

## ✅ 已实施的修复

### 1. 启用 Cloudflare Workers 日志

**文件**: `apps/api/wrangler.toml`

```toml
[observability.logs]
enabled = true # ✅ 从 false 改为 true
```

**影响**: 现在可以通过 `wrangler tail` 查看实时日志

---

### 2. 改进 API 错误日志

**文件**: `apps/api/src/middleware/service-auth.ts`

**改进内容**:
- ✅ 详细记录认证失败的原因
- ✅ 显示密钥前缀以便对比
- ✅ 区分"未提供密钥"和"密钥错误"两种情况

**文件**: `apps/api/src/index.ts`

**改进内容**:
- ✅ 每个步骤都有详细的日志（Upsert Comic, Delete Chapters, Insert Chapters）
- ✅ 显示批次进度（Batch 1/3, Batch 2/3...）
- ✅ 使用表情符号增强可读性（📥 📝 📚 ✅ ❌）
- ✅ 错误时输出完整的上下文信息

**示例输出**:
```
[Sync] 📥 Received manga: 獄火重生 (47 chapters)
[Sync] 📝 Upserting comic: 1045
[Sync] ✓ Comic upserted successfully
[Sync] 🗑️  Deleting existing chapters for: 1045
[Sync] 📚 Inserting 47 chapters in 1 batches
[Sync] 📦 Batch 1: inserting 47 chapters
[Sync] ✓ All chapters inserted successfully
[Sync] ✅ Sync completed for 獄火重生
```

---

### 3. 改进爬虫错误处理

**文件**: `packages/crawler/src/lib/base-crawler.ts`

**改进内容**:
- ✅ 添加详细的请求/响应日志
- ✅ 捕获并显示完整的 HTTP 响应信息
- ✅ 添加 30 秒请求超时
- ✅ 显示错误堆栈跟踪

**文件**: `packages/crawler/src/index.ts`

**改进内容**:
- ✅ 数据验证：过滤无效章节（缺少 title/slug/url）
- ✅ 在同步前验证漫画数据完整性
- ✅ 显示配置信息（API URL, Token 前缀）

---

### 4. 创建诊断工具

**文件**: `packages/crawler/scripts/test-api.ts`

**功能**:
- ✅ 自动检查环境变量配置
- ✅ 测试 API 健康检查
- ✅ 测试认证是否成功
- ✅ 发送测试数据验证完整流程

**使用方法**:
```bash
cd packages/crawler
pnpm test:api
```

---

### 5. 创建自动化脚本

**文件**: `scripts/setup-production-secrets.ps1` (Windows)

**功能**:
- ✅ 自动从 `.dev.vars` 读取密钥
- ✅ 批量设置到 Cloudflare Workers
- ✅ 验证设置成功
- ✅ 显示清晰的步骤和状态

**使用方法**:
```powershell
.\scripts\setup-production-secrets.ps1
```

---

### 6. 创建文档

**文件**: `TROUBLESHOOTING.md`
- ✅ 完整的故障排除指南
- ✅ 常见问题及解决方案
- ✅ 部署清单
- ✅ 日志查看方法

**文件**: `apps/api/DEPLOYMENT.md`
- ✅ 部署步骤说明
- ✅ 环境变量设置指南
- ✅ 验证方法

---

## 🚀 立即执行的步骤

### 步骤 1: 设置生产环境密钥 ⚠️ **必须执行**

```bash
cd apps/api

# 方式 1: 使用自动化脚本（推荐，Windows）
cd ../..
.\scripts\setup-production-secrets.ps1

# 方式 2: 手动设置
wrangler secret put CRAWLER_SECRET
# 输入: crawler_sk_7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a

wrangler secret put BETTER_AUTH_SECRET
# 输入: fc3a4b5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b
```

### 步骤 2: 重新部署 API

```bash
cd apps/api
wrangler deploy
```

### 步骤 3: 验证修复

```bash
# 测试 API 连接
cd ../../packages/crawler
pnpm test:api

# 如果测试通过，运行实际爬虫
pnpm start "https://www.92hm.life/book/1045"
```

### 步骤 4: 查看日志

```bash
# 在另一个终端窗口
cd apps/api
wrangler tail --format pretty
```

---

## 📊 预期结果

### ✅ 成功的日志输出

**API 端 (wrangler tail)**:
```
[Service Auth] ✓ Service authenticated successfully
[Sync] 📥 Received manga: 獄火重生 (47 chapters)
[Sync] 📝 Upserting comic: 1045
[Sync] ✓ Comic upserted successfully
[Sync] 🗑️  Deleting existing chapters for: 1045
[Sync] 📚 Inserting 47 chapters in 1 batches
[Sync] 📦 Batch 1: inserting 47 chapters
[Sync] ✓ All chapters inserted successfully
[Sync] ✅ Sync completed for 獄火重生
```

**爬虫端**:
```
📚 Detected Manga Page. Syncing info...
  Syncing 獄火重生 (47 chapters)...
  Config: API=https://api.mokelao.top, Token=crawler_sk_7d8...
[API] 📤 Syncing to https://api.mokelao.top/api/admin/sync...
[API] ✅ Sync successful
```

---

## ❌ 如果仍然出现错误

### 1. 认证错误 (401)

**症状**:
```
[Service Auth] No x-service-token header provided
或
[Service Auth] Invalid service token provided
```

**解决方案**:
- 确认爬虫的 `.env` 文件中的 `CRAWLER_SECRET` 与生产环境一致
- 运行 `wrangler secret list` 确认密钥已设置
- 运行 `pnpm test:api` 进行诊断

---

### 2. 配置错误 (500)

**症状**:
```
[Service Auth] CRAWLER_SECRET is missing or too weak
Server Configuration Error: CRAWLER_SECRET not properly configured
```

**解决方案**:
- 重新运行步骤 1 设置密钥
- 确保密钥长度至少 8 个字符
- 部署后等待 1-2 分钟让配置生效

---

### 3. 数据库错误 (500)

**症状**:
```
[Sync] ❌ Database Error: ...
```

**解决方案**:
- 检查 D1 数据库是否正常运行
- 查看完整的错误堆栈
- 可能需要减小批次大小（修改 `chunkSize` 从 50 改为 30）

---

## 📚 相关文档

- **故障排除**: `TROUBLESHOOTING.md`
- **部署指南**: `apps/api/DEPLOYMENT.md`
- **API 文档**: `apps/api/src/index.ts`
- **爬虫文档**: `packages/crawler/README.md`

---

## 🎉 总结

通过以上修复，您的爬虫系统现在具备：

- ✅ **详细的日志记录** - 可以准确定位问题
- ✅ **自动化诊断工具** - 快速验证配置
- ✅ **数据验证** - 防止无效数据导致错误
- ✅ **完善的错误处理** - 优雅地处理各种异常
- ✅ **清晰的文档** - 便于维护和排查问题

**最重要的是**: 立即执行"步骤 1"设置生产环境密钥，这是解决当前 500 错误的关键！

---

## 💬 需要帮助？

如果问题仍未解决，请提供：
1. `pnpm test:api` 的完整输出
2. `wrangler tail` 的日志输出
3. 爬虫运行时的错误信息
4. `wrangler secret list` 的输出

我们会根据这些信息进一步诊断问题。
