# 🚀 立即重新部署

## 配置已修复

已经将应用改回子路径部署模式：
- ✅ `vite.config.ts`: `base: '/comic/'` 和 `base: '/movie/'`
- ✅ `index.html`: 添加 `<base href="/comic/" />` 和 `<base href="/movie/" />`
- ✅ Gateway: 移除路径重写，直接转发
- ✅ `_redirects` 和 `_headers`: 使用子路径

## 立即执行步骤

### 方式一：完整手动部署（推荐）

```bash
# 1. 构建 Comic App
pnpm --filter @starye/comic-app run build

# 2. 部署 Comic App
pnpm exec wrangler pages deploy apps/comic-app/dist --project-name=starye-comic

# 3. 构建 Movie App
pnpm --filter @starye/movie-app run build

# 4. 部署 Movie App
pnpm exec wrangler pages deploy apps/movie-app/dist --project-name=starye-movie

# 5. 部署 Gateway
cd apps/gateway
pnpm exec wrangler deploy
cd ../..

# 6. 测试
echo "等待 30 秒让部署生效..."
sleep 30
curl -I https://starye.org/comic/
curl -I https://starye.org/movie/
```

### 方式二：使用 GitHub Actions

```bash
# 提交代码
git add .
git commit -m "fix: 改回子路径部署模式

- vite.config.ts: base 回到子路径
- index.html: 添加 base 标签
- Gateway: 移除路径重写
- _redirects/_headers: 使用子路径"

git push origin main
```

然后在 GitHub Actions 页面：
1. 运行 "Deploy Comic App" workflow
2. 运行 "Deploy Movie App" workflow
3. 运行 "Deploy Gateway" workflow

## 验证

部署完成后，访问：
- https://starye.org/comic/
- https://starye.org/movie/

检查：
- [ ] 页面正常加载（无白屏）
- [ ] Console 无错误
- [ ] 资源路径是 `/comic/assets/...` 和 `/movie/assets/...`
- [ ] 静态资源加载成功（200 状态）

## 原理说明

### 之前的错误架构

```
用户访问: https://starye.org/comic/
↓
Gateway 转发到: starye-comic.pages.dev/
应用返回: index.html (base: '/')
↓
浏览器加载: <script src="/assets/index.js">
↓
浏览器请求: https://starye.org/assets/index.js ❌
↓
Gateway: 路径不包含 /comic，无法路由 ❌
→ 404 错误
```

### 修复后的正确架构

```
用户访问: https://starye.org/comic/
↓
Gateway 转发到: starye-comic.pages.dev/comic/
应用返回: index.html (base: '/comic/')
↓
浏览器加载: <script src="/comic/assets/index.js">
↓
浏览器请求: https://starye.org/comic/assets/index.js ✅
↓
Gateway: 路径包含 /comic，转发到 Pages ✅
→ 200 成功
```

## 如果还有问题

### 检查构建输出

```bash
ls apps/comic-app/dist
# 应该看到:
# - index.html
# - comic/
#   - assets/
#   - favicon.svg
#   - _redirects
#   - _headers
```

### 检查 index.html

```bash
head -n 10 apps/comic-app/dist/index.html
# 应该看到:
# <base href="/comic/" />
```

### 清除 Cloudflare 缓存

在 Cloudflare Dashboard:
1. 进入域名设置
2. Caching -> Purge Everything

### 查看 Gateway 日志

在 Cloudflare Dashboard:
1. Workers & Pages
2. starye-gateway
3. Logs

## 测试脚本

创建 `test-deployment.sh`:

```bash
#!/bin/bash

echo "🧪 测试部署..."

# 测试 Comic App
echo "📖 测试 Comic App..."
COMIC_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://starye.org/comic/)
echo "状态码: $COMIC_STATUS"

if [ "$COMIC_STATUS" -eq 200 ]; then
    echo "✅ Comic App 正常"
else
    echo "❌ Comic App 失败 (状态码: $COMIC_STATUS)"
fi

# 测试 Movie App
echo "🎬 测试 Movie App..."
MOVIE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://starye.org/movie/)
echo "状态码: $MOVIE_STATUS"

if [ "$MOVIE_STATUS" -eq 200 ]; then
    echo "✅ Movie App 正常"
else
    echo "❌ Movie App 失败 (状态码: $MOVIE_STATUS)"
fi

# 测试资源加载
echo "📦 测试资源路径..."
COMIC_HTML=$(curl -s https://starye.org/comic/)
if echo "$COMIC_HTML" | grep -q 'base href="/comic/"'; then
    echo "✅ Comic App base 标签正确"
else
    echo "❌ Comic App base 标签缺失或错误"
fi

echo ""
echo "🎉 测试完成！请在浏览器中验证完整功能。"
```

运行：
```bash
chmod +x test-deployment.sh
./test-deployment.sh
```
