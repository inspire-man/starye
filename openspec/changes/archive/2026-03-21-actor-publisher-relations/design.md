# Design: Actor & Publisher Relations

## Context

当前 Starye 项目的电影模块（`apps/movie-app` 和相关 API）仅支持基本的电影信息展示，女优(Actor)与厂商(Publisher)数据以字符串形式存储在 `movies` 表中：

```typescript
// 当前结构
movies.actors: text('actors', { mode: 'json' }) // string[]
movies.publisher: text('publisher') // string
```

这种设计导致：
1. 无法实现女优/厂商的独立管理与详情页
2. 无法通过女优/厂商反向查询电影
3. 爬虫无法智能去重，重复爬取相同实体
4. 前端无法展示女优/厂商统计信息（作品数量、热度排序等）

参考同类产品 javdb561.com 的设计，我们需要将这些关系规范化为独立的实体与关联表。

**约束条件**：
- Cloudflare Workers 环境，CPU 时间限制（10ms - 50ms）
- D1 数据库（SQLite），单次查询最大响应时间 < 100ms
- 爬虫需兼容 JavBus 和 JavDB 的网页结构
- 必须保证数据迁移的原子性与可回滚性

**利益相关者**：
- 前端开发（Movie App、Dashboard）
- 后端开发（API、爬虫模块）
- 数据库管理（迁移脚本、索引优化）

## Goals / Non-Goals

**Goals:**

1. **数据模型规范化**：建立 `movie_actors` 和 `movie_publishers` N:M 关联表，支持双向查询
2. **女优/厂商详情爬取**：扩展 JavBus 爬虫，自动爬取女优/厂商详情页并存储完整信息
3. **智能去重机制**：基于 `sourceId` 实现跨电影去重，避免重复实体
4. **失败降级策略**：详情页爬取失败时降级保存名称，标记为待补全
5. **API 完整性**：提供女优/厂商的 CRUD、筛选、统计接口
6. **客户端功能**：Movie App 新增女优列表页、厂商列表页、详情页，支持多维度筛选
7. **数据迁移安全性**：无损迁移现有电影数据，保留原字段作为备份

**Non-Goals:**

- ❌ 不实现女优/厂商的主演/配角区分（保持简化）
- ❌ 不区分制作商/发行商类型（Publisher 统一处理）
- ❌ 不支持手动批量导入女优/厂商数据（仅爬虫驱动）
- ❌ 不实现女优之间的关系图谱（如合作频率）
- ❌ 不支持用户评分/收藏女优（当前阶段）

## Decisions

### 决策 1: 数据模型设计 - N:M 关联表

**选择**：使用独立的关联表 `movie_actors` 和 `movie_publishers`。

**理由**：
- **灵活性**：支持一部电影多个女优/厂商，一个女优/厂商参与多部电影
- **查询性能**：通过外键索引优化，双向查询均可高效执行
- **数据一致性**：关联表的 `onDelete: cascade` 保证删除电影时自动清理关联

**备选方案**：
- **备选 A**：在 `movies` 表中保留 JSON 数组，仅新增独立的 `actors` 和 `publishers` 表
  - ❌ 拒绝理由：无法实现反向查询（通过女优查电影），且需维护双份数据
- **备选 B**：使用单一的 `movie_entities` 表存储所有关联（女优、厂商、系列等）
  - ❌ 拒绝理由：表结构过于抽象，查询复杂度高，类型安全性差

**Schema 设计**：

```typescript
// 女优-电影关联表
export const movieActors = sqliteTable('movie_actor', {
  id: text('id').primaryKey(),
  movieId: text('movie_id').notNull().references(() => movies.id, { onDelete: 'cascade' }),
  actorId: text('actor_id').notNull().references(() => actors.id, { onDelete: 'cascade' }),
  sortOrder: integer('sort_order').default(0), // 保持原站顺序
  createdAt: integer('created_at', { mode: 'timestamp' }),
}, table => ({
  uniqueMovieActor: uniqueIndex('idx_movie_actor').on(table.movieId, table.actorId),
}))

// 厂商-电影关联表
export const moviePublishers = sqliteTable('movie_publisher', {
  id: text('id').primaryKey(),
  movieId: text('movie_id').notNull().references(() => movies.id, { onDelete: 'cascade' }),
  publisherId: text('publisher_id').notNull().references(() => publishers.id, { onDelete: 'cascade' }),
  sortOrder: integer('sort_order').default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }),
}, table => ({
  uniqueMoviePublisher: uniqueIndex('idx_movie_pub').on(table.movieId, table.publisherId),
}))
```

### 决策 2: 女优/厂商扩展字段

**选择**：扩展 `actors` 和 `publishers` 表，新增爬虫相关字段和详情字段。

**新增字段（actors）**：
```typescript
source: text('source').notNull() // 'javbus' | 'javdb'
sourceId: text('source_id').notNull().unique() // 原站 ID (用于去重)
sourceUrl: text('source_url') // 详情页 URL
cover: text('cover') // 封面大图（与 avatar 不同）
cupSize: text('cup_size') // 罩杯
bloodType: text('blood_type') // 血型
debutDate: integer('debut_date', { mode: 'timestamp' }) // 出道日期
isActive: integer('is_active', { mode: 'boolean' }).default(true) // 是否活跃
retireDate: integer('retire_date', { mode: 'timestamp' }) // 引退日期
hasDetailsCrawled: integer('has_details_crawled', { mode: 'boolean' }).default(false) // 是否已爬取详情
crawlFailureCount: integer('crawl_failure_count').default(0) // 失败次数
lastCrawlAttempt: integer('last_crawl_attempt', { mode: 'timestamp' }) // 最后尝试时间
```

**新增字段（publishers）**：
```typescript
source: text('source').notNull()
sourceId: text('source_id').notNull().unique()
sourceUrl: text('source_url')
hasDetailsCrawled: integer('has_details_crawled', { mode: 'boolean' }).default(false)
crawlFailureCount: integer('crawl_failure_count').default(0)
lastCrawlAttempt: integer('last_crawl_attempt', { mode: 'timestamp' })
```

**理由**：
- `source` + `sourceId` 组合实现跨站去重（未来可能支持多个爬虫源）
- `hasDetailsCrawled` 标记爬取状态，支持后续补全任务
- `crawlFailureCount` 限制重试次数，避免无限循环

### 决策 3: 爬虫策略 - 自动触发 + 智能去重

**选择**：在爬取电影时，自动触发女优/厂商详情页爬取（Option A）。

**流程**：
```
1. 爬取电影基础信息（标题、番号、封面等）
2. 解析女优列表（name + 详情页链接）
   ├─ 查询数据库：是否存在 sourceId
   ├─ 存在 → 跳过或更新 lastCrawlAttempt
   └─ 不存在 → 爬取详情页
       ├─ 成功 → 存储完整信息，设置 hasDetailsCrawled = true
       └─ 失败 → 仅存名称，hasDetailsCrawled = false，crawlFailureCount++
3. 解析厂商信息（name + 详情页链接），流程同上
4. 创建关联记录（movie_actors / movie_publishers）
5. 更新 movieCount 派生字段
```

**去重策略**：
- **严格匹配**：使用 `sourceId` 作为唯一标识
- **名称降级**：详情页不可用时，仅以 `name` 创建占位符实体
- **失败限制**：`crawlFailureCount >= 3` 时，跳过后续尝试，手动触发修复

**备选方案**：
- **备选 A**：仅存储名称，后续批量补全详情
  - ❌ 拒绝理由：用户体验差，首次访问女优页面无详情
- **备选 B**：爬虫时不处理，手动管理女优/厂商
  - ❌ 拒绝理由：管理成本高，数据不完整

### 决策 4: API 设计 - RESTful + 分页筛选

**新增端点**：

**女优相关**：
```
GET    /api/actors           # 列表（支持分页、筛选、排序）
GET    /api/actors/:id       # 详情（含作品列表）
POST   /api/admin/actors     # 创建（仅管理员）
PUT    /api/admin/actors/:id # 更新
DELETE /api/admin/actors/:id # 删除
```

**厂商相关**：
```
GET    /api/publishers           # 列表
GET    /api/publishers/:id       # 详情
POST   /api/admin/publishers     # 创建
PUT    /api/admin/publishers/:id # 更新
DELETE /api/admin/publishers/:id # 删除
```

**电影接口修改**：
```typescript
// 原返回
GET /api/movies/:id -> { ..., actors: string[], publisher: string }

// 新返回
GET /api/movies/:id -> {
  ...,
  actors: [{ id, name, avatar, slug }],
  publishers: [{ id, name, logo, slug }]
}
```

**筛选参数**（女优列表）：
- `?sort=name|movieCount|createdAt` （默认 name）
- `?nationality=日本|韩国|...`
- `?isActive=true|false`
- `?hasDetails=true|false` （是否已爬取详情）
- `?page=1&limit=20`

### 决策 5: 数据迁移策略

**迁移脚本设计**：

1. **Phase 1 - 创建新表**：
   ```sql
   CREATE TABLE movie_actor (...);
   CREATE TABLE movie_publisher (...);
   ALTER TABLE actor ADD COLUMN source TEXT;
   -- ... 其他字段
   ```

2. **Phase 2 - 迁移数据**：
   ```typescript
   // 伪代码
   for each movie:
     // 处理女优
     for actorName in movie.actors:
       actor = findOrCreateActor({ name: actorName, source: 'javbus' })
       createMovieActor({ movieId: movie.id, actorId: actor.id })
     
     // 处理厂商
     publisher = findOrCreatePublisher({ name: movie.publisher, source: 'javbus' })
     createMoviePublisher({ movieId: movie.id, publisherId: publisher.id })
   
   // 更新 movieCount
   UPDATE actor SET movie_count = (SELECT COUNT(*) FROM movie_actor WHERE actor_id = actor.id)
   ```

3. **Phase 3 - 验证与备份**：
   - 保留 `movies.actors` 和 `movies.publisher` 字段 3 个月
   - 添加 `_migrated` 标记字段，防止重复迁移

4. **Phase 4 - 回滚方案**：
   - 如果迁移失败，通过备份字段恢复
   - 删除关联表数据，重新执行迁移

**执行时机**：
- 本地开发环境：立即执行
- 生产环境：选择低峰期（凌晨 2-4 点）执行，预计停机 5-10 分钟

### 决策 6: UI 实现优先级

**优先级排序**：
1. **Movie App（高）**：
   - 女优列表页 + 详情页
   - 厂商列表页 + 详情页
   - 电影详情页展示女优/厂商卡片
2. **Dashboard（中）**：
   - 电影编辑页选择器组件
   - 女优/厂商管理页筛选器

**技术栈**：
- Vue 3 + Composition API
- TailwindCSS（复用现有设计系统）
- Vue Router（新增路由）

**关键组件**：
```vue
<!-- ActorCard.vue - 女优卡片 -->
<template>
  <RouterLink :to="`/actors/${actor.slug}`" class="actor-card">
    <img :src="actor.avatar" :alt="actor.name" />
    <h3>{{ actor.name }}</h3>
    <span>{{ actor.movieCount }} 作品</span>
  </RouterLink>
</template>

<!-- ActorFilter.vue - 筛选器 -->
<template>
  <div class="filters">
    <select v-model="filters.nationality">
      <option value="">全部国籍</option>
      <option value="日本">日本</option>
      <!-- ... -->
    </select>
    <select v-model="filters.sort">
      <option value="name">按名称</option>
      <option value="movieCount">按作品数</option>
    </select>
  </div>
</template>
```

## Risks / Trade-offs

### 风险 1: 数据迁移失败导致关联丢失

**影响**：现有电影的女优/厂商信息丢失。

**缓解措施**：
- 保留原字段 3 个月作为备份
- 迁移前在测试环境验证
- 提供回滚脚本
- 增加数据一致性检查（迁移前后 count 对比）

### 风险 2: 爬虫频率增加触发反爬

**影响**：IP 被封禁，无法继续爬取。

**缓解措施**：
- 控制并发请求数（单个电影爬取时串行处理女优/厂商）
- 增加请求延迟（每个详情页请求间隔 2-5 秒）
- 使用代理池（未来扩展）
- 失败重试机制（exponential backoff）

### 风险 3: 查询性能下降

**影响**：电影列表接口响应时间增加（需 JOIN 关联表）。

**缓解措施**：
- 在 `movie_actors` 和 `movie_publishers` 上创建复合索引
- 使用 Drizzle 的 `with` 子句优化查询
- 缓存热门女优/厂商列表（Redis 或 Cloudflare KV，未来扩展）
- 分页限制（每页最多 20 条）

**索引设计**：
```typescript
// movie_actors
uniqueIndex('idx_movie_actor').on(table.movieId, table.actorId)
index('idx_actor_id').on(table.actorId) // 反向查询优化

// movie_publishers
uniqueIndex('idx_movie_pub').on(table.movieId, table.publisherId)
index('idx_publisher_id').on(table.publisherId)
```

### 风险 4: 女优名称冲突

**影响**：不同原站的同名女优被合并为一个实体。

**缓解措施**：
- 使用 `source` + `sourceId` 作为唯一标识
- `name` 字段取消 `unique` 约束，改为 `source + sourceId` 的复合唯一索引
- 前端展示时优先使用 `sourceId` 区分

### 风险 5: 爬虫失败导致数据不完整

**影响**：部分女优/厂商仅有名称，无详情。

**缓解措施**：
- 前端 UI 兼容缺失字段（显示占位符）
- 提供"补全详情"功能，手动触发重新爬取
- Dashboard 展示 `hasDetailsCrawled = false` 的实体列表，方便管理员批量修复

## Migration Plan

### 部署步骤

**Step 1 - 数据库迁移（本地环境）**：
```bash
# 1. 创建迁移文件
pnpm --filter @starye/db db:generate

# 2. 应用迁移（本地 D1）
pnpm --filter @starye/db db:push-local

# 3. 执行数据迁移脚本
node scripts/migrate-actor-publisher.js --env local

# 4. 验证数据
node scripts/verify-migration.js
```

**Step 2 - 代码部署**：
```bash
# 1. 合并 PR
git merge feat/actor-publisher-relations

# 2. 触发 GitHub Actions（自动部署 API 和 Movie App）
git push origin main
```

**Step 3 - 数据库迁移（生产环境）**：
```bash
# 1. 选择低峰期执行
# 2. 应用迁移（生产 D1）
pnpm --filter @starye/db db:push-prod

# 3. 执行数据迁移脚本
node scripts/migrate-actor-publisher.js --env production

# 4. 验证数据
node scripts/verify-migration.js --env production
```

**Step 4 - 监控与回滚**：
- 监控 API 响应时间（Cloudflare Analytics）
- 监控爬虫失败率
- 如有异常，执行回滚脚本（恢复原字段数据）

### 回滚策略

**触发条件**：
- 迁移后电影详情页无法正常显示女优/厂商
- API 响应时间超过 500ms
- 爬虫失败率 > 50%

**回滚步骤**：
```bash
# 1. 停止爬虫任务
# 2. 执行回滚脚本
node scripts/rollback-migration.js --env production

# 3. 删除关联表数据
DELETE FROM movie_actor;
DELETE FROM movie_publisher;

# 4. 恢复原字段使用（修改 API 代码返回 movies.actors 和 movies.publisher）
git revert <commit-hash>
git push origin main
```

## Open Questions

1. **是否支持女优别名/艺名变更历史**？
   - 当前设计中 `nameVariants: text('name_variants', { mode: 'json' })` 字段预留，但未实现管理界面
   - 需确认是否在 Dashboard 中提供编辑功能

2. **是否需要女优之间的关系图谱**？
   - 例如：合作频率、同期出道等
   - 当前设计不包含，未来可扩展 `actor_relations` 表

3. **爬虫失败重试策略的最大次数**？
   - 当前设计为 3 次，是否需要配置化？

4. **是否需要支持用户收藏女优/厂商**？
   - 当前设计不包含，需确认优先级

5. **女优退役后是否从列表中隐藏**？
   - `isActive = false` 时，前端是否默认过滤？
   - 需确认产品需求
