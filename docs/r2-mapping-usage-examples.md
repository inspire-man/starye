# R2 映射存储使用示例

**场景**: 运维人员配置和使用 R2 映射存储功能

## 示例 1: 本地开发环境配置

### 操作步骤

```bash
# 1. 进入爬虫目录
cd packages/crawler

# 2. 复制环境变量模板
cp .env.example .env

# 3. 编辑 .env 文件
nano .env

# 添加以下内容:
UPLOAD_MAPPINGS_TO_R2=true
CLOUDFLARE_ACCOUNT_ID=abc123def456...
R2_ACCESS_KEY_ID=your_key_id
R2_SECRET_ACCESS_KEY=your_secret_key
R2_BUCKET_NAME=starye-assets
R2_PUBLIC_URL=https://cdn.starye.com

# 4. 验证配置
pnpm tsx scripts/verify-r2-upload.ts
```

### 预期输出

```
🚀 验证 R2 映射文件上传功能

📋 R2 配置:
   Account ID: abc123de...
   Bucket: starye-assets
   Public URL: https://cdn.starye.com

📤 开始上传测试数据...
✅ 已上传映射文件: mappings/actor-name-map.json
   版本: 2026-03-31T10:30:00.000Z
   条目数: 1
📦 已创建备份: mappings/backups/actor-name-map-1711875000000.json
✅ 已上传映射文件: mappings/unmapped-actors.json
   版本: 2026-03-31T10:30:00.000Z
   条目数: 1
📦 已创建备份: mappings/backups/unmapped-actors-1711875000000.json

✅ 所有映射文件上传完成

✅ 验证成功！R2 映射文件上传功能正常

📝 下一步：
   1. 在 .env 中设置 UPLOAD_MAPPINGS_TO_R2=true
   2. 运行女优爬虫：MAX_ACTORS=10 pnpm crawl:actor
   3. 检查日志确认 "✅ 映射文件已上传到 R2"
   4. 访问 Dashboard 验证数据可见
```

## 示例 2: 运行小批量爬虫测试

### 操作步骤

```bash
cd packages/crawler

# 运行 10 个女优的爬虫（约 2-3 分钟）
MAX_ACTORS=10 UPLOAD_MAPPINGS_TO_R2=true pnpm crawl:actor
```

### 关键日志输出

```
🎬 启动女优详情爬虫
📊 配置信息:
  最大女优数: 10
  并发数: 2
  延迟: 8000ms
  API URL: http://localhost:8787

[NameMapper] 加载女优映射表: 0 条

📥 获取待爬取女优列表...
✓ 获取到 10 个待爬取女优

[1/10] 爬取女优: 三佳詩
  JavBus URL: https://www.javbus.com/star/abc
  作品数: 5

🔍 匹配 SeesaaWiki 名字...
[NameMapper] ✅ 精确匹配成功: 三佳詩
✅ 匹配成功: 三佳詩 -> 三佳詩
Wiki URL: https://seesaawiki.jp/w/sougouwiki/d/%E4%B8%89%E4%BD%B3%E8%A9%A9

📡 爬取 SeesaaWiki 详情...
✅ 女优数据获取成功
数据完整度: 85%

📤 上传头像到 R2...
✅ 头像已上传: ***/actors/xxx/avatar-preview.webp

✅ 成功

...（处理其他女优）...

[NameMapper] ✅ 映射表已保存到本地文件
[NameMapper] 📤 上传映射文件到 R2...

📤 批量上传映射文件到 R2...
✅ 已上传映射文件: mappings/actor-name-map.json
   版本: 2026-03-31T10:35:42.123Z
   条目数: 8
📦 已创建备份: mappings/backups/actor-name-map-1711875342123.json
  ✅ 女优名字映射表

✅ 已上传映射文件: mappings/unmapped-actors.json
   版本: 2026-03-31T10:35:43.456Z
   条目数: 2
📦 已创建备份: mappings/backups/unmapped-actors-1711875343456.json
  ✅ 未匹配女优清单

✅ 所有映射文件上传完成

[NameMapper] ✅ 映射文件已上传到 R2

📊 运行统计:
  处理女优: 10
  成功: 8
  失败: 0
  跳过: 2
  名字映射失败: 2
  平均数据完整度: 75.2%

✅ 女优爬虫运行完成
```

## 示例 3: 通过 Dashboard 添加映射

### 操作步骤

1. **访问映射管理页面**:
   ```
   http://localhost:8080/name-mapping-management
   ```

2. **查看未匹配清单**:
   - 切换到"女优"标签
   - 看到 2 个未匹配女优
   - 按优先级排序（P0-P3）

3. **添加映射**:
   - 点击某个未匹配女优旁的"添加映射"按钮
   - 或在右侧表单填写：
     ```
     类型: 女优
     JavBus 名字: 未知女优1
     SeesaaWiki URL: https://seesaawiki.jp/w/sougouwiki/d/%E6%9C%AA%E7%9F%A5%E5%A5%B3%E4%BC%981
     ```
   - 点击"添加映射"

4. **验证结果**:
   - 看到成功提示："✅ 映射添加成功"
   - 未匹配清单自动刷新，该女优消失
   - 映射数量增加 1

### API 日志输出

```
[Crawlers/AddMapping] ✅ 添加 actor 映射: 未知女优1 -> 未知女優1
[Crawlers/AddMapping] 📦 已创建备份: mappings/backups/actor-name-map-1711875400000.json
[Crawlers/AddMapping] ✅ 已从未匹配清单移除: 未知女优1
```

## 示例 4: 查看映射质量报告

### 操作步骤

```
http://localhost:8080/mapping-quality-report
```

### 显示内容

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
映射质量报告

总体质量评分
┌─────────────────────────────────────┐
│                                     │
│         85 分 (B 级)                │
│                                     │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  ███████████████████░░░░░░░░░░░░   │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                     │
└─────────────────────────────────────┘

女优映射覆盖率: 89.2%
  总女优数: 15234
  已映射: 13589
  未映射: 1645
  高优先级未映射 (作品数 > 50): 42

厂商映射覆盖率: 12.7%
  总厂商数: 126
  已映射: 16
  未映射: 110

质量问题
  映射冲突: 3
  失效映射: 0

改进建议
  1. 优先处理 42 个高优先级未映射女优
  2. 解决 3 个映射冲突
  3. 提升厂商覆盖率（当前 12.7%）
```

## 示例 5: 查询版本历史

### API 调用

```bash
curl http://localhost:8787/api/admin/crawlers/mapping-versions?type=actor \
  -H "Authorization: Bearer $CRAWLER_SECRET" | jq
```

### 响应示例

```json
{
  "data": [
    {
      "key": "mappings/backups/actor-name-map-1711875400000.json",
      "version": "2026-03-31T10:36:40.000Z",
      "uploadedAt": 1711875400000,
      "totalEntries": 13590,
      "source": "api",
      "size": 2845632
    },
    {
      "key": "mappings/backups/actor-name-map-1711875342123.json",
      "version": "2026-03-31T10:35:42.123Z",
      "uploadedAt": 1711875342123,
      "totalEntries": 13589,
      "source": "index-crawler",
      "size": 2845001
    },
    {
      "key": "mappings/backups/actor-name-map-1711788942000.json",
      "version": "2026-03-30T10:35:42.000Z",
      "uploadedAt": 1711788942000,
      "totalEntries": 13200,
      "source": "index-crawler",
      "size": 2756432
    }
  ]
}
```

**分析**:
- 最新版本：2026-03-31 10:36（通过 API 手动添加）
- 条目增加：13589 → 13590（+1）
- 来源：api（说明是通过 Dashboard 添加的）

## 示例 6: 生产环境部署

### GitHub Actions 配置

编辑 `.github/workflows/daily-actor-crawl.yml`:

```yaml
name: Daily Actor Crawl

on:
  schedule:
    - cron: '0 2 * * *' # 每天凌晨 2 点
  workflow_dispatch:

jobs:
  crawl:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: pnpm

      - run: pnpm install

      - name: Run Actor Crawler
        env:
          UPLOAD_MAPPINGS_TO_R2: 'true' # ✅ 启用 R2 上传
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          R2_ACCESS_KEY_ID: ${{ secrets.R2_ACCESS_KEY_ID }}
          R2_SECRET_ACCESS_KEY: ${{ secrets.R2_SECRET_ACCESS_KEY }}
          R2_BUCKET_NAME: ${{ secrets.R2_BUCKET_NAME }}
          R2_PUBLIC_URL: ${{ secrets.R2_PUBLIC_URL }}
          API_URL: ${{ secrets.API_URL }}
          CRAWLER_SECRET: ${{ secrets.CRAWLER_SECRET }}
          PUPPETEER_EXECUTABLE_PATH: /usr/bin/google-chrome-stable
        run: |
          cd packages/crawler
          pnpm crawl:actor
```

### 手动触发测试

```bash
# 触发 workflow
gh workflow run daily-actor-crawl.yml

# 查看运行状态
gh run watch

# 查看日志（找到最新的 run）
gh run view --log
```

### 验证日志

在 GitHub Actions 日志中搜索：
- `✅ 映射表已保存到本地文件`
- `📤 上传映射文件到 R2...`
- `✅ 映射文件已上传到 R2`

## 示例 7: 使用 Cloudflare Dashboard 查看文件

### 步骤

1. 登录 https://dash.cloudflare.com
2. 点击左侧菜单 "R2"
3. 选择存储桶 "starye-assets"
4. 导航到 `mappings/` 目录

### 文件列表

```
mappings/
├── actor-name-map.json          (2.8 MB)  最后修改: 1 分钟前
├── publisher-name-map.json      (50 KB)   最后修改: 1 分钟前
├── unmapped-actors.json         (200 KB)  最后修改: 1 分钟前
├── unmapped-publishers.json     (30 KB)   最后修改: 1 分钟前
└── backups/
    ├── actor-name-map-1711875400000.json    (2.8 MB)
    ├── actor-name-map-1711875342123.json    (2.8 MB)
    ├── publisher-name-map-1711875350000.json (50 KB)
    └── ... (共 8 个备份文件)
```

### 查看文件内容

点击 `actor-name-map.json` → Preview:

```json
{
  "metadata": {
    "version": "2026-03-31T10:36:40.000Z",
    "uploadedAt": 1711875400000,
    "totalEntries": 13590,
    "source": "api",
    "lastModifiedBy": "admin@starye.com"
  },
  "data": {
    "三佳詩": {
      "javbusName": "三佳詩",
      "wikiName": "三佳詩",
      "wikiUrl": "https://seesaawiki.jp/w/sougouwiki/d/%E4%B8%89%E4%BD%B3%E8%A9%A9",
      "lastUpdated": 1711875000
    },
    "明日花キララ": {
      "javbusName": "明日花キララ",
      "wikiName": "明日花キララ",
      "wikiUrl": "https://seesaawiki.jp/w/sougouwiki/d/%E6%98%8E%E6%97%A5%E8%8A%B1%E3%82%AD%E3%83%A9%E3%83%A9",
      "lastUpdated": 1711875000
    }
  }
}
```

## 示例 8: 故障排除 - R2 上传失败

### 症状

爬虫日志显示：

```
[NameMapper] ✅ 映射表已保存到本地文件
[NameMapper] 📤 上传映射文件到 R2...
[NameMapper] ❌ 保存映射表失败 Error: Invalid credentials
```

### 排查步骤

```bash
# 1. 验证环境变量
cd packages/crawler
node -e "require('dotenv').config(); console.log({
  UPLOAD_MAPPINGS_TO_R2: process.env.UPLOAD_MAPPINGS_TO_R2,
  R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID ? '✓' : '✗',
  R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY ? '✓' : '✗',
})"

# 2. 测试 R2 连接
pnpm tsx scripts/verify-r2-upload.ts

# 3. 如果验证脚本也失败，检查密钥
# 登录 Cloudflare Dashboard → R2 → Manage R2 API Tokens
# 创建新的 API Token 并更新 .env

# 4. 重新运行爬虫
MAX_ACTORS=10 pnpm crawl:actor
```

### 解决方案

**原因**: R2 访问密钥过期或无效

**修复**:
1. 在 Cloudflare Dashboard 创建新的 R2 API Token
2. 更新 `packages/crawler/.env`:
   ```bash
   R2_ACCESS_KEY_ID=new_key_id
   R2_SECRET_ACCESS_KEY=new_secret_key
   ```
3. 重新运行验证脚本确认

## 示例 9: 手动添加映射（Dashboard）

### 场景

管理员发现一个重要女优未匹配到 SeesaaWiki，需要手动添加映射。

### 操作步骤

1. **访问映射管理页面**:
   ```
   http://localhost:8080/name-mapping-management
   ```

2. **查找未匹配女优**:
   - 在搜索框输入女优名字（如 "波多野結衣"）
   - 或在未匹配清单中滚动查找
   - 点击女优名字查看详情（作品数、最后尝试时间）

3. **找到 SeesaaWiki URL**:
   - 打开新标签：https://seesaawiki.jp/w/sougouwiki/
   - 搜索女优名字
   - 复制页面 URL（如 `https://seesaawiki.jp/w/sougouwiki/d/%E6%B3%A2%E5%A4%9A%E9%87%8E%E7%B5%90%E8%A1%A3`）

4. **添加映射**:
   - 在 Dashboard 右侧表单：
     - 类型：女优
     - JavBus 名字：波多野結衣
     - SeesaaWiki URL：https://seesaawiki.jp/w/sougouwiki/d/%E6%B3%A2%E5%A4%9A%E9%87%8E%E7%B5%90%E8%A1%A3
   - 点击"添加映射"

5. **验证**:
   - 看到成功消息
   - 未匹配清单刷新，该女优消失
   - 切换到"映射质量报告"页面
   - 女优覆盖率增加 0.01%

### 后端处理流程

```
API 收到请求
  ↓
验证权限和参数
  ↓
从 R2 读取现有映射表
  ↓
添加新映射到数据对象
  ↓
保存回 R2（覆盖主文件）
  ↓
创建带时间戳的备份
  ↓
从未匹配清单移除该项
  ↓
返回成功响应
```

## 示例 10: 监控和维护

### 每周检查脚本

```bash
#!/bin/bash
# weekly-mapping-check.sh

echo "📊 每周映射质量检查"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 1. 获取质量指标
METRICS=$(curl -s http://localhost:8787/api/admin/crawlers/mapping-quality \
  -H "Authorization: Bearer $CRAWLER_SECRET")

ACTOR_COVERAGE=$(echo $METRICS | jq -r '.data.mappedActors / .data.totalActors * 100')
HIGH_PRIORITY=$(echo $METRICS | jq -r '.data.highPriorityUnmapped')
CONFLICTS=$(echo $METRICS | jq -r '.data.conflictCount')

echo ""
echo "女优覆盖率: ${ACTOR_COVERAGE}%"
echo "高优先级未映射: ${HIGH_PRIORITY} 个"
echo "映射冲突: ${CONFLICTS} 个"
echo ""

# 2. 告警检查
if (( $(echo "$ACTOR_COVERAGE < 85" | bc -l) )); then
  echo "⚠️  告警：女优覆盖率低于 85%"
fi

if (( $HIGH_PRIORITY > 50 )); then
  echo "⚠️  告警：高优先级未映射女优超过 50 个"
fi

if (( $CONFLICTS > 20 )); then
  echo "⚠️  告警：映射冲突超过 20 个"
fi

# 3. 备份检查
BACKUP_COUNT=$(wrangler r2 object list starye-assets --prefix mappings/backups/ | wc -l)
echo "备份文件数量: ${BACKUP_COUNT}"

if (( $BACKUP_COUNT > 100 )); then
  echo "⚠️  建议：清理旧备份文件（保留最近 50 个）"
fi

echo ""
echo "✅ 每周检查完成"
```

## 示例 11: 清理旧备份

### 手动清理

```bash
# 列出所有备份（按时间排序）
wrangler r2 object list starye-assets --prefix mappings/backups/ | sort

# 删除 30 天前的备份
# （需要手动执行，或创建自动化脚本）
wrangler r2 object delete starye-assets/mappings/backups/actor-name-map-1708000000000.json
```

### 自动化清理（未来功能）

创建 GitHub Actions workflow:

```yaml
name: Cleanup Old Mapping Backups

on:
  schedule:
    - cron: '0 3 1 * *' # 每月 1 号凌晨 3 点

jobs:
  cleanup:
    runs-on: ubuntu-latest
    steps:
      - name: Delete backups older than 30 days
        run: |
          # 使用 wrangler 或 AWS CLI 删除旧文件
          # 保留最近 50 个备份
```

## 最佳实践总结

### 开发环境

1. ✅ 始终先运行 `verify-r2-upload.ts` 验证配置
2. ✅ 使用小批量测试（MAX_ACTORS=10）
3. ✅ 检查日志确认上传成功
4. ✅ 通过 Dashboard 验证数据可见

### 生产环境

1. ✅ 在 GitHub Secrets 配置所有环境变量
2. ✅ 手动触发首次爬虫，监控日志
3. ✅ 验证 R2 文件存在
4. ✅ 设置告警监控（覆盖率、冲突数）
5. ✅ 定期审核高优先级未匹配清单

### 维护建议

1. ✅ 每周检查映射质量
2. ✅ 每月清理旧备份（保留 30-50 个）
3. ✅ 及时处理高优先级未匹配（P0-P1）
4. ✅ 记录人工添加的映射原因

---

**更多示例和详细说明**，请参考：
- [快速部署指南](./r2-mapping-quick-deploy-guide.md)
- [配置指南](./r2-mapping-storage-setup-guide.md)
- [实施报告](./r2-mapping-storage-implementation-report.md)
