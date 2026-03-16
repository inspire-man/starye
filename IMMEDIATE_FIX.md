# 🚨 立即修复指南

## 当前问题

1. ❌ **Comic App 访问报错**：资源 404，CORS 错误
2. ❌ **Movie App 部署失败**：项目不存在

## 根本原因

**Gateway Worker 还未部署新版本**，仍在使用旧的路由逻辑，无法正确处理新的应用结构。

---

## 🔥 立即修复步骤

### 第一步：部署 Gateway Worker（最重要）

```bash
# 进入 Gateway 目录
cd apps/gateway

# 立即部署
pnpm exec wrangler deploy
```

**预期输出**：
```
✨ Successfully deployed to starye.org
```

**如果失败**：
```bash
# 检查环境变量
echo $CLOUDFLARE_API_TOKEN
echo $CLOUDFLARE_ACCOUNT_ID

# 手动设置（如果未设置）
export CLOUDFLARE_API_TOKEN=your_token
export CLOUDFLARE_ACCOUNT_ID=your_account_id

# 重试部署
pnpm exec wrangler deploy
```

### 第二步：创建 Movie Pages 项目

```bash
# 返回项目根目录
cd ../..

# 创建 Movie Pages 项目
pnpm exec wrangler pages project create starye-movie --production-branch=main
```

### 第三步：重新部署应用

```bash
# 构建并部署 Movie App
pnpm --filter @starye/movie-app run build
pnpm exec wrangler pages deploy apps/movie-app/dist --project-name=starye-movie
```

### 第四步：验证

```bash
# 测试 Comic App
curl -I https://starye.org/comic/
# 应该返回 200 或 30x

# 测试 Movie App  
curl -I https://starye.org/movie/
# 应该返回 200 或 30x
```

在浏览器中访问：
- https://starye.org/comic/ - 应该正常显示
- https://starye.org/movie/ - 应该正常显示

---

## 🎯 或者：一键修复脚本

创建并运行此脚本（保存为 `fix-deployment.sh`）：

```bash
#!/bin/bash

echo "🚀 开始修复部署..."

# 1. 部署 Gateway
echo "📦 步骤 1/4: 部署 Gateway Worker..."
cd apps/gateway
pnpm exec wrangler deploy
if [ $? -ne 0 ]; then
    echo "❌ Gateway 部署失败！请检查环境变量。"
    exit 1
fi
cd ../..
echo "✅ Gateway 部署成功"

# 2. 创建 Movie Pages 项目
echo "📦 步骤 2/4: 创建 Movie Pages 项目..."
pnpm exec wrangler pages project create starye-movie --production-branch=main 2>/dev/null || echo "项目已存在或创建失败（可能已存在）"

# 3. 部署 Movie App
echo "📦 步骤 3/4: 部署 Movie App..."
pnpm --filter @starye/movie-app run build
pnpm exec wrangler pages deploy apps/movie-app/dist --project-name=starye-movie
if [ $? -ne 0 ]; then
    echo "❌ Movie App 部署失败！"
    exit 1
fi
echo "✅ Movie App 部署成功"

# 4. 验证
echo "📦 步骤 4/4: 验证部署..."
echo "测试 Comic App..."
curl -I https://starye.org/comic/ | head -n 1
echo "测试 Movie App..."
curl -I https://starye.org/movie/ | head -n 1

echo ""
echo "🎉 修复完成！请在浏览器中验证："
echo "   - https://starye.org/comic/"
echo "   - https://starye.org/movie/"
```

运行：
```bash
chmod +x fix-deployment.sh
./fix-deployment.sh
```

---

## ✅ 验证清单

修复后，检查以下项目：

### 浏览器测试

访问 https://starye.org/comic/

- [ ] 页面正常加载（无白屏）
- [ ] 打开开发者工具（F12）
- [ ] Console 标签页无红色错误
- [ ] Network 标签页：
  - [ ] `index-*.js` 文件状态 200
  - [ ] `index-*.css` 文件状态 200
  - [ ] 无 404 错误
  - [ ] 无 CORS 错误

访问 https://starye.org/movie/

- [ ] 页面正常加载
- [ ] Console 无错误
- [ ] 静态资源加载成功

### 功能测试

- [ ] Comic App 首页漫画列表显示
- [ ] Movie App 首页影片列表显示
- [ ] 路由导航正常工作
- [ ] 点击"个人中心"提示登录（未登录状态）

---

## 🔍 如果仍然失败

### 1. 检查 Gateway 配置

```bash
cat apps/gateway/wrangler.toml | grep ORIGIN
```

应该看到：
```toml
COMIC_ORIGIN = "https://starye-comic.pages.dev"
MOVIE_ORIGIN = "https://starye-movie.pages.dev"
```

### 2. 检查应用配置

```bash
# Comic App
grep "base:" apps/comic-app/vite.config.ts
# 应该显示: base: '/',

grep "base href" apps/comic-app/index.html
# 应该无输出（已移除）

# Movie App
grep "base:" apps/movie-app/vite.config.ts
# 应该显示: base: '/',

grep "base href" apps/movie-app/index.html
# 应该无输出（已移除）
```

### 3. 检查 Pages 项目

```bash
# 列出所有 Pages 项目
pnpm exec wrangler pages project list

# 应该看到:
# - starye-comic
# - starye-movie
```

### 4. 查看 Gateway 日志

在 Cloudflare Dashboard：
1. 进入 Workers & Pages
2. 找到 `starye-gateway`
3. 点击 "Logs" 或 "Metrics"
4. 查看最近的请求日志

### 5. 清除缓存

```bash
# Cloudflare 清除缓存
# 在 Cloudflare Dashboard -> Caching -> Purge Everything

# 浏览器清除缓存
# Ctrl+Shift+Del (Windows) 或 Cmd+Shift+Del (Mac)
```

---

## 📞 获取帮助

如果以上步骤都无法解决问题，请提供：

1. **Gateway 部署输出**：
   ```bash
   cd apps/gateway
   pnpm exec wrangler deploy 2>&1 | tee gateway-deploy.log
   cat gateway-deploy.log
   ```

2. **浏览器 Console 完整错误**：
   - 打开 https://starye.org/comic/
   - F12 -> Console
   - 截图或复制所有错误信息

3. **Network 失败请求**：
   - F12 -> Network
   - 找到红色（失败）的请求
   - 右键 -> Copy -> Copy as cURL
   - 提供 cURL 命令

4. **Pages 项目列表**：
   ```bash
   pnpm exec wrangler pages project list
   ```

---

## ⏭️ 下一步

修复完成后：
1. ✅ 提交所有代码修改
2. ✅ 推送到 main 分支
3. ✅ GitHub Actions 会自动部署
4. ✅ 查看 `QUICK_TEST_GUIDE.md` 进行完整测试

---

## 📚 相关文档

- `DEPLOYMENT_ORDER.md` - 详细部署顺序说明
- `CLOUDFLARE_PAGES_FIX.md` - 技术细节和原理
- `DEPLOYMENT_FIXES_COMPLETE.md` - 完整修复历史
