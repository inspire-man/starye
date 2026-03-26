# CI 修复验证步骤

## 已修复的问题

### 问题 1: TypeScript 类型错误 ✅
- ❌ `BrowserConfig` 类型未定义
- ❌ `BrowserManager` 导入路径错误
- ❌ `FailedTaskRecorder.record()` 参数类型不匹配
- ✅ **修复**: commit `b2889f0`

### 问题 2: API 认证 401 错误 ✅
- ❌ 爬虫调用 API 端口返回 401
- ❌ `requireResource('movie')` 中间件不支持 service token
- ✅ **修复**: commit `4814f21`

## 关键修复内容

### `requireResource` 中间件改进 (commit 4814f21)

```typescript
export function requireResource(resource: Resource) {
  return async (c, next) => {
    // 1. 首先检查 service token（爬虫）
    const token = c.req.header('x-service-token')
    const secret = c.env.CRAWLER_SECRET
    
    if (token && secret && token === secret) {
      // Service token 通过 - 设置虚拟 admin 用户
      c.set('user', { role: 'super_admin', ... })
      return await next()
    }
    
    // 2. 然后检查 session 用户（dashboard）
    const user = c.get('user')
    if (!user || !hasPermission(user, resource)) {
      throw 401/403
    }
    
    await next()
  }
}
```

**为什么漫画爬虫能工作？**
- 漫画爬虫端口在 `admin/main/index.ts` 中使用 `serviceAuth` 中间件
- 女优/厂商端口在独立路由中使用 `requireResource('movie')` 全局中间件
- `requireResource` 原本不支持 service token，现在已修复

## 本地验证步骤

### 1. 启动 API 服务器

```bash
cd apps/api
pnpm dev
```

确保 `.env` 文件包含：
```env
CRAWLER_SECRET=your-secret-here
```

### 2. 运行认证测试

```bash
cd packages/crawler

# 设置环境变量
export API_URL="http://localhost:3000"
export CRAWLER_SECRET="your-secret-here"

# 运行测试脚本
pnpm test:auth
```

**预期输出**：
```
🧪 API 认证测试
📡 API URL: http://localhost:3000
🔑 Token: your-sec...

📍 测试: API 健康检查
   GET http://localhost:3000/api/health
   ✅ 成功 (HTTP 200)

📍 测试: 女优待爬取列表
   GET http://localhost:3000/api/admin/actors/pending?limit=1
   ✅ 成功 (HTTP 200)

📍 测试: 厂商待爬取列表
   GET http://localhost:3000/api/admin/publishers/pending?limit=1
   ✅ 成功 (HTTP 200)

[...]

============================================================
📊 测试结果汇总
============================================================
总数: 5
成功: 5 ✅
失败: 0 ❌
成功率: 100%
============================================================

✅ 所有端口认证测试通过！
```

### 3. 运行女优爬虫测试

```bash
# 设置环境变量
export MAX_ACTORS=5
export ACTOR_CONCURRENCY=1
export ACTOR_DELAY=5000

# 运行爬虫
pnpm crawl:actor
```

**预期输出**：
```
🎬 启动女优详情爬虫
⚙️  配置: maxActors=5, concurrency=1, delay=5000ms
🚀 使用本地 Chrome: ...
✅ 浏览器初始化完成
📡 获取待爬取女优列表（最多 5 个）...
✓ 获取到 5 个待爬取女优                    ← 关键：不再是 401
============================================================
📊 开始处理女优详情页...
============================================================
[开始爬取...]
```

## CI 验证步骤

### 1. 确认 API 服务器已部署

```bash
# SSH 到 API 服务器
ssh user@your-api-server

# 确认代码版本
cd /path/to/starye
git pull origin main
git log --oneline -1
# 应该显示: 4814f21 fix: requireResource 中间件支持 service token 认证

# 重新部署
pnpm install
pnpm build
# 重启服务...
```

### 2. 确认 GitHub Secrets 已配置

进入 GitHub repo settings:
```
Settings → Secrets and variables → Actions
```

必需的 secrets：
- ✅ `API_URL`: API 服务器地址
- ✅ `CRAWLER_SECRET`: 必须与 API 服务器的 `CRAWLER_SECRET` 环境变量一致

### 3. 手动触发 workflow 测试

1. 进入 GitHub Actions 页面
2. 选择 "Daily Actor Crawl"
3. 点击 "Run workflow"
4. 设置参数：
   - `max_actors`: 5
   - `recovery_mode`: false
5. 运行并观察日志

**关键日志检查点**：

```
✅ Step: Test API Authentication
   Testing: https://your-api.com/api/admin/actors/pending?limit=1
   ✅ API authentication successful (HTTP 200)    ← 必须看到这个

✅ Step: Run Actor Crawler
   📡 获取待爬取女优列表（最多 5 个）...
   ✓ 获取到 5 个待爬取女优                      ← 不再是 401
   [开始爬取...]
```

## 修复验证清单

- [x] TypeScript 类型错误修复（commit b2889f0）
- [x] `requireResource` 支持 service token（commit 4814f21）
- [x] 创建 API 认证测试脚本
- [x] 推送到远程仓库
- [ ] 本地运行 `pnpm test:auth` 验证认证通过
- [ ] 本地运行 `pnpm crawl:actor` 验证爬虫能获取待爬取列表
- [ ] 确认 API 服务器已部署最新代码
- [ ] 手动触发 CI workflow 验证通过

## 如果仍然 401

如果推送后 CI 仍然报 401，检查：

1. **API 服务器代码版本**：
   ```bash
   git log --oneline -1
   # 必须是 4814f21 或更新
   ```

2. **API 服务器的 CRAWLER_SECRET**：
   ```bash
   # Cloudflare Workers
   wrangler secret list | grep CRAWLER_SECRET
   
   # 其他环境
   echo $CRAWLER_SECRET
   ```

3. **GitHub Secret 值**：
   - 进入 repo settings 确认 `CRAWLER_SECRET` 值
   - 必须与 API 服务器的环境变量完全一致

4. **运行本地测试验证逻辑**：
   ```bash
   cd packages/crawler
   export API_URL="https://your-api.com"
   export CRAWLER_SECRET="your-secret-here"
   pnpm test:auth
   ```

## 已推送的 Commits

```
535557b feat: 添加 API 认证测试脚本
4814f21 fix: requireResource 中间件支持 service token 认证
ab968aa ci(ci): 测试脚本
734ec14 feat: 添加 CI 认证测试步骤和 401 错误排查指南
c968902 fix: 为 actor/publisher 爬虫端口添加 serviceAuth 认证
b2889f0 fix: 修复 actor/publisher crawler TypeScript 类型错误
```

现在 CI 会：
1. 构建代码 ✅
2. 运行类型检查 ✅
3. 测试 API 认证 → **新增**
4. 运行爬虫 → **应该能通过认证**
