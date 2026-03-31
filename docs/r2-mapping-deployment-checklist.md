# R2 映射存储部署验证清单

**日期**: 2026-03-31  
**任务**: 15.7 完善 R2 存储配置

## 快速检查（5 分钟）

在开始部署前，快速检查以下内容：

### 前置条件

- [ ] 已有 Cloudflare 账户
- [ ] 已创建 R2 存储桶（`starye-assets`）
- [ ] 已有 R2 API Token（有读写权限）
- [ ] 本地爬虫环境可正常运行
- [ ] 本地 API 服务可正常运行
- [ ] 本地 Dashboard 可正常访问

### 环境变量检查

```bash
# 运行快速检查
cd packages/crawler
node -e "
require('dotenv').config();
const vars = [
  'UPLOAD_MAPPINGS_TO_R2',
  'CLOUDFLARE_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET_NAME',
  'R2_PUBLIC_URL'
];
vars.forEach(v => {
  const val = process.env[v];
  console.log(\`\${v}: \${val ? '✅' : '❌'}\`);
});
"
```

**预期输出**: 所有变量都显示 ✅

## 本地验证（15 分钟）

### 步骤 1: R2 连接验证（3 分钟）

```bash
cd packages/crawler
pnpm tsx scripts/verify-r2-upload.ts
```

- [ ] 脚本运行成功（exit code 0）
- [ ] 看到 "✅ 已上传映射文件"
- [ ] 看到 "✅ 验证成功！"
- [ ] 无错误消息

### 步骤 2: 爬虫上传验证（5 分钟）

```bash
MAX_ACTORS=10 UPLOAD_MAPPINGS_TO_R2=true pnpm crawl:actor
```

- [ ] 爬虫正常启动
- [ ] 看到 "[NameMapper] ✅ 映射表已保存到本地文件"
- [ ] 看到 "[NameMapper] 📤 上传映射文件到 R2..."
- [ ] 看到 "[NameMapper] ✅ 映射文件已上传到 R2"
- [ ] 本地生成文件：`.seesaawiki-actor-map.json`
- [ ] 无上传错误

### 步骤 3: R2 文件验证（2 分钟）

**选项 A: Cloudflare Dashboard**

访问 https://dash.cloudflare.com → R2 → starye-assets → mappings/

- [ ] 存在 `actor-name-map.json`
- [ ] 存在 `unmapped-actors.json`
- [ ] 存在 `backups/` 目录
- [ ] 备份文件名包含时间戳

**选项 B: wrangler CLI**

```bash
wrangler r2 object list starye-assets --prefix mappings/
```

- [ ] 输出包含 `actor-name-map.json`
- [ ] 输出包含 `unmapped-actors.json`

### 步骤 4: API 端点验证（3 分钟）

启动 API 服务（如果未运行）：
```bash
cd apps/api
pnpm dev
```

测试端点：
```bash
# 测试未匹配清单
curl http://localhost:8787/api/admin/crawlers/unmapped-actors \
  -H "Authorization: Bearer $CRAWLER_SECRET"
```

- [ ] 返回状态码 200
- [ ] 响应包含 `data` 数组
- [ ] 响应包含 `metadata` 对象
- [ ] 数据不为空（至少有测试数据）

```bash
# 测试映射质量
curl http://localhost:8787/api/admin/crawlers/mapping-quality \
  -H "Authorization: Bearer $CRAWLER_SECRET"
```

- [ ] 返回状态码 200
- [ ] 显示 `mappedActors` 和 `unmappedActors`
- [ ] 显示 `conflictCount`（可能为 0）

### 步骤 5: Dashboard 验证（2 分钟）

启动 Dashboard（如果未运行）：
```bash
cd apps/dashboard
pnpm dev
```

**测试映射管理页面**:
```
http://localhost:8080/name-mapping-management
```

- [ ] 页面正常加载（无错误）
- [ ] 显示未匹配女优清单
- [ ] 可以切换到"厂商"标签
- [ ] 搜索框可用
- [ ] 排序下拉框可用
- [ ] 优先级筛选按钮可用
- [ ] 添加映射表单可见

**测试质量报告页面**:
```
http://localhost:8080/mapping-quality-report
```

- [ ] 页面正常加载
- [ ] 显示总体质量评分（0-100）
- [ ] 显示女优覆盖率百分比
- [ ] 显示厂商覆盖率百分比
- [ ] 显示改进建议列表

## 生产环境部署（30 分钟）

### 步骤 1: GitHub Secrets 配置（5 分钟）

访问 GitHub 仓库 → Settings → Secrets and variables → Actions

添加以下 Secrets：

- [ ] `UPLOAD_MAPPINGS_TO_R2` = `true`
- [ ] `CLOUDFLARE_ACCOUNT_ID` = `your_account_id`
- [ ] `R2_ACCESS_KEY_ID` = `your_key_id`
- [ ] `R2_SECRET_ACCESS_KEY` = `your_secret_key`
- [ ] `R2_BUCKET_NAME` = `starye-assets`
- [ ] `R2_PUBLIC_URL` = `https://cdn.starye.com`

### 步骤 2: 更新 GitHub Actions（5 分钟）

编辑 `.github/workflows/daily-actor-crawl.yml`，在 `env` 部分添加：

```yaml
env:
  UPLOAD_MAPPINGS_TO_R2: ${{ secrets.UPLOAD_MAPPINGS_TO_R2 }}
  CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
  R2_ACCESS_KEY_ID: ${{ secrets.R2_ACCESS_KEY_ID }}
  R2_SECRET_ACCESS_KEY: ${{ secrets.R2_SECRET_ACCESS_KEY }}
  R2_BUCKET_NAME: ${{ secrets.R2_BUCKET_NAME }}
  R2_PUBLIC_URL: ${{ secrets.R2_PUBLIC_URL }}
```

- [ ] 已更新 `daily-actor-crawl.yml`
- [ ] 已更新 `daily-publisher-crawl.yml`
- [ ] 已提交并推送到 main 分支

### 步骤 3: 首次数据同步（15 分钟）

```bash
# 手动触发女优爬虫
gh workflow run daily-actor-crawl.yml

# 监控运行状态
gh run watch
```

- [ ] Workflow 成功启动
- [ ] 运行过程无错误
- [ ] 日志包含 "✅ 映射文件已上传到 R2"
- [ ] Workflow 成功完成

```bash
# 手动触发厂商爬虫
gh workflow run daily-publisher-crawl.yml
gh run watch
```

- [ ] Workflow 成功完成
- [ ] 日志包含 R2 上传确认

### 步骤 4: 生产环境验证（5 分钟）

**验证 R2 文件**:

访问 Cloudflare Dashboard → R2 → starye-assets

- [ ] `mappings/actor-name-map.json` 存在
- [ ] `mappings/publisher-name-map.json` 存在
- [ ] `mappings/unmapped-actors.json` 存在
- [ ] `mappings/unmapped-publishers.json` 存在
- [ ] `mappings/backups/` 包含备份文件

**验证 Dashboard**:

访问生产环境 Dashboard（如 https://admin.starye.com）

- [ ] 映射管理页面可访问
- [ ] 显示未匹配清单（非空或有提示）
- [ ] 质量报告页面可访问
- [ ] 显示真实的质量指标

**验证添加映射功能**:

- [ ] 手动添加一条测试映射
- [ ] 看到成功提示
- [ ] 刷新页面，映射生效
- [ ] 未匹配清单中该项消失

## 故障排除清单

### 如果步骤 1 失败（R2 连接验证）

检查项：
- [ ] 环境变量拼写正确（无多余空格）
- [ ] CLOUDFLARE_ACCOUNT_ID 非空（32 位十六进制）
- [ ] R2 API Token 有效（未过期）
- [ ] R2 API Token 有正确权限（Read + Write）
- [ ] 网络可访问 Cloudflare（无防火墙拦截）

修复方式：
```bash
# 重新生成 R2 API Token
# Cloudflare Dashboard → R2 → Manage R2 API Tokens → Create API Token

# 更新 .env
nano packages/crawler/.env

# 重新验证
pnpm tsx scripts/verify-r2-upload.ts
```

### 如果步骤 2 失败（爬虫上传验证）

检查项：
- [ ] `UPLOAD_MAPPINGS_TO_R2=true` 在命令行或 .env 中设置
- [ ] 爬虫本身运行成功（至少部分女优爬取成功）
- [ ] R2 配置在验证脚本中通过

查看错误日志：
```bash
# 检查日志中的错误信息
# 搜索 "❌ 保存映射表失败"
```

### 如果步骤 4 失败（API 端点验证）

检查项：
- [ ] API 服务正在运行（`pnpm dev`）
- [ ] `wrangler.toml` 配置了 R2 绑定
- [ ] CRAWLER_SECRET 环境变量正确
- [ ] R2 文件确实存在（步骤 3 通过）

测试 R2 绑定：
```bash
cd apps/api
wrangler dev --test-scheduled
# 在控制台输入: fetch("http://localhost:8787/api/admin/crawlers/unmapped-actors")
```

### 如果步骤 5 失败（Dashboard 验证）

检查项：
- [ ] Dashboard 服务正在运行
- [ ] API 端点返回正确数据（步骤 4 通过）
- [ ] 浏览器控制台无 CORS 错误
- [ ] 用户已登录且有 movie_admin 权限

查看浏览器控制台：
```
F12 → Console → 查看错误信息
F12 → Network → 查看 API 请求状态
```

## 全部通过！

如果所有检查项都通过 ✅：

**恭喜！R2 映射存储功能部署成功！** 🎉

### 您现在可以：

1. ✅ **自动化映射管理**: 爬虫运行时自动上传和备份
2. ✅ **在线查看**: 通过 Dashboard 查看未匹配清单
3. ✅ **手动添加**: 通过 Dashboard 快速添加映射
4. ✅ **质量监控**: 实时查看覆盖率和冲突数
5. ✅ **版本管理**: 查看历史版本和变更记录
6. ✅ **多人协作**: 团队成员共同维护映射表

### 后续维护

**每周任务**:
- 访问质量报告页面
- 检查覆盖率是否达标（> 85%）
- 审核高优先级未匹配清单
- 手动添加重要女优的映射

**每月任务**:
- 清理旧备份（保留 30-50 个）
- 验证映射 URL 有效性
- 生成数据完整度报告

### 需要帮助？

参考以下文档：

- **快速入门**: [R2 映射存储快速部署指南](./r2-mapping-quick-deploy-guide.md) ⭐
- **配置详解**: [R2 映射存储配置指南](./r2-mapping-storage-setup-guide.md)
- **使用示例**: [R2 映射使用示例](./r2-mapping-usage-examples.md)
- **环境变量**: [环境变量配置说明](./r2-mapping-env-vars-guide.md)
- **故障排除**: [R2 存储配置指南 - 故障排除](./r2-mapping-storage-setup-guide.md#故障排除)

---

**部署愉快！** 🚀
