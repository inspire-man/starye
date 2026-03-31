# SeesaaWiki 数据源集成 - 回滚计划

**变更名称**: integrate-seesaawiki-data-source  
**创建日期**: 2026-03-31  
**目的**: 如果 SeesaaWiki 集成出现严重问题，可快速回滚到 JavBus 单一数据源

## 回滚决策标准

### 何时需要回滚

满足以下任一条件时，应考虑回滚：

| 场景 | 严重程度 | 回滚决策 |
|------|---------|---------|
| **女优爬虫成功率 < 50%** | P0 | **立即回滚** |
| **SeesaaWiki 完全不可访问 > 3天** | P0 | **立即回滚** |
| **名字映射表损坏导致批量失败** | P0 | **立即回滚** |
| **数据库字段错误导致前端崩溃** | P0 | **立即回滚** |
| 女优爬虫成功率 50-70% | P1 | 评估后决定 |
| SeesaaWiki 间歇性不可访问 | P2 | 暂不回滚，监控 |
| 少量女优映射错误 | P3 | 无需回滚，修复即可 |

### 不需要回滚的情况

以下情况**无需回滚**，可通过修复解决：

- ✅ 个别女优映射错误：人工修正映射表即可
- ✅ 厂商爬虫成功率低：预期内（SeesaaWiki 厂商页面少）
- ✅ 爬虫性能下降 < 2倍：可接受范围
- ✅ 映射表文件过大：可优化存储方式

## 回滚步骤

### 第 1 步：评估影响范围

```bash
# 检查女优爬虫成功率
cat .actor-crawl-log.json | jq '.successRate'

# 检查厂商爬虫成功率
cat .publisher-crawl-log.json | jq '.successRate'

# 检查最近错误日志
gh run list --workflow daily-actor-crawl.yml --limit 5
```

**决策点**:
- 成功率 < 50%: 立即回滚
- 成功率 50-70%: 评估是否为临时问题
- 成功率 > 70%: 无需回滚

### 第 2 步：创建回滚分支

```bash
# 基于当前 main 分支创建回滚分支
git checkout main
git pull origin main
git checkout -b rollback/seesaawiki-integration

# 记录回滚原因
echo "回滚原因: <填写原因>" > ROLLBACK_REASON.md
git add ROLLBACK_REASON.md
git commit -m "docs: 记录回滚原因"
```

### 第 3 步：还原代码更改

#### 3.1 还原女优爬虫

**文件**: `packages/crawler/src/crawlers/actor-crawler.ts`

**操作**: 移除 SeesaaWiki 集成，恢复纯 JavBus 实现

<details>
<summary>查看需要还原的关键代码</summary>

```typescript
// 移除 SeesaaWiki 策略导入
- import { SeesaaWikiStrategy } from '../strategies/seesaawiki/seesaawiki-strategy'
- import { NameMapper } from '../lib/name-mapper'

// 移除名字映射逻辑
- this.nameMapper = new NameMapper(...)

// 简化 crawlActorDetails 方法，仅使用 JavBus
protected async crawlActorDetails(actor: ActorCrawlTask): Promise<void> {
  // 直接从 JavBus 获取数据，移除 SeesaaWiki 尝试
  const actorData = await this.fetchFromJavBus(actor.sourceUrl)
  await this.saveActorData(actorData)
}
```
</details>

**验证**:
```bash
# 运行女优爬虫测试
MAX_ACTORS=5 pnpm --filter @starye/crawler crawl:actor
```

#### 3.2 还原厂商爬虫

**文件**: `packages/crawler/src/crawlers/publisher-crawler.ts`

**操作**: 同女优爬虫，移除 SeesaaWiki 集成

#### 3.3 还原影片爬虫

**文件**: `packages/crawler/src/crawlers/javbus.ts`

**操作**: 恢复系列和厂商字段逻辑

<details>
<summary>查看需要还原的关键代码</summary>

```typescript
// 恢复原始 publisher 字段逻辑（使用 "發行商"）
const movieInfo: MovieInfo = {
  // ...
  publisher: infoMap['發行商:'], // 不区分系列，直接用 "發行商"
  // 移除 series 字段
  // series: ...
}
```
</details>

#### 3.4 还原 API 路由

**文件**: `apps/api/src/routes/movies/services/sync.service.ts`

**操作**: 移除 `series` 字段处理

```typescript
// 移除 series 字段
const moviePayload = {
  // ...
  publisher: publisher || null,
  // 删除: series: series || null,
}
```

#### 3.5 还原数据库 Schema（可选）

**文件**: `apps/api/src/db/schema/movies.ts`

**选项 1（推荐）**: 保留 `series` 字段，但不再使用
- 优点：无需数据库迁移
- 缺点：留有冗余字段

**选项 2（彻底）**: 删除 `series` 字段
- 需要数据库迁移（DROP COLUMN）
- 可能影响已有数据

**建议**: 采用选项 1，保留字段但不使用。

#### 3.6 还原前端代码

**文件**: `apps/dashboard/src/views/Movies.vue`

**操作**: 移除系列字段展示

```vue
<!-- 移除系列列定义 -->
- { key: 'series', label: '系列', width: '150px' },

<!-- 移除系列输入框 -->
- <div class="form-row">
-   <label>系列</label>
-   <input v-model="editingMovie.series" ... >
- </div>
```

**文件**: `apps/dashboard/src/lib/api.ts`

```typescript
// 移除 series 字段类型定义
export interface Movie {
  // ...
  // 删除: series?: string | null
  publisher?: string | null
}
```

### 第 4 步：清理映射表文件

```bash
# 备份映射表（以防需要恢复）
cp packages/crawler/.actor-name-map.json packages/crawler/.actor-name-map.backup.json
cp packages/crawler/.publisher-name-map.json packages/crawler/.publisher-name-map.backup.json
cp packages/crawler/.series-to-publisher-map.json packages/crawler/.series-to-publisher-map.backup.json

# 删除映射表（可选，也可保留不使用）
# rm packages/crawler/.actor-name-map.json
# rm packages/crawler/.publisher-name-map.json
# rm packages/crawler/.series-to-publisher-map.json
```

### 第 5 步：测试验证

#### 5.1 本地测试

```bash
# 测试女优爬虫（纯 JavBus）
MAX_ACTORS=10 pnpm --filter @starye/crawler crawl:actor

# 测试厂商爬虫（纯 JavBus）
MAX_PUBLISHERS=10 pnpm --filter @starye/crawler crawl:publisher

# 测试影片爬虫
MAX_MOVIES=10 pnpm --filter @starye/crawler test:optimized

# 验证前端展示（无系列字段）
cd apps/dashboard
pnpm dev
# 访问 http://localhost:5173，检查影片列表和详情
```

#### 5.2 数据一致性检查

```bash
# 检查数据库：series 字段应为 null（如果保留字段）
wrangler d1 execute starye-db --command "SELECT id, title, series, publisher FROM movie LIMIT 10"

# 检查 API 响应
curl http://localhost:8787/api/movies | jq '.[0] | {title, series, publisher}'
```

### 第 6 步：部署回滚

```bash
# 提交回滚更改
git add .
git commit -m "revert: 回滚 SeesaaWiki 数据源集成

原因: <填写回滚原因>

- 移除 SeesaaWiki 策略集成
- 恢复女优/厂商爬虫到纯 JavBus 实现
- 移除系列字段展示
- 保留数据库 schema（向后兼容）
"

# 推送到远程
git push origin rollback/seesaawiki-integration

# 创建 PR
gh pr create --title "回滚: SeesaaWiki 数据源集成" \
  --body "$(cat ROLLBACK_REASON.md)" \
  --base main
```

### 第 7 步：生产环境部署

```bash
# 合并 PR（经审核后）
gh pr merge rollback/seesaawiki-integration --squash

# 触发生产部署
git checkout main
git pull origin main
git push origin main  # 触发 CI/CD
```

### 第 8 步：监控回滚后状态

```bash
# 监控爬虫日志
gh run watch

# 检查女优/厂商爬虫成功率
gh run view --log | grep "成功率"

# 验证前端功能
# 访问生产环境，检查影片列表和详情页
```

## 回滚后的数据处理

### 已抓取的 SeesaaWiki 数据

**选项 1（推荐）**: 保留数据，不清理
- 优点：保留历史数据，用户体验不变
- 缺点：数据来源混杂（JavBus + SeesaaWiki）

**选项 2**: 清理 SeesaaWiki 数据，重新爬取 JavBus
- 优点：数据来源统一
- 缺点：用户可能发现数据"变少了"

**建议**: 采用选项 1，保留已有数据，仅停止新的 SeesaaWiki 爬取。

### 数据库清理脚本（可选）

如果决定清理 SeesaaWiki 数据：

```sql
-- 清空 series 字段
UPDATE movie SET series = NULL;

-- 清空女优 SeesaaWiki 字段
UPDATE actor SET
  aliases = NULL,
  twitter = NULL,
  instagram = NULL,
  blog = NULL
WHERE wiki_url LIKE '%seesaawiki.jp%';

-- 清空厂商 SeesaaWiki 字段
UPDATE publisher SET
  website = NULL,
  twitter = NULL
WHERE wiki_url LIKE '%seesaawiki.jp%';
```

## 回滚后的重新集成

如果问题修复后需要重新集成 SeesaaWiki：

### 重新集成检查清单

- [ ] 确认 SeesaaWiki 稳定可访问
- [ ] 修复之前的根本问题
- [ ] 更新测试用例覆盖失败场景
- [ ] 进行充分的本地测试（至少 100 个女优）
- [ ] 小规模灰度发布（限制爬虫数量）
- [ ] 监控成功率 > 85% 后再全量发布

### 重新集成步骤

```bash
# 恢复 SeesaaWiki 集成分支
git checkout -b re-integrate/seesaawiki main
git merge origin/integrate-seesaawiki-data-source

# 修复问题...

# 测试验证...

# 重新提交 PR
gh pr create --title "重新集成: SeesaaWiki 数据源（已修复）" --base main
```

## 预防措施

为避免未来需要回滚，建议：

1. **灰度发布**：
   - 先在小规模测试环境验证
   - 逐步增加爬虫数量（10 → 50 → 100 → 全量）

2. **监控告警**：
   - 设置成功率低于 85% 的告警
   - 设置 SeesaaWiki 不可访问的告警

3. **降级开关**：
   - 添加环境变量 `DISABLE_SEESAAWIKI=true` 快速禁用
   - 无需代码回滚，仅切换配置

4. **自动化测试**：
   - 每日运行集成测试验证数据质量
   - 失败自动告警

## 相关文档

- [数据完整度对比报告](./data-completeness-improvement-report.md)
- [本地测试报告](./local-test-report-2026-03-31.md)
- [名字映射表维护指南](./name-mapping-maintenance-guide.md)

## 回滚记录（如发生）

### 模板

```markdown
## 回滚记录 - YYYY-MM-DD

**回滚人**: <名字>
**回滚时间**: YYYY-MM-DD HH:MM UTC
**回滚原因**: <详细原因>
**影响范围**: <受影响的功能和数据>
**恢复时间**: <从发现问题到回滚完成的时间>

### 问题描述
<详细描述遇到的问题>

### 回滚决策
<为什么决定回滚而不是修复>

### 后续行动
- [ ] 修复根本问题
- [ ] 增加测试覆盖
- [ ] 更新监控告警
- [ ] 计划重新集成
```
