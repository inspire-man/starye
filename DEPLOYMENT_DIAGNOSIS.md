# 部署诊断报告

## 问题状态

### ✅ Dashboard 部署 - 已修复
- **问题**：静态资源 404（`/assets/...` 路径错误）
- **修复**：改用 `base: '/dashboard/'` 路径，与 Comic/Movie 一致
- **验证**：
  ```
  ✓ https://starye.org/dashboard/ - 200 OK
  ✓ https://starye.org/dashboard/assets/index-Dkn88s1C.js - 200 OK
  ```

### ⚠️ Movie/Comic 数据问题 - 需要诊断

**症状**：
- 用户报告：显示的是开发环境数据，而不是生产环境数据
- API 测试：生产环境返回空数据（total: 0）

**可能原因**：

#### 原因 1：生产数据库为空（最可能）

生产环境 D1 数据库 `starye-db` (ID: `72b60b6c-806f-4795-a846-9b0d157b8225`) 可能从未导入过数据。

**验证方法**：
```bash
# 检查生产数据库
wrangler d1 execute starye-db --command "SELECT COUNT(*) as count FROM movies"
wrangler d1 execute starye-db --command "SELECT COUNT(*) as count FROM comics"
```

**解决方案**：
如果数据库为空，需要导入数据：

```bash
# 方法 1：从本地数据库导出并导入生产环境
cd apps/api
wrangler d1 export DB --output=backup.sql
wrangler d1 execute starye-db --file=backup.sql --remote

# 方法 2：使用爬虫重新抓取数据（如果有爬虫配置）
# 需要设置 CRAWLER_SECRET
curl -X POST https://starye.org/api/admin/crawler/movies -H "x-service-token: YOUR_TOKEN"
```

#### 原因 2：前端缓存问题

浏览器可能还在使用旧的缓存数据。

**解决方案**：
1. 使用浏览器无痕模式访问
2. 清除浏览器缓存（Ctrl+Shift+Delete）
3. 强制刷新页面（Ctrl+F5）

#### 原因 3：API 连接到错误的数据库

API Worker 可能连接到开发环境数据库。

**验证方法**：
检查 Cloudflare Dashboard：
1. 访问 https://dash.cloudflare.com
2. Workers & Pages → starye-api → Settings → Bindings
3. 确认 `DB` 绑定指向 `starye-db` (生产环境)

**解决方案**：
如果绑定错误，需要重新部署 API：
```bash
cd apps/api
wrangler deploy
```

## 诊断步骤

### 步骤 1：检查生产数据库

```bash
# 检查 Movies 表
wrangler d1 execute starye-db --command "SELECT COUNT(*) as total FROM movies" --remote

# 检查 Comics 表
wrangler d1 execute starye-db --command "SELECT COUNT(*) as total FROM comics" --remote

# 如果有数据，查看示例
wrangler d1 execute starye-db --command "SELECT title, slug FROM movies LIMIT 5" --remote
wrangler d1 execute starye-db --command "SELECT title, slug FROM comics LIMIT 5" --remote
```

**预期结果**：
- 如果返回 `total: 0`，说明数据库为空 → 需要导入数据
- 如果返回 `total > 0`，说明数据库有数据 → 检查其他原因

### 步骤 2：检查 API 日志

```bash
# 查看 API Worker 实时日志
wrangler tail starye-api
```

然后在浏览器访问 https://starye.org/movie/，观察日志输出。

**查找关键信息**：
- 数据库查询语句
- 返回的数据数量
- 是否有错误

### 步骤 3：测试 API 响应

```bash
# 测试 Movies API
curl -s "https://starye.org/api/public/movies" | jq '.total, .data | length'

# 测试 Comics API
curl -s "https://starye.org/api/public/comics" | jq '.total, .data | length'
```

**预期结果**：
- 应该返回数据总数和当前页数据数量
- 如果都是 0，确认数据库为空

### 步骤 4：检查浏览器 Network

1. 打开 https://starye.org/movie/
2. 打开开发者工具（F12）→ Network 标签
3. 刷新页面
4. 查找 `/api/public/movies` 请求
5. 检查响应数据：
   - `total`: 应该 > 0
   - `data`: 应该有电影列表
   - `page`, `limit`: 分页参数

**如果显示的是本地数据**：
- 检查请求 URL：应该是 `https://starye.org/api/...`，不是 `localhost:8787/api/...`
- 检查响应 Headers：应该有 `cf-ray`（Cloudflare 标识）

## 解决方案

### 方案 A：数据库为空 - 导入数据

如果生产数据库为空，选择以下方法之一：

#### 方法 1：从本地导出并导入

```bash
# 1. 导出本地数据（开发环境）
cd apps/api
wrangler d1 export DB --output=starye-data.sql

# 2. 导入到生产环境
wrangler d1 execute starye-db --file=starye-data.sql --remote

# 3. 验证导入
wrangler d1 execute starye-db --command "SELECT COUNT(*) FROM movies" --remote
wrangler d1 execute starye-db --command "SELECT COUNT(*) FROM comics" --remote
```

#### 方法 2：使用爬虫重新抓取

如果有配置爬虫（需要设置 `CRAWLER_SECRET`）：

```bash
# 设置爬虫密钥（仅一次）
wrangler secret put CRAWLER_SECRET --name starye-api
# 输入密钥值（例如：生成的随机字符串）

# 触发爬虫
curl -X POST "https://starye.org/api/admin/crawler/movies" \
  -H "x-service-token: YOUR_ADMIN_TOKEN"

curl -X POST "https://starye.org/api/admin/crawler/comics" \
  -H "x-service-token: YOUR_ADMIN_TOKEN"
```

### 方案 B：检查 API 绑定

如果数据库有数据但 API 返回空：

1. 访问 Cloudflare Dashboard
2. Workers & Pages → starye-api → Settings → Bindings
3. 确认 `DB` 绑定：
   - Binding name: `DB`
   - Database: `starye-db`
   - Database ID: `72b60b6c-806f-4795-a846-9b0d157b8225`
4. 如果配置错误，修正后重新部署：
   ```bash
   cd apps/api
   wrangler deploy
   ```

### 方案 C：清除缓存

如果以上都正常，尝试清除缓存：

1. 浏览器无痕模式访问
2. 或清除所有缓存（Ctrl+Shift+Delete）
3. 强制刷新（Ctrl+F5）

## 当前部署状态

### ✅ 已部署服务

| 服务 | 状态 | URL | 备注 |
|------|------|-----|------|
| Gateway Worker | ✅ 部署成功 | starye.org | 版本 557c9be7 |
| Dashboard | ✅ 部署成功 | starye.org/dashboard/ | 静态资源已修复 |
| Comic App | ✅ 部署成功 | starye.org/comic/ | 正常运行 |
| Movie App | ✅ 部署成功 | starye.org/movie/ | 正常运行 |
| API Worker | ✅ 运行中 | api.starye.org | 数据库待检查 |

### ⚠️ 待确认

- [ ] 生产数据库是否有数据
- [ ] API 是否连接到正确的数据库
- [ ] 用户看到的"本地数据"是什么意思（具体内容）

## 下一步行动

请执行以下命令诊断问题：

```bash
# 1. 检查生产数据库
wrangler d1 execute starye-db --command "SELECT COUNT(*) as movies FROM movies" --remote
wrangler d1 execute starye-db --command "SELECT COUNT(*) as comics FROM comics" --remote

# 2. 如果有数据，查看示例
wrangler d1 execute starye-db --command "SELECT id, title, slug FROM movies LIMIT 3" --remote

# 3. 如果没有数据，导入数据
cd apps/api
wrangler d1 export DB --output=starye-data.sql
wrangler d1 execute starye-db --file=starye-data.sql --remote
```

执行后，请告诉我：
1. 生产数据库有多少条数据？
2. 你看到的"本地数据"具体是什么？（例如：漫画/电影的标题）
3. 浏览器 Network 面板中 API 请求的 URL 是什么？
