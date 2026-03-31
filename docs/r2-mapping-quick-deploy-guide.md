# R2 映射存储快速部署指南

**创建日期**: 2026-03-31  
**预计用时**: 15-20 分钟

## 前置条件

- ✅ Cloudflare 账户（已有 R2 存储桶）
- ✅ 本地爬虫环境已配置
- ✅ API 服务可正常运行

## 部署步骤

### 第 1 步: 配置爬虫环境变量（5 分钟）

编辑 `packages/crawler/.env`：

```bash
# 启用 R2 映射文件上传
UPLOAD_MAPPINGS_TO_R2=true

# 验证 R2 配置（应该已存在）
CLOUDFLARE_ACCOUNT_ID=your_account_id_here
R2_ACCESS_KEY_ID=your_access_key_here
R2_SECRET_ACCESS_KEY=your_secret_access_key_here
R2_BUCKET_NAME=starye-assets
R2_PUBLIC_URL=https://cdn.starye.com
```

**验证命令**:
```bash
cd packages/crawler
node -e "require('dotenv').config(); console.log('UPLOAD_MAPPINGS_TO_R2:', process.env.UPLOAD_MAPPINGS_TO_R2)"
# 输出应为: UPLOAD_MAPPINGS_TO_R2: true
```

### 第 2 步: 验证 R2 连接（3 分钟）

运行快速验证脚本：

```bash
cd packages/crawler
pnpm tsx scripts/verify-r2-upload.ts
```

**预期输出**:
```
✅ 已上传映射文件: mappings/actor-name-map.json
📦 已创建备份: mappings/backups/actor-name-map-1711875000000.json
✅ 已上传映射文件: mappings/unmapped-actors.json
✅ 验证成功！R2 映射文件上传功能正常
```

**如果失败**:
- 检查环境变量是否正确
- 检查 R2 访问密钥是否有效
- 检查网络连接

### 第 3 步: 运行小批量爬虫测试（5 分钟）

```bash
cd packages/crawler
MAX_ACTORS=10 pnpm crawl:actor
```

**检查日志**:
- [ ] 看到 "✅ 映射表已保存到本地文件"
- [ ] 看到 "📤 上传映射文件到 R2..."
- [ ] 看到 "✅ 映射文件已上传到 R2"

**预期结果**:
- 本地文件生成：`.seesaawiki-actor-map.json`, `.seesaawiki-unmapped-actors.json`
- R2 文件上传成功

### 第 4 步: 验证 R2 文件（2 分钟）

**方法 1: Cloudflare Dashboard**

1. 登录 https://dash.cloudflare.com
2. 进入 R2 → 选择 `starye-assets` 存储桶
3. 导航到 `mappings/` 目录
4. 确认文件存在：
   - [ ] `actor-name-map.json`
   - [ ] `unmapped-actors.json`
   - [ ] `backups/` 目录（包含带时间戳的备份文件）

**方法 2: wrangler CLI**

```bash
wrangler r2 object list starye-assets --prefix mappings/
```

### 第 5 步: 验证 API 端点（3 分钟）

```bash
# 启动 API 服务（如果未运行）
cd apps/api
pnpm dev

# 在另一个终端测试端点
curl http://localhost:8787/api/admin/crawlers/unmapped-actors \
  -H "Authorization: Bearer $CRAWLER_SECRET"
```

**预期响应**:
```json
{
  "data": [
    {
      "javbusName": "未知女优测试",
      "attempts": ["cache", "exact", "index"],
      "lastAttempt": 1711875000
    }
  ],
  "metadata": {
    "version": "2026-03-31T10:30:00.000Z",
    "uploadedAt": 1711875000000,
    "totalEntries": 1,
    "source": "index-crawler"
  }
}
```

### 第 6 步: 验证 Dashboard 功能（2 分钟）

```bash
# 启动 Dashboard（如果未运行）
cd apps/dashboard
pnpm dev

# 访问映射管理页面
open http://localhost:8080/name-mapping-management
```

**检查清单**:
- [ ] 页面正常加载（无错误）
- [ ] 显示未匹配女优清单
- [ ] 可以切换到厂商标签
- [ ] 搜索、筛选、排序功能正常
- [ ] 添加映射表单可见

访问质量报告页面：
```bash
open http://localhost:8080/mapping-quality-report
```

**检查清单**:
- [ ] 显示总体质量评分
- [ ] 显示女优/厂商覆盖率
- [ ] 显示映射冲突数（应为 0 或小数值）
- [ ] 显示改进建议

## 部署完成检查

所有步骤完成后，确认：

| 检查项 | 状态 |
|--------|------|
| 环境变量配置 | [ ] |
| R2 连接验证 | [ ] |
| 爬虫上传测试 | [ ] |
| R2 文件存在 | [ ] |
| API 端点正常 | [ ] |
| Dashboard 显示 | [ ] |

如果所有检查项都通过 ✅，部署成功！

## 生产环境部署

### GitHub Actions 配置

在 GitHub 仓库 → Settings → Secrets → Actions 中添加：

```
UPLOAD_MAPPINGS_TO_R2: true
```

更新 `.github/workflows/daily-actor-crawl.yml`:

```yaml
env:
  UPLOAD_MAPPINGS_TO_R2: ${{ secrets.UPLOAD_MAPPINGS_TO_R2 }}
  CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
  R2_ACCESS_KEY_ID: ${{ secrets.R2_ACCESS_KEY_ID }}
  R2_SECRET_ACCESS_KEY: ${{ secrets.R2_SECRET_ACCESS_KEY }}
  R2_BUCKET_NAME: ${{ secrets.R2_BUCKET_NAME }}
  R2_PUBLIC_URL: ${{ secrets.R2_PUBLIC_URL }}
```

同样更新 `daily-publisher-crawl.yml`。

### 首次数据同步

```bash
# 手动触发 GitHub Actions
gh workflow run daily-actor-crawl.yml

# 监控日志
gh run watch

# 验证生产环境 Dashboard
open https://admin.starye.com/name-mapping-management
```

## 后续维护

### 每周任务

- [ ] 检查映射质量报告
- [ ] 审核高优先级未匹配清单（P0-P1）
- [ ] 手动添加重要女优/厂商的映射

### 每月任务

- [ ] 检查 R2 备份文件数量（清理旧备份）
- [ ] 验证映射 URL 有效性
- [ ] 生成数据完整度对比报告

## 故障排除

### 常见问题

**Q1: 爬虫日志没有显示 "上传到 R2"**

A: 检查环境变量：
```bash
echo $UPLOAD_MAPPINGS_TO_R2
# 应输出: true
```

**Q2: Dashboard 显示 "未找到未匹配清单"**

A: 检查 R2 文件：
```bash
wrangler r2 object list starye-assets --prefix mappings/
# 应看到 unmapped-actors.json
```

**Q3: API 返回 "R2 存储桶未配置"**

A: 检查 `apps/api/wrangler.toml`:
```toml
[[r2_buckets]]
binding = "BUCKET"
bucket_name = "starye-assets"
```

然后重启 API：
```bash
cd apps/api
pnpm dev
```

### 回滚方案

如果 R2 上传出现问题：

```bash
# 临时禁用 R2 上传
export UPLOAD_MAPPINGS_TO_R2=false

# 爬虫继续正常运行，只是不上传到 R2
pnpm crawl:actor
```

Dashboard 会显示提示信息但不影响其他功能。

## 支持

**相关文档**:
- [R2 映射存储配置指南](./r2-mapping-storage-setup-guide.md) - 详细技术说明
- [R2 存储实施报告](./r2-mapping-storage-implementation-report.md) - 实施细节和优化建议
- [环境变量配置说明](./r2-mapping-env-vars-guide.md) - 所有环境变量详解

**常见错误代码**:
- `401 Unauthorized`: CRAWLER_SECRET 未配置或无效
- `403 Forbidden`: 用户权限不足（需要 movie_admin 角色）
- `500 R2 存储桶未配置`: `wrangler.toml` 缺少 R2 绑定

---

**部署完成后，您将获得**:
- ✅ 自动化的映射文件管理
- ✅ Dashboard 在线查看和编辑
- ✅ 版本管理和备份
- ✅ 多用户协作能力
- ✅ 实时数据质量监控

开始部署吧！ 🚀
