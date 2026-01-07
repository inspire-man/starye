# 🔧 爬虫 500 错误故障排除指南

## 问题症状

```
Sync failed to ***/api/admin/sync: Request failed with status code 500 (Internal Server Error): POST ***/api/admin/sync
```

---

## 🎯 快速诊断流程

### 1️⃣ 运行 API 连接测试

```bash
cd packages/crawler
pnpm test:api
```

这个脚本会自动检查：
- ✅ 环境变量是否正确配置
- ✅ API 服务是否可访问
- ✅ 认证是否成功
- ✅ 数据同步是否正常

---

## 🔍 常见原因及解决方案

### ❌ 原因 1: CRAWLER_SECRET 未在生产环境设置

**症状:** 日志显示 "Server Configuration Error"

**检查方法:**
```bash
cd apps/api
wrangler secret list
```

**解决方案:**
```bash
# 设置 CRAWLER_SECRET（必须与 .dev.vars 中的值一致）
wrangler secret put CRAWLER_SECRET
# 输入: crawler_sk_7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a

# 重新部署
wrangler deploy
```

---

### ❌ 原因 2: 本地和生产环境的密钥不一致

**症状:** 本地测试正常，生产环境 500 错误

**检查方法:**
```bash
# 检查本地配置
cat packages/crawler/.env
cat apps/api/.dev.vars

# 检查生产环境配置
cd apps/api
wrangler secret list
```

**解决方案:**
确保以下值在所有环境中一致：
- `packages/crawler/.env` 中的 `CRAWLER_SECRET`
- `apps/api/.dev.vars` 中的 `CRAWLER_SECRET`
- Cloudflare Workers 中的 `CRAWLER_SECRET`

---

### ❌ 原因 3: 数据库操作超时

**症状:** 大量章节（>50）时失败

**检查方法:**
查看 Cloudflare Workers 日志：
```bash
cd apps/api
wrangler tail --format pretty
```

**解决方案:**
已在代码中实现：
- ✅ 分批插入（每批 50 条）
- ✅ 添加详细日志
- ✅ 30 秒请求超时

如果仍然超时，可以调整批次大小：
```typescript
// apps/api/src/index.ts 第181行
const chunkSize = 30 // 从 50 改为 30
```

---

### ❌ 原因 4: 日志未启用

**症状:** 无法在 Cloudflare Dashboard 看到详细日志

**检查方法:**
```bash
# 查看 wrangler.toml
cat apps/api/wrangler.toml
```

**解决方案:**
确保 `wrangler.toml` 中启用了日志：
```toml
[observability.logs]
enabled = true  # ✅ 必须为 true
```

重新部署后查看日志：
```bash
wrangler tail --format pretty
```

---

### ❌ 原因 5: 网络连接问题

**症状:** 间歇性失败，部分成功部分失败

**检查方法:**
```bash
# 测试网络连接
curl -v https://api.mokelao.top/

# 测试认证
curl -X POST https://api.mokelao.top/api/admin/sync \
  -H "x-service-token: YOUR_CRAWLER_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"type":"manga","data":{"title":"Test","slug":"test","chapters":[]}}'
```

**解决方案:**
- 检查网络连接
- 检查防火墙设置
- 增加请求超时时间（已设置为 30 秒）

---

## 📊 查看详细日志

### 1. Cloudflare Workers 日志

```bash
cd apps/api

# 实时查看日志
wrangler tail

# 格式化显示
wrangler tail --format pretty

# 过滤特定请求
wrangler tail --format pretty | grep "Sync"
```

### 2. 爬虫日志

爬虫现在会输出详细的调试信息：
```
[API] 📤 Syncing to https://api.mokelao.top/api/admin/sync...
[API] ✅ Sync successful
```

或者错误信息：
```
[API] ❌ Sync failed to https://api.mokelao.top/api/admin/sync:
  status: 500
  statusMessage: Internal Server Error
  body: { error: "...", details: "..." }
```

---

## ✅ 验证修复

### 1. 测试本地 API

```bash
# 启动本地 API
cd apps/api
pnpm dev

# 在另一个终端测试
cd packages/crawler
pnpm test:api
```

### 2. 测试生产 API

```bash
# 修改 .env 中的 API_URL
# API_URL=https://api.mokelao.top

cd packages/crawler
pnpm test:api
```

### 3. 运行完整爬虫测试

```bash
cd packages/crawler
pnpm start "https://www.92hm.life/book/1045"
```

---

## 🚀 部署清单

在部署到生产环境之前，确保：

- [ ] ✅ 日志已启用（`wrangler.toml` 中 `enabled = true`）
- [ ] ✅ `CRAWLER_SECRET` 已在 Cloudflare Workers 中设置
- [ ] ✅ `BETTER_AUTH_SECRET` 已设置
- [ ] ✅ 本地测试通过（`pnpm test:api`）
- [ ] ✅ 代码已部署（`wrangler deploy`）
- [ ] ✅ 生产环境测试通过

```bash
# 完整部署流程
cd apps/api

# 1. 设置密钥（如果未设置）
wrangler secret put CRAWLER_SECRET
wrangler secret put BETTER_AUTH_SECRET

# 2. 部署
wrangler deploy

# 3. 验证
wrangler tail --format pretty

# 4. 测试爬虫
cd ../../packages/crawler
pnpm test:api
```

---

## 📞 获取帮助

如果问题仍未解决，请收集以下信息：

1. **爬虫日志** - 完整的错误输出
2. **API 日志** - `wrangler tail` 的输出
3. **环境信息** - `.env` 和 `.dev.vars` 的配置（隐藏敏感信息）
4. **测试结果** - `pnpm test:api` 的输出

---

## 📝 改进日志

**2026-01-07**
- ✅ 启用了 Cloudflare Workers 日志
- ✅ 改进了 API 错误日志（详细的步骤和状态）
- ✅ 改进了爬虫错误处理（显示完整的响应信息）
- ✅ 添加了数据验证（过滤无效章节）
- ✅ 创建了 API 连接测试脚本
- ✅ 添加了 30 秒请求超时

