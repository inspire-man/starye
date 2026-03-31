# Dashboard 名字映射管理功能使用指南

**创建日期**: 2026-03-31  
**功能版本**: 1.0

## 概述

Dashboard 新增两个页面用于管理 SeesaaWiki 名字映射：

1. **名字映射管理** (`/name-mapping-management`)：查看未匹配清单、手动添加映射
2. **映射质量报告** (`/mapping-quality-report`)：实时监控映射质量指标

## 功能说明

### 1. 名字映射管理页面

**路径**: Dashboard → 爬虫监控 → 名字映射管理

**主要功能**:

#### 1.1 未匹配清单查看

- **女优 Tab**: 显示所有未能自动映射到 SeesaaWiki 的女优
- **厂商 Tab**: 显示所有未能自动映射的厂商

**列表字段**:
- **优先级**: 根据作品数量自动计算
  - P0: 作品数 > 100（红色）
  - P1: 作品数 50-100（橙色）
  - P2: 作品数 20-50（蓝色）
  - P3: 作品数 < 20（灰色）
- **名字**: JavBus 上的原始名字
- **作品数量**: 该女优/厂商的作品数
- **尝试方式**: 已尝试的映射方式（cache, exact, index）
- **最后尝试**: 最后一次尝试映射的时间

#### 1.2 搜索和筛选

**工具栏功能**:
- **搜索框**: 按名字搜索
- **排序方式**: 按作品数量或名字排序
- **排序顺序**: 升序或降序
- **最少作品数**: 筛选最少作品数（用于快速定位高优先级）

**使用示例**:
```
1. 只看高优先级女优：设置"最少作品数 = 50"
2. 查找特定女优：在搜索框输入名字
3. 按作品数排序：选择"作品数量" + "降序"
```

#### 1.3 手动添加映射

**步骤**:
1. 点击右上角"+ 添加映射"按钮
2. 填写表单：
   - **JavBus 名字**: 从未匹配清单复制
   - **SeesaaWiki URL**: 在 SeesaaWiki 手动搜索后复制完整 URL
3. 点击"添加"按钮
4. 系统自动保存映射并从未匹配清单移除

**注意事项**:
- ⚠️ URL 必须使用 EUC-JP 编码格式（直接从浏览器地址栏复制）
- ⚠️ 添加前请验证 URL 可访问且内容正确
- ✅ 支持快捷操作：点击清单中的"添加映射"按钮自动填充名字

### 2. 映射质量报告页面

**路径**: Dashboard → 爬虫监控 → 映射质量报告

**主要功能**:

#### 2.1 总体质量评分

**评分标准**（满分 100）:
- 女优覆盖率：40 分
- 厂商覆盖率：20 分
- 冲突率：20 分（越少越好）
- 失效率：20 分（越少越好）

**等级划分**:
- A+: 95 分以上（绿色）
- A: 90-95 分（蓝色）
- B: 85-90 分（橙色）
- C: 70-85 分（橙红色）
- D: 70 分以下（红色）

#### 2.2 覆盖率统计

**女优映射覆盖率**:
- 总计女优数量
- 已映射数量（有 wikiUrl）
- 未映射数量
- 高优先级未映射（作品数 > 50）

**厂商映射覆盖率**:
- 总计厂商数量
- 已映射数量
- 未映射数量
- 注：厂商覆盖率偏低属正常现象（SeesaaWiki 厂商页面较少）

#### 2.3 质量问题统计

**映射冲突**:
- 定义：多个 JavBus 名字映射到同一个 SeesaaWiki 页面
- 影响：可能导致数据混淆
- 处理：需要人工审核并修正

**失效映射**:
- 定义：映射的 URL 返回 404 或页面结构不符
- 影响：爬虫无法获取数据
- 处理：需要更新或删除映射

**有效映射**:
- 定义：可正常访问且数据完整的映射
- 目标：占比 > 95%

#### 2.4 改进建议

根据质量指标自动生成建议：

| 条件 | 建议 | 等级 |
|------|------|------|
| 女优覆盖率 < 85% | 运行索引爬虫更新映射表 | ⚠️ 警告 |
| 高优先级未映射 > 20 | 人工补充高优先级女优映射 | ❌ 错误 |
| 冲突数 > 10 | 检查并解决冲突映射 | ⚠️ 警告 |
| 失效映射 > 50 | 更新或删除失效映射 | ⚠️ 警告 |
| 覆盖率 ≥ 90% 且冲突 < 10 | 映射质量良好，继续保持 | ✅ 良好 |

## 数据源配置

### 当前实现

两个新页面的 API 端点已实现基础版本：

**映射质量报告**:
- ✅ 从数据库实时统计（totalActors, mappedActors, unmappedActors 等）
- ⚠️ 冲突数和失效数当前返回 0（需要额外实现检测逻辑）

**未匹配清单**:
- ⚠️ 当前返回空数组，提示需要配置数据源
- 数据来源于爬虫生成的 `.unmapped-actors.json` 和 `.unmapped-publishers.json` 文件

### 完整实现方案

为了让两个页面完全可用，需要配置数据源：

#### 方案 1: R2 存储（推荐）

**步骤**:

1. **修改爬虫脚本**，在生成映射文件后上传到 R2：

```typescript
// packages/crawler/src/utils/r2-uploader.ts
export async function uploadMappingToR2(
  fileName: string,
  content: string,
  r2Config: R2Config
) {
  const key = `mappings/${fileName}`
  // 上传到 R2...
}

// 在索引爬虫结束时调用
await uploadMappingToR2('.unmapped-actors.json', JSON.stringify(unmapped), r2Config)
```

2. **修改 API 端点**，从 R2 读取：

```typescript
// apps/api/src/routes/admin/crawlers/index.ts
adminCrawlers.get('/unmapped-actors', async (c) => {
  const r2 = c.env.R2_BUCKET
  const file = await r2.get('mappings/.unmapped-actors.json')
  
  if (!file) {
    return c.json({ data: [], message: '未找到未匹配清单文件' })
  }
  
  const data = await file.json()
  return c.json({ data })
})
```

#### 方案 2: 数据库存储

**步骤**:

1. **创建映射表**：

```sql
CREATE TABLE name_mappings (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL, -- 'actor' or 'publisher'
  javbus_name TEXT NOT NULL,
  wiki_name TEXT NOT NULL,
  wiki_url TEXT NOT NULL,
  last_updated INTEGER NOT NULL,
  UNIQUE(type, javbus_name)
);

CREATE TABLE unmapped_entities (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  movie_count INTEGER,
  attempts TEXT, -- JSON array
  last_attempt INTEGER,
  UNIQUE(type, name)
);
```

2. **修改爬虫**，写入数据库而非文件：

```typescript
// 在 name-mapper.ts 中
async function saveUnmappedToDb(name: string, type: string) {
  await apiClient.post('/admin/crawlers/unmapped', {
    type,
    name,
    movieCount,
    attempts: ['cache', 'exact', 'index'],
    lastAttempt: Date.now(),
  })
}
```

3. **修改 API 端点**，从数据库读取：

```typescript
adminCrawlers.get('/unmapped-actors', async (c) => {
  const db = c.get('db')
  const unmapped = await db.query.unmappedEntities.findMany({
    where: eq(unmappedEntities.type, 'actor'),
    orderBy: desc(unmappedEntities.movieCount),
  })
  return c.json({ data: unmapped })
})
```

#### 方案 3: 保持文件存储（仅本地可用）

如果只在本地使用这些功能：

**步骤**:
1. 保持爬虫输出到文件
2. API 端点保持当前实现（返回空数据 + 提示信息）
3. 前端显示提示："此功能仅在本地环境可用"

## 使用流程

### 典型工作流

**场景 1: 每周映射维护**

1. 运行索引爬虫（生成未匹配清单）
   ```bash
   pnpm tsx scripts/run-actor-index-crawler.ts
   ```

2. 访问 Dashboard → 映射质量报告
   - 查看当前覆盖率
   - 确认是否需要人工补充

3. 如需补充，访问名字映射管理
   - 切换到女优 Tab
   - 设置"最少作品数 = 50"（筛选高优先级）
   - 对每个未匹配女优：
     - 在 SeesaaWiki 搜索
     - 找到后点击"添加映射"
     - 粘贴 Wiki URL
     - 保存

4. 触发女优详情爬虫
   ```bash
   gh workflow run daily-actor-crawl.yml
   ```

5. 第二天再次查看映射质量报告，确认改进

**场景 2: 排查映射问题**

1. 用户反馈某女优数据不完整

2. 访问 Dashboard → 女优详情页
   - 查看是否有 Wiki URL
   - 查看社交媒体链接是否正确

3. 如无 Wiki URL，访问名字映射管理
   - 搜索该女优
   - 手动添加映射

4. 重新爬取该女优
   ```bash
   MAX_ACTORS=1 pnpm crawl:actor
   ```

## 权限要求

两个新页面需要以下权限之一：
- `admin`
- `super_admin`
- `movie_admin`

其他角色（如 `comic_admin`）无法访问。

## 限制和已知问题

### 当前限制

1. **数据源配置**: 
   - 未匹配清单和映射表文件数据需要配置 R2 或数据库存储
   - 当前 API 返回空数据或模拟数据

2. **映射冲突检测**: 
   - 前端页面已实现显示
   - 后端检测逻辑需要额外实现

3. **失效映射检测**: 
   - 需要定期验证映射 URL 的有效性
   - 可通过定时任务实现

### 已知问题

1. **母公司查找可能失败**:
   - 如果母公司名字不完全匹配数据库记录
   - 解决方案：使用模糊搜索或维护母公司 slug 映射

2. **性能问题**:
   - 未匹配清单可能包含数千条记录
   - 建议实现分页（前端已有筛选功能缓解）

## 后续优化建议

### 短期（1-2周）

1. **实现 R2 存储集成**:
   - 爬虫自动上传映射文件到 R2
   - API 从 R2 读取数据
   - 预计工作量：0.5 天

2. **添加批量操作**:
   - 批量添加映射（CSV 导入）
   - 批量删除映射
   - 预计工作量：0.5 天

### 中期（1-2月）

1. **实现映射冲突检测**:
   - 定期扫描映射表
   - 检测重复映射
   - 在质量报告中显示详情
   - 预计工作量：1 天

2. **实现失效映射检测**:
   - 定时验证 Wiki URL
   - 标记 404 或结构变化的映射
   - 自动更新质量报告
   - 预计工作量：1 天

### 长期（3-6月）

1. **AI 辅助映射**:
   - 使用 GPT-4 自动推荐映射
   - 基于语义相似度匹配
   - 人工确认后保存
   - 预计工作量：2-3 天

2. **映射历史和审计**:
   - 记录映射的添加/修改历史
   - 显示映射准确率趋势
   - 支持映射回滚
   - 预计工作量：2 天

## 相关文档

- [名字映射表维护指南](./name-mapping-maintenance-guide.md)
- [未匹配女优审核流程](./actor-mapping-audit-process.md)
- [数据完整度提升报告](./data-completeness-improvement-report.md)

## 技术实现细节

### 前端组件

**文件位置**:
- `apps/dashboard/src/views/NameMappingManagement.vue`
- `apps/dashboard/src/views/MappingQualityReport.vue`

**依赖**:
- Vue 3 Composition API
- Vue Router
- Fetch API

### API 端点

**文件位置**: `apps/api/src/routes/admin/crawlers/index.ts`

**新增端点**:

```typescript
GET  /api/admin/crawlers/unmapped-actors
GET  /api/admin/crawlers/unmapped-publishers
POST /api/admin/crawlers/add-mapping
GET  /api/admin/crawlers/mapping-quality
```

**请求示例**:

```bash
# 获取未匹配女优
curl http://localhost:8787/api/admin/crawlers/unmapped-actors \
  -H "Cookie: better-auth.session_token=xxx"

# 添加映射
curl http://localhost:8787/api/admin/crawlers/add-mapping \
  -X POST \
  -H "Content-Type: application/json" \
  -H "Cookie: better-auth.session_token=xxx" \
  -d '{
    "type": "actor",
    "javbusName": "三佳詩",
    "wikiUrl": "https://seesaawiki.jp/w/sougouwiki/d/..."
  }'

# 获取质量指标
curl http://localhost:8787/api/admin/crawlers/mapping-quality \
  -H "Cookie: better-auth.session_token=xxx"
```

### 数据流程

```
┌─────────────┐
│ 索引爬虫     │
│ (本地/CI)    │
└─────┬───────┘
      │ 生成
      ↓
┌─────────────────────────┐
│ .unmapped-actors.json   │
│ .actor-name-map.json    │
└─────┬───────────────────┘
      │ 上传 (TODO)
      ↓
┌─────────────┐
│ R2 存储     │
│ 或 D1 数据库 │
└─────┬───────┘
      │ 读取
      ↓
┌─────────────┐
│ API 端点    │
└─────┬───────┘
      │ 展示
      ↓
┌─────────────┐
│ Dashboard   │
│ 前端页面    │
└─────────────┘
```

## 总结

两个新页面为 SeesaaWiki 数据源集成提供了**可视化管理工具**：

- ✅ 简化人工审核流程
- ✅ 实时监控映射质量
- ✅ 快速定位高优先级未映射女优
- ✅ 提供数据驱动的改进建议

为了完全发挥功能，建议实施**方案 1（R2 存储）**，预计额外投入 0.5 天开发时间。
