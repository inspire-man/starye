# 🚀 部署顺序指南

## ⚠️ 重要：必须按顺序部署

由于应用架构依赖 Gateway 的路径重写，**必须先部署 Gateway，再部署前端应用**。

---

## 方式一：手动部署（推荐用于首次部署）

### 步骤 1: 部署 Gateway Worker

```bash
cd apps/gateway
pnpm exec wrangler deploy
```

**验证**：访问 https://starye.org，应该看到重定向或错误页面（这是正常的）

### 步骤 2: 部署 Comic App

```bash
# 构建
pnpm --filter @starye/comic-app run build

# 创建项目（首次）
pnpm exec wrangler pages project create starye-comic --production-branch=main

# 部署
pnpm exec wrangler pages deploy apps/comic-app/dist --project-name=starye-comic
```

**验证**：访问 https://starye.org/comic/

### 步骤 3: 部署 Movie App

```bash
# 构建
pnpm --filter @starye/movie-app run build

# 创建项目（首次）
pnpm exec wrangler pages project create starye-movie --production-branch=main

# 部署
pnpm exec wrangler pages deploy apps/movie-app/dist --project-name=starye-movie
```

**验证**：访问 https://starye.org/movie/

---

## 方式二：使用 GitHub Actions

### 注意事项

GitHub Actions 会自动触发，但需要注意顺序：

1. **如果修改了 Gateway**：
   - 推送后，先等 Gateway 部署完成（约 1-2 分钟）
   - 再触发 Comic/Movie App 的部署

2. **如果只修改了前端应用**：
   - 直接推送，自动部署即可

### 手动触发顺序

在 GitHub Actions 页面：

1. 运行 "Deploy Gateway" workflow
2. 等待完成
3. 运行 "Deploy Comic App" workflow
4. 运行 "Deploy Movie App" workflow

---

## 当前状态诊断

### 检查 Gateway 是否已部署新版本

访问 https://starye.org/comic/ 并检查：

**如果看到 404 错误（资源文件）**：
- ❌ Gateway 还是旧版本
- ✅ **解决**：手动部署 Gateway

**如果页面正常加载**：
- ✅ Gateway 已更新
- ✅ 应用正常工作

### 检查应用配置

```bash
# 检查 vite.config.ts 的 base 配置
grep "base:" apps/comic-app/vite.config.ts
# 应该显示: base: '/',

# 检查 index.html 是否有 base 标签
grep "base href" apps/comic-app/index.html
# 应该没有输出（已移除）
```

---

## 快速修复（如果访问报错）

### 症状：https://starye.org/comic/ 资源 404

**原因**：Gateway 还是旧版本，或未部署

**快速修复**：

```bash
# 1. 立即部署 Gateway
cd apps/gateway
pnpm exec wrangler deploy

# 2. 等待 30 秒

# 3. 测试
curl -I https://starye.org/comic/
# 应该返回 200 或 301/302
```

### 症状：Movie App 部署失败（Project not found）

**原因**：Cloudflare Pages 项目不存在

**快速修复**：

```bash
# 创建项目
pnpm exec wrangler pages project create starye-movie --production-branch=main

# 重新触发 GitHub Actions 部署
# 或手动部署：
pnpm --filter @starye/movie-app run build
pnpm exec wrangler pages deploy apps/movie-app/dist --project-name=starye-movie
```

---

## 完整重新部署流程

如果需要从头开始：

```bash
# 1. 清理并安装依赖
pnpm install

# 2. 运行代码检查
pnpm lint
pnpm type-check

# 3. 部署 Gateway
cd apps/gateway
pnpm exec wrangler deploy
cd ../..

# 4. 部署 Comic App
pnpm --filter @starye/comic-app run build
pnpm exec wrangler pages project create starye-comic --production-branch=main || true
pnpm exec wrangler pages deploy apps/comic-app/dist --project-name=starye-comic

# 5. 部署 Movie App
pnpm --filter @starye/movie-app run build
pnpm exec wrangler pages project create starye-movie --production-branch=main || true
pnpm exec wrangler pages deploy apps/movie-app/dist --project-name=starye-movie

# 6. 测试
echo "Testing Comic App..."
curl -I https://starye.org/comic/
echo "Testing Movie App..."
curl -I https://starye.org/movie/
```

---

## 部署检查清单

在推送代码之前：

- [ ] `pnpm lint` 通过
- [ ] `pnpm type-check` 通过
- [ ] 本地 `pnpm dev` 测试通过
- [ ] vite.config.ts 中 `base: '/'`
- [ ] index.html 无 `<base>` 标签
- [ ] `_redirects` 和 `_headers` 文件存在

部署后验证：

- [ ] Gateway 部署成功
- [ ] Comic App 部署成功
- [ ] Movie App 部署成功
- [ ] https://starye.org/comic/ 可访问
- [ ] https://starye.org/movie/ 可访问
- [ ] Console 无错误
- [ ] 静态资源加载成功

---

## 故障排查

### Gateway 部署失败

```bash
# 查看配置
cat apps/gateway/wrangler.toml

# 手动部署并查看详细日志
cd apps/gateway
pnpm exec wrangler deploy --verbose
```

### Pages 部署失败

```bash
# 查看所有 Pages 项目
pnpm exec wrangler pages project list

# 查看特定项目详情
pnpm exec wrangler pages project view starye-comic

# 删除并重新创建项目
pnpm exec wrangler pages project delete starye-comic
pnpm exec wrangler pages project create starye-comic --production-branch=main
```

### 访问 404 但部署成功

1. 清除浏览器缓存
2. 使用无痕模式测试
3. 检查 Cloudflare Dashboard 的部署状态
4. 查看 Gateway Worker 日志

---

## 环境变量检查

确保在 GitHub Secrets 中配置了：

```
CLOUDFLARE_API_TOKEN=...
CLOUDFLARE_ACCOUNT_ID=...
```

在 Cloudflare Dashboard 检查：
- Gateway Worker 的环境变量（wrangler.toml 中的 [vars]）
- Pages 项目的自定义域名配置

---

## 下一步

部署成功后，查看 `QUICK_TEST_GUIDE.md` 进行功能测试。
