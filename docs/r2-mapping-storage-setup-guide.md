# R2 映射文件存储配置指南

**创建日期**: 2026-03-31
**版本**: 1.0

## 概述

为了让 Dashboard 的名字映射管理功能完全可用，需要配置 R2 存储来保存映射文件。

## 配置步骤

### 1. 环境变量配置

在 `packages/crawler/.env` 中添加以下变量：

```env
# R2 映射文件上传开关（默认 false）
UPLOAD_MAPPINGS_TO_R2=true

# R2 存储配置（如果已配置图片上传，以下变量应该已存在）
CLOUDFLARE_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key_id
R2_SECRET_ACCESS_KEY=your_secret_access_key
R2_BUCKET_NAME=your_bucket_name
R2_PUBLIC_URL=https://your-cdn-domain.com
```

### 2. 爬虫自动上传

当 `UPLOAD_MAPPINGS_TO_R2=true` 时，女优和厂商爬虫会在运行结束时自动将以下文件上传到 R2：

**上传的文件**:
- `mappings/actor-name-map.json` - 女优名字映射表
- `mappings/publisher-name-map.json` - 厂商名字映射表
- `mappings/unmapped-actors.json` - 未匹配女优清单
- `mappings/unmapped-publishers.json` - 未匹配厂商清单
- `mappings/backups/actor-name-map-{timestamp}.json` - 女优映射表备份
- `mappings/backups/publisher-name-map-{timestamp}.json` - 厂商映射表备份

**文件格式**:
```json
{
  "metadata": {
    "version": "2026-03-31T10:30:00.000Z",
    "uploadedAt": 1711875000000,
    "totalEntries": 15000,
    "source": "index-crawler"
  },
  "data": {
    "三佳詩": {
      "javbusName": "三佳詩",
      "wikiName": "三佳詩",
      "wikiUrl": "https://seesaawiki.jp/w/sougouwiki/d/%E4%B8%89%E4%BD%B3%E8%A9%A9",
      "lastUpdated": 1711875000
    }
  }
}
```

### 3. API 端点配置

确保 `apps/api/wrangler.toml` 中配置了 R2 绑定：

```toml
[[r2_buckets]]
binding = "BUCKET"
bucket_name = "your-bucket-name"
```

### 4. 验证配置

运行女优爬虫，检查是否成功上传：

```bash
# 设置环境变量
export UPLOAD_MAPPINGS_TO_R2=true

# 运行女优爬虫（小批量测试）
MAX_ACTORS=10 pnpm crawl:actor

# 检查日志
# 应该看到 "✅ 映射文件已上传到 R2"
```

## 工作流程

### 典型使用场景

#### 场景 1: 每周自动更新（推荐）

**GitHub Actions 配置**:

在 `.github/workflows/daily-actor-crawl.yml` 中添加环境变量：

```yaml
env:
  UPLOAD_MAPPINGS_TO_R2: 'true'
  CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
  R2_ACCESS_KEY_ID: ${{ secrets.R2_ACCESS_KEY_ID }}
  R2_SECRET_ACCESS_KEY: ${{ secrets.R2_SECRET_ACCESS_KEY }}
  R2_BUCKET_NAME: ${{ secrets.R2_BUCKET_NAME }}
  R2_PUBLIC_URL: ${{ secrets.R2_PUBLIC_URL }}
```

**工作流程**:
1. GitHub Actions 每天运行女优爬虫
2. 爬虫运行结束时自动上传映射文件到 R2
3. Dashboard 实时从 R2 读取最新映射数据
4. 管理员可通过 Dashboard 查看未匹配清单和质量报告

#### 场景 2: 手动触发更新

```bash
# 本地运行索引爬虫（需要先配置环境变量）
cd packages/crawler
export UPLOAD_MAPPINGS_TO_R2=true
pnpm crawl:actor

# 或运行厂商爬虫
pnpm crawl:publisher
```

#### 场景 3: 手动添加映射

通过 Dashboard 添加的映射会自动：
1. 更新 R2 中的映射表文件
2. 创建备份版本
3. 从未匹配清单中移除
4. 记录操作者信息

## 数据流程图

```
┌─────────────────────┐
│ 女优/厂商爬虫        │
│ (本地 / GitHub)     │
└──────────┬──────────┘
           │
           │ saveMappings()
           ↓
┌─────────────────────┐
│ 本地映射文件         │
│ .seesaawiki-*.json  │
└──────────┬──────────┘
           │
           │ uploadAllMappings()
           │ (if UPLOAD_MAPPINGS_TO_R2=true)
           ↓
┌─────────────────────┐
│ R2 存储桶           │
│ mappings/*.json     │
│ + backups/          │
└──────────┬──────────┘
           │
           │ R2 GET API
           ↓
┌─────────────────────┐
│ Dashboard API       │
│ /admin/crawlers/*   │
└──────────┬──────────┘
           │
           │ fetchApi()
           ↓
┌─────────────────────┐
│ Dashboard 前端      │
│ 映射管理/质量报告    │
└─────────────────────┘
```

## 文件结构

### R2 存储结构

```
R2 Bucket: starye-assets
├── mappings/
│   ├── actor-name-map.json          # 女优名字映射表（最新版本）
│   ├── publisher-name-map.json      # 厂商名字映射表（最新版本）
│   ├── unmapped-actors.json         # 未匹配女优清单
│   ├── unmapped-publishers.json     # 未匹配厂商清单
│   ├── series-to-publisher-map.json # 系列→厂商映射（可选）
│   └── backups/
│       ├── actor-name-map-1711875000000.json
│       ├── actor-name-map-1711961400000.json
│       ├── publisher-name-map-1711875000000.json
│       └── ...
├── actors/
│   └── {actor-id}/avatar-preview.webp
└── publishers/
    └── {publisher-id}/logo-preview.webp
```

### 本地文件（保持兼容）

```
packages/crawler/
├── .seesaawiki-actor-map.json
├── .seesaawiki-publisher-map.json
├── .seesaawiki-unmapped-actors.json
├── .seesaawiki-unmapped-publishers.json
└── .series-to-publisher-map.json
```

## 版本管理

### 备份策略

**自动备份**:
- 每次更新映射表时自动创建带时间戳的备份
- 备份保留在 `mappings/backups/` 目录
- 文件名格式：`{type}-name-map-{timestamp}.json`

**手动备份**:
```bash
# 通过 API 查看版本历史
curl http://localhost:8787/api/admin/crawlers/mapping-versions?type=actor \
  -H "Cookie: better-auth.session_token=xxx"
```

### 回滚操作

如果需要回滚到某个历史版本：

```bash
# 1. 在 Cloudflare R2 控制台中找到备份文件
# 2. 下载备份文件
# 3. 重命名为主文件名
# 4. 重新上传
```

或者通过 API 实现（TODO）：
```typescript
POST / api / admin / crawlers / restore - mapping
```

## 性能优化

### R2 读取缓存

API 端点从 R2 读取映射文件时可以添加缓存：

```typescript
// 使用 Cloudflare Workers KV 缓存（可选）
const cached = await c.env.KV_NAMESPACE.get('mapping-cache:actors')
if (cached) {
  return c.json({ data: JSON.parse(cached) })
}

// 从 R2 读取...
const data = await fetchFromR2()

// 缓存 1 小时
await c.env.KV_NAMESPACE.put(
  'mapping-cache:actors',
  JSON.stringify(data),
  { expirationTtl: 3600 }
)
```

### 文件大小监控

预期文件大小（参考）：
- `actor-name-map.json`: 约 2-5 MB（15000-20000 条）
- `publisher-name-map.json`: 约 50-100 KB（126 条）
- `unmapped-actors.json`: 约 200-500 KB（1000-2000 条）

如果文件过大（> 10 MB），考虑：
1. 分片存储（按五十音行）
2. 压缩传输（gzip）
3. 增量更新（仅传输变更部分）

## 安全注意事项

### 访问控制

R2 存储桶应配置为：
- **私有访问**：映射文件仅通过 API 访问
- **公开访问**：图片文件可公开访问

### 审计日志

手动添加的映射会记录：
- 操作时间
- 操作者（user.email）
- 修改内容

建议定期查看 `metadata.lastModifiedBy` 字段。

## 故障排除

### 问题 1: 上传失败

**症状**: 爬虫日志显示 "❌ 保存映射表失败"

**排查**:
1. 检查 R2 配置是否正确：`echo $CLOUDFLARE_ACCOUNT_ID`
2. 检查 R2 访问密钥是否有效
3. 检查网络连接

### 问题 2: API 返回空数据

**症状**: Dashboard 显示 "未找到未匹配清单"

**排查**:
1. 检查 R2 中是否存在文件：登录 Cloudflare Dashboard → R2 → 查看 mappings/ 目录
2. 检查文件格式是否正确（JSON）
3. 检查 API 的 R2 绑定：`wrangler.toml` 中的 `[[r2_buckets]]`

### 问题 3: 映射冲突

**症状**: 质量报告显示 conflictCount > 0

**处理**:
1. 访问名字映射管理页面
2. 导出映射表（TODO: 添加导出功能）
3. 人工审核冲突项
4. 手动修正或删除错误映射

## 监控指标

建议监控的关键指标：

| 指标 | 目标值 | 告警阈值 |
|------|--------|----------|
| 女优覆盖率 | > 90% | < 85% |
| 厂商覆盖率 | > 10% | < 5% |
| 映射冲突数 | < 10 | > 20 |
| 高优先级未映射 | < 20 | > 50 |
| R2 上传成功率 | 100% | < 95% |
| 映射文件大小 | < 5 MB | > 10 MB |

## 相关文档

- [Dashboard 名字映射功能使用指南](./dashboard-name-mapping-features-guide.md)
- [名字映射表维护指南](./name-mapping-maintenance-guide.md)
- [未匹配女优审核流程](./actor-mapping-audit-process.md)

## 技术实现

### 核心文件

**爬虫侧**:
- `packages/crawler/src/lib/mapping-file-manager.ts` - R2 上传管理器
- `packages/crawler/src/lib/name-mapper.ts` - 名字映射器（集成 R2 上传）
- `packages/crawler/src/crawlers/actor-crawler.ts` - 女优爬虫（配置 R2 上传）
- `packages/crawler/src/crawlers/publisher-crawler.ts` - 厂商爬虫（配置 R2 上传）

**API 侧**:
- `apps/api/src/routes/admin/crawlers/index.ts` - 映射管理 API 端点

### 数据一致性

**写入流程**:
1. 爬虫保存到本地文件（`.seesaawiki-*.json`）
2. 同时上传到 R2（如果启用）
3. 创建备份版本

**读取流程**:
1. Dashboard API 从 R2 读取
2. 如果 R2 不可用，返回提示信息
3. 前端显示数据或提示

**冲突处理**:
- 本地文件为主（爬虫直接写入）
- R2 为备份和分发（API 读取）
- 手动添加的映射优先写入 R2，下次爬虫运行时会同步到本地

## 成本估算

### R2 存储成本

按照 Cloudflare R2 定价（2026）：

**存储成本**:
- 每 GB 每月：$0.015
- 预计使用：约 50 MB（映射文件 + 备份）
- 月成本：< $0.01

**操作成本**:
- Class A 操作（写入）：$4.50 / 百万次
- Class B 操作（读取）：$0.36 / 百万次
- 预计操作：
  - 写入：每天 5 次（爬虫上传）× 30 天 = 150 次/月
  - 读取：每天 100 次（Dashboard 访问）× 30 天 = 3000 次/月
- 月成本：< $0.01

**总成本**: < $0.02/月（几乎可忽略）

## 总结

R2 存储配置后：
- ✅ Dashboard 映射管理功能完全可用
- ✅ 映射数据自动备份和版本管理
- ✅ 支持多用户协作（通过 Dashboard 添加映射）
- ✅ 生产环境和本地环境数据同步
- ✅ 成本极低，几乎无需额外开销

配置完成后，映射管理工作流将完全自动化！
