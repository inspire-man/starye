# API 部署说明

## 必需的环境变量设置

在部署 Worker 之前，必须设置以下密钥：

### 1. CRAWLER_SECRET（必需）

```bash
# 使用 wrangler 设置密钥
cd apps/api
wrangler secret put CRAWLER_SECRET
# 然后输入密钥值，必须与 .dev.vars 中的值一致
# 当前值: crawler_sk_7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a
```

### 2. BETTER_AUTH_SECRET（必需）

```bash
wrangler secret put BETTER_AUTH_SECRET
# 输入: fc3a4b5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b
```

### 3. GitHub OAuth（如果使用 GitHub 登录）

```bash
wrangler secret put GITHUB_CLIENT_ID
wrangler secret put GITHUB_CLIENT_SECRET
```

## 验证部署

```bash
# 查看已设置的密钥
wrangler secret list

# 测试 API
curl https://api.mokelao.top/
curl -X POST https://api.mokelao.top/api/admin/sync \
  -H "x-service-token: YOUR_CRAWLER_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"type":"manga","data":{"title":"Test","slug":"test","chapters":[]}}'
```

## 查看日志

```bash
# 实时查看日志
wrangler tail

# 查看格式化日志
wrangler tail --format pretty
```
