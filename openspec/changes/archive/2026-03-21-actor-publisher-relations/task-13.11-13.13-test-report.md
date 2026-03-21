# 任务 13.11-13.13：爬虫与数据完整性测试报告

## 测试概况

**测试时间：** 2026-03-20  
**测试环境：** 本地开发环境  
**测试状态：** 部分完成（数据库为空）

---

## 任务 13.11：测试爬虫功能 - 自动创建女优/厂商关联

### 测试目标
验证爬虫在爬取新电影时，能够自动创建 `movie_actors` 和 `movie_publishers` 关联记录。

### 当前状态
⚠️ **功能尚未完全集成**

根据任务 3.9 的实施情况（参见 `task-3.9-status.md`），爬虫详情解析功能已实现（`crawlActorDetails` 和 `crawlPublisherDetails`），但自动关联逻辑尚未集成到主爬虫流程中。

### 实施方案
详见 `task-3-implementation-guide.md`，需要在 `run-optimized.ts` 中集成以下逻辑：

1. 调用 `crawlActorDetails(actorUrl, page)` 获取女优详情
2. 调用 `crawlPublisherDetails(publisherUrl, page)` 获取厂商详情
3. 去重检查（`source + sourceId`）
4. 失败降级处理（创建占位符记录）
5. 创建 `movie_actors` 和 `movie_publishers` 关联

### 测试步骤（待完全集成后执行）

```powershell
# 1. 清空现有数据（可选）
pnpm tsx packages/db/scripts/clean-data.ts

# 2. 配置爬虫参数
$env:MAX_MOVIES=5
$env:MAX_PAGES=1
$env:API_URL="http://localhost:8787"
$env:CRAWLER_SECRET="your-secret-from-.dev.vars"

# 3. 启动 API 服务器（如未运行）
cd apps/api
pnpm dev

# 4. 运行爬虫
cd ../..
pnpm --filter @starye/crawler run:optimized

# 5. 验证结果
# - 检查爬虫日志中是否有 "女优详情爬取成功" 和 "厂商详情爬取成功"
# - 调用 API 验证关联记录：
#   GET http://localhost:8787/api/movies/{movie-id}
#   响应应包含 actors 和 publishers 对象数组
```

### 预期结果
- ✅ 爬虫成功解析电影基本信息
- ✅ 自动爬取女优详情（avatar, bio, birthDate 等）
- ✅ 自动爬取厂商详情（logo, website 等）
- ✅ 创建 `movie_actors` 关联，按 `sortOrder` 排序
- ✅ 创建 `movie_publishers` 关联
- ✅ 更新女优/厂商的 `movieCount`
- ✅ 设置 `hasDetailsCrawled = true`（详情爬取成功时）

---

## 任务 13.12：测试爬虫失败降级

### 测试目标
模拟详情页 404 或解析失败，验证占位符记录创建逻辑。

### 测试方法

#### 方法 1：模拟网络错误（推荐）

修改 `javbus.ts` 中的 `crawlActorDetails` 临时返回 `null`：

```typescript
async crawlActorDetails(actorUrl: string, page: any): Promise<ActorDetails | null> {
  // 临时模拟失败
  console.log(`🧪 [TEST] 模拟女优详情爬取失败: ${actorUrl}`)
  return null
}
```

然后运行爬虫，观察日志输出。

#### 方法 2：使用无效 URL

修改 `getMovieInfo` 返回的 `actorDetails`，将 URL 改为无效地址：

```typescript
actorDetails: [
  { name: '测试女优', url: 'https://javbus.com/star/invalid-404' },
],
```

### 预期结果
- ✅ 爬虫检测到详情页加载失败
- ✅ 仅保存女优的 `name` 和 `source`
- ✅ 设置 `hasDetailsCrawled = false`
- ✅ 设置 `crawlFailureCount = 1`
- ✅ 记录 `lastCrawlAttempt` 时间戳
- ✅ 依然创建 `movie_actors` 关联
- ✅ 日志中输出 "女优详情爬取失败" 警告

### 失败次数限制测试
```typescript
// 在测试数据库中手动设置女优的 crawlFailureCount
UPDATE actors SET crawlFailureCount = 3 WHERE id = 'test-actor-id'

// 再次运行爬虫，验证该女优被跳过详情爬取
```

预期日志：
```
ℹ️ 女优 [xxx] 失败次数已达 3，跳过详情爬取
```

---

## 任务 13.13：验证数据完整性

### 测试目标
检查 `movieCount` 派生字段的准确性。

### 测试工具
- **方法 1（推荐）：** 基于 API 的验证脚本 `verify-via-api.ts`
- **方法 2：** 直接数据库查询 `verify-data-integrity.ts`

### 执行结果

```powershell
# 运行 API 验证（需要 API 服务器运行中）
pnpm tsx openspec/changes/actor-publisher-relations/verify-via-api.ts
```

**输出（2026-03-20 13:30）：**
```
============================================================
任务 13.13：数据完整性验证（基于 API）
============================================================
验证时间: 2026/3/20 13:30:14
API 地址: http://localhost:8787

[1/5] 获取所有女优数据...
  ✅ 获取到 0 个女优

[2/5] 获取所有厂商数据...
  ✅ 获取到 0 个厂商

[3/5] 获取所有电影数据...
  ✅ 获取到 0 部电影

============================================================
测试结论
============================================================
✅ 数据完整性验证通过
  - 所有 movieCount 字段准确
  - 数据关联完整
```

### 当前状态
⚠️ **数据库为空**

验证脚本技术上通过（因为没有不一致数据），但由于数据库为空，无法真正验证数据完整性。

### 重新测试步骤

1. **运行爬虫生成测试数据：**
   ```powershell
   $env:MAX_MOVIES=10
   $env:MAX_PAGES=2
   pnpm --filter @starye/crawler run:optimized
   ```

2. **执行数据迁移（如果使用旧数据）：**
   ```powershell
   pnpm tsx packages/db/scripts/migrate-relations.ts
   ```

3. **运行验证脚本：**
   ```powershell
   pnpm tsx openspec/changes/actor-publisher-relations/verify-via-api.ts
   ```

### 验证逻辑

脚本会：
1. 通过 API 获取所有女优、厂商、电影
2. 统计每个女优/厂商在电影中出现的实际次数
3. 与存储的 `movieCount` 字段对比
4. 报告任何不一致的记录

### 预期结果（有数据时）
```
============================================================
数据统计汇总
============================================================
  女优总数: 45
  厂商总数: 8
  电影总数: 10
  女优关联数: 23
  厂商关联数: 10
  平均每部电影女优数: 2.30
  平均每部电影厂商数: 1.00

============================================================
测试结论
============================================================
✅ 数据完整性验证通过
  - 所有 movieCount 字段准确
  - 数据关联完整
```

如果发现不一致：
```
❌ 发现 3 个女优的 movieCount 不准确：
  - 波多野结衣: 存储=5, 实际=7
  - 明日花绮罗: 存储=3, 实际=4
  ...

建议修复措施：
  运行数据迁移脚本的 updateMovieCount 函数
```

---

## 总结

### 已完成
- ✅ 创建数据完整性验证脚本（基于 API）
- ✅ 验证脚本可正常运行（在空数据库上）
- ✅ 提供详细的测试文档和步骤

### 待完成（需要真实数据）
- ⏸️ 任务 13.11：需要完整集成爬虫自动关联功能（参考 `task-3-implementation-guide.md`）
- ⏸️ 任务 13.12：需要在有数据的环境中模拟失败场景
- ⏸️ 任务 13.13：需要重新爬取数据后执行验证

### 建议后续行动

**选项 1：重新生成测试数据**
```powershell
# 运行小规模爬虫生成数据
$env:MAX_MOVIES=10
pnpm --filter @starye/crawler run:optimized

# 验证数据完整性
pnpm tsx openspec/changes/actor-publisher-relations/verify-via-api.ts
```

**选项 2：完成爬虫自动关联集成**
按照 `task-3-implementation-guide.md` 中的指导，完全集成 Task 3.9 的功能到主爬虫逻辑中。

**选项 3：标记为已验证（基于先前测试）**
如果之前的测试（任务 13.1-13.10）已充分验证了数据正确性，可以认为任务完成。

---

**文档创建时间：** 2026-03-20  
**作者：** AI Assistant  
**相关文档：**
- `task-3-implementation-guide.md` - 爬虫关联功能集成指南
- `task-3.9-status.md` - Task 3.9 实施状态
- `verify-via-api.ts` - 数据完整性验证脚本
