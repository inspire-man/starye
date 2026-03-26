# 401 认证错误排查指南

## 问题现象

爬虫在 CI 中运行时报错：
```
📡 获取待爬取女优列表（最多 150 个）...
⚠️  获取待爬取女优列表失败 401
ℹ️  没有待爬取的女优
```

## 根本原因

爬虫端口（`/api/admin/actors/pending` 等）需要通过 `x-service-token` header 认证，但认证失败。

## 排查步骤

### 1. 确认 GitHub Secrets 已配置

在 GitHub 仓库设置中检查以下 secrets：

```
Settings → Secrets and variables → Actions → Repository secrets
```

必需的 secrets：
- ✅ `API_URL`: API 服务器地址（如 `https://api.example.com`）
- ✅ `CRAWLER_SECRET`: 爬虫认证密钥（必须与 API 服务器的 `CRAWLER_SECRET` 环境变量一致）

**测试方法**：
```bash
# 在本地终端测试（替换为实际值）
curl -H "x-service-token: YOUR_CRAWLER_SECRET" \
  "https://your-api.com/api/admin/actors/pending?limit=1"

# 预期结果：HTTP 200 + JSON 响应
# 如果返回 401：密钥不匹配或 API 未配置
```

### 2. 确认 API 服务器已部署最新代码

API 服务器必须包含以下修复（commit `c968902`）：

**修改内容**：
- `apps/api/src/routes/admin/actors/index.ts`：添加 `serviceAuth` 中间件
- `apps/api/src/routes/admin/publishers/index.ts`：添加 `serviceAuth` 中间件

**验证方法**：
```bash
# 检查 API 服务器的 git commit
git log --oneline -1

# 应该显示：c968902 fix: 为 actor/publisher 爬虫端口添加 serviceAuth 认证
```

如果 API 服务器的代码版本过旧，需要：
1. 拉取最新代码：`git pull origin main`
2. 重新构建：`pnpm install && pnpm build`
3. 重启服务：根据你的部署方式重启 API 服务器

### 3. 确认 API 服务器的 CRAWLER_SECRET 环境变量

API 服务器运行时必须设置 `CRAWLER_SECRET` 环境变量：

**检查方法**（取决于部署方式）：

**Cloudflare Workers**：
```bash
# 检查 wrangler.toml 或 dashboard
wrangler secret list
```

**Docker/PM2/Systemd**：
```bash
# 检查环境变量
echo $CRAWLER_SECRET

# 或检查 .env 文件
cat .env | grep CRAWLER_SECRET
```

**必须确保**：
- GitHub Secret `CRAWLER_SECRET` = API 服务器环境变量 `CRAWLER_SECRET`

### 4. 测试新的 CI 认证检查步骤

最新的 workflow 添加了 "Test API Authentication" 步骤，会在爬虫运行前测试认证：

```yaml
- name: Test API Authentication
  env:
    API_URL: ${{ secrets.API_URL }}
    CRAWLER_SECRET: ${{ secrets.CRAWLER_SECRET }}
  run: |
    # 测试 /api/admin/actors/pending 端口
    # 如果返回 401，workflow 会立即失败并给出详细错误信息
```

**查看测试结果**：
1. 进入 GitHub Actions 页面
2. 选择最新的 "Daily Actor Crawl" workflow run
3. 展开 "Test API Authentication" 步骤
4. 查看输出的 HTTP 状态码和错误信息

### 5. 常见问题

#### 问题 A: CRAWLER_SECRET 为空
**症状**：
```
❌ ERROR: CRAWLER_SECRET is not configured in GitHub Secrets
```

**解决方法**：
在 GitHub repo settings 中添加 `CRAWLER_SECRET` secret。

#### 问题 B: API 服务器配置错误
**症状**：
```
❌ ERROR: Authentication failed (HTTP 401)
```

**可能原因**：
1. API 服务器的 `CRAWLER_SECRET` 环境变量未设置
2. API 服务器的 `CRAWLER_SECRET` 与 GitHub Secret 不一致
3. API 服务器还在运行旧代码（没有 `serviceAuth` 中间件）

**解决方法**：
```bash
# 1. 检查 API 服务器环境变量
wrangler secret list  # Cloudflare Workers
# 或
env | grep CRAWLER_SECRET  # 其他环境

# 2. 更新 CRAWLER_SECRET（如果不匹配）
wrangler secret put CRAWLER_SECRET  # Cloudflare Workers
# 或更新 .env 文件并重启服务

# 3. 确认 API 服务器代码版本
cd apps/api
git log --oneline -1
# 应该看到 c968902 或更新的 commit

# 4. 重新部署 API 服务器
pnpm build && pnpm deploy  # 根据你的部署流程
```

#### 问题 C: API 服务器代码未更新
**症状**：
- 本地 git 显示 commit `c968902` 存在
- 但 API 服务器的行为像是还在运行旧代码

**解决方法**：
1. SSH 到 API 服务器
2. 拉取最新代码：`git pull origin main`
3. 重新构建：`pnpm install && pnpm build`
4. 重启服务

### 6. 验证修复

修复后，重新触发 GitHub Actions workflow：

1. 进入 Actions 页面
2. 选择 "Daily Actor Crawl"
3. 点击 "Run workflow"
4. 设置 `max_actors: 5`（小规模测试）
5. 运行并查看日志

**预期结果**：
```
Testing API authentication...
Testing: https://your-api.com/api/admin/actors/pending?limit=1
✅ API authentication successful (HTTP 200)

Starting actor crawler...
🎬 启动女优详情爬虫
📡 获取待爬取女优列表（最多 5 个）...
✓ 获取到 5 个待爬取女优
[开始爬取...]
```

## 快速诊断命令

在本地运行以下命令测试 API 认证（替换为实际值）：

```bash
# 设置变量
export API_URL="https://your-api.com"
export CRAWLER_SECRET="your-secret-here"

# 测试女优端口
curl -v -H "x-service-token: $CRAWLER_SECRET" \
  "$API_URL/api/admin/actors/pending?limit=1"

# 测试厂商端口
curl -v -H "x-service-token: $CRAWLER_SECRET" \
  "$API_URL/api/admin/publishers/pending?limit=1"

# 预期：HTTP 200 + JSON 响应
# 如果返回 401：密钥不匹配或 API 未更新
```

## 相关 Commits

- `b2889f0`: 修复 TypeScript 类型错误
- `c968902`: 为 actor/publisher 端口添加 serviceAuth 认证（**关键修复**）

## 需要帮助？

如果以上步骤无法解决问题，请提供：
1. GitHub Actions 的完整日志（特别是 "Test API Authentication" 步骤）
2. API 服务器的当前 git commit hash：`git rev-parse HEAD`
3. API 服务器的 CRAWLER_SECRET 配置方式（Cloudflare/Docker/.env）
