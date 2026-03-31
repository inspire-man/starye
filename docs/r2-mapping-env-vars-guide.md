# R2 映射存储环境变量配置

**目的**: 启用映射文件自动上传到 R2，让 Dashboard 映射管理功能完全可用

## 必需的环境变量

在 `packages/crawler/.env` 中配置以下变量：

```bash
# ================================
# R2 映射文件自动上传（新增）
# ================================

# 启用 R2 上传（默认 false）
UPLOAD_MAPPINGS_TO_R2=true

# ================================
# R2 存储配置（应该已存在）
# ================================

# Cloudflare 账户 ID
CLOUDFLARE_ACCOUNT_ID=your_account_id

# R2 访问密钥
R2_ACCESS_KEY_ID=your_access_key_id
R2_SECRET_ACCESS_KEY=your_secret_access_key

# R2 存储桶名称
R2_BUCKET_NAME=starye-assets

# R2 公开访问 URL
R2_PUBLIC_URL=https://cdn.starye.com

# ================================
# API 配置（应该已存在）
# ================================

API_URL=http://localhost:8787
CRAWLER_SECRET=your_crawler_secret
```

## 配置说明

### UPLOAD_MAPPINGS_TO_R2

**类型**: Boolean  
**默认值**: false  
**作用**: 控制爬虫是否在运行结束时上传映射文件到 R2

**设置建议**:
- 本地开发：`true`（便于测试 Dashboard 功能）
- GitHub Actions：`true`（生产数据同步）
- CI/CD 测试：`false`（避免污染生产数据）

### CLOUDFLARE_ACCOUNT_ID

**类型**: String  
**获取方式**: Cloudflare Dashboard → R2 → 任意存储桶 → 设置 → 账户 ID

**重要**: 此字段不能为空，否则会导致 R2 endpoint 构建失败。

### R2_ACCESS_KEY_ID 和 R2_SECRET_ACCESS_KEY

**类型**: String  
**获取方式**: Cloudflare Dashboard → R2 → Manage R2 API Tokens → Create API Token

**权限要求**:
- Object Read（读取对象）
- Object Write（写入对象）
- 作用域：选择目标存储桶

### R2_BUCKET_NAME

**类型**: String  
**建议值**: `starye-assets`

**存储内容**:
- `actors/` - 女优头像
- `publishers/` - 厂商 Logo
- `mappings/` - 名字映射文件（新增）

### R2_PUBLIC_URL

**类型**: String (URL)  
**建议值**: `https://cdn.starye.com`

**配置方式**:
1. Cloudflare R2 → 自定义域名
2. 绑定域名到 R2 存储桶
3. 配置 CNAME 记录

## 验证配置

### 步骤 1: 检查环境变量

```bash
cd packages/crawler

# 检查是否所有变量都已配置
node -e "require('dotenv').config(); console.log({
  UPLOAD_MAPPINGS_TO_R2: process.env.UPLOAD_MAPPINGS_TO_R2,
  CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID?.substring(0, 8) + '...',
  R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID ? '✓' : '✗',
  R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY ? '✓' : '✗',
  R2_BUCKET_NAME: process.env.R2_BUCKET_NAME,
  R2_PUBLIC_URL: process.env.R2_PUBLIC_URL,
})"
```

### 步骤 2: 运行验证脚本

```bash
pnpm tsx scripts/verify-r2-upload.ts
```

**预期输出**:
```
✅ 已上传映射文件: mappings/actor-name-map.json
📦 已创建备份: mappings/backups/actor-name-map-1711875000000.json
✅ 已上传映射文件: mappings/unmapped-actors.json
📦 已创建备份: mappings/backups/unmapped-actors-1711875000000.json
✅ 所有映射文件上传完成
```

### 步骤 3: 运行小批量爬虫

```bash
MAX_ACTORS=10 pnpm crawl:actor
```

**检查日志**:
- [ ] 看到 "✅ 映射表已保存到本地文件"
- [ ] 看到 "📤 上传映射文件到 R2..."
- [ ] 看到 "✅ 映射文件已上传到 R2"
- [ ] 没有报错信息

### 步骤 4: 验证 R2 文件

**方法 1: Cloudflare Dashboard**
1. 登录 Cloudflare
2. 进入 R2 → 选择存储桶
3. 导航到 `mappings/` 目录
4. 检查文件是否存在：
   - `actor-name-map.json`
   - `unmapped-actors.json`
   - `backups/` 目录

**方法 2: wrangler CLI**
```bash
wrangler r2 object list starye-assets --prefix mappings/
```

### 步骤 5: 验证 Dashboard 功能

```bash
# 确保本地服务运行
pnpm dev

# 访问 Dashboard
open http://localhost:8080/name-mapping-management
# 应该能看到未匹配清单

open http://localhost:8080/mapping-quality-report
# 应该能看到质量指标
```

## GitHub Actions 配置

### 添加 Secrets

在 GitHub 仓库 → Settings → Secrets and variables → Actions 中添加：

```
UPLOAD_MAPPINGS_TO_R2=true
CLOUDFLARE_ACCOUNT_ID=xxx
R2_ACCESS_KEY_ID=xxx
R2_SECRET_ACCESS_KEY=xxx
R2_BUCKET_NAME=starye-assets
R2_PUBLIC_URL=https://cdn.starye.com
```

### 更新 Workflow 文件

**`.github/workflows/daily-actor-crawl.yml`**:

```yaml
env:
  # ... 现有环境变量 ...
  UPLOAD_MAPPINGS_TO_R2: ${{ secrets.UPLOAD_MAPPINGS_TO_R2 }}
  CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
  R2_ACCESS_KEY_ID: ${{ secrets.R2_ACCESS_KEY_ID }}
  R2_SECRET_ACCESS_KEY: ${{ secrets.R2_SECRET_ACCESS_KEY }}
  R2_BUCKET_NAME: ${{ secrets.R2_BUCKET_NAME }}
  R2_PUBLIC_URL: ${{ secrets.R2_PUBLIC_URL }}
```

同样更新 `.github/workflows/daily-publisher-crawl.yml`。

## 故障排除

### 问题 1: 上传失败 - "R2 配置无效"

**原因**: 环境变量未正确配置

**解决**:
```bash
# 检查每个变量
echo $CLOUDFLARE_ACCOUNT_ID
echo $R2_ACCESS_KEY_ID
echo $R2_SECRET_ACCESS_KEY
echo $R2_BUCKET_NAME

# 确保没有空值或错误
```

### 问题 2: 上传失败 - "getaddrinfo ENOTFOUND"

**原因**: CLOUDFLARE_ACCOUNT_ID 为空或格式错误

**解决**:
1. 检查 CLOUDFLARE_ACCOUNT_ID 是否正确（32位十六进制字符串）
2. 确保没有前后空格
3. 重启爬虫进程

### 问题 3: Dashboard 显示 "未找到未匹配清单"

**原因**: R2 中没有映射文件

**解决**:
1. 检查爬虫日志确认是否上传成功
2. 在 Cloudflare R2 控制台检查 `mappings/` 目录
3. 手动运行验证脚本上传测试数据：
   ```bash
   pnpm tsx scripts/verify-r2-upload.ts
   ```

### 问题 4: API 返回 "R2 存储桶未配置"

**原因**: `apps/api/wrangler.toml` 中缺少 R2 绑定

**解决**:
1. 检查 `wrangler.toml`:
   ```toml
   [[r2_buckets]]
   binding = "BUCKET"
   bucket_name = "starye-assets"
   ```
2. 重启 API 服务：`pnpm dev`

## 安全注意事项

### 访问密钥管理

- ✅ **不要** 将 `.env` 文件提交到 Git
- ✅ **不要** 在日志中输出完整的访问密钥
- ✅ **定期轮换** R2 API Token（建议每3个月）
- ✅ **最小权限** 原则：仅授予必要的读写权限

### R2 存储桶权限

**推荐配置**:
- 映射文件目录 (`mappings/`): **私有**，仅通过 API 访问
- 图片文件目录 (`actors/`, `publishers/`): **公开**，通过 CDN 访问

**配置方式**:
```bash
# 使用 R2 Bucket Policies（未来功能）
# 或通过 Cloudflare Access 控制访问
```

## 成本监控

### 预期使用量

**存储**:
- 映射文件：约 5 MB
- 备份文件（保留 50 个版本）：约 250 MB
- 总计：< 300 MB

**操作**:
- 写入：每天 5 次 × 30 天 = 150 次/月
- 读取：每天 100 次 × 30 天 = 3000 次/月

### 成本估算（Cloudflare R2 定价）

- 存储：300 MB = $0.015/GB × 0.3 GB = $0.0045/月
- 写入：150 次 = $4.50/百万次 × 0.00015 = $0.0007/月
- 读取：3000 次 = $0.36/百万次 × 0.003 = $0.001/月

**总成本**: < $0.01/月

### 成本优化

如果使用量增加，可以：
1. **启用 KV 缓存** - 减少 R2 读取次数
2. **清理旧备份** - 仅保留最近 30 天的备份
3. **压缩传输** - 使用 gzip 压缩文件

## 总结

通过配置 `UPLOAD_MAPPINGS_TO_R2=true` 和相关 R2 环境变量，可以实现：

- ✅ 映射文件自动上传和备份
- ✅ Dashboard 在线查看和管理
- ✅ 多用户协作
- ✅ 版本管理和审计
- ✅ 极低成本（< $0.01/月）

配置完成后，名字映射管理工作流将完全自动化！
