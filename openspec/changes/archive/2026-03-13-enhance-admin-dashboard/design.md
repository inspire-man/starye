# 管理后台增强设计

## Context

**当前状态**:
- Dashboard App 已存在，使用 Vue 3 + Vue Router
- 已有基础的漫画管理页面（Comics.vue）- 功能有限，仅支持单个编辑和简单列表
- API 层使用 Hono + Drizzle ORM + Cloudflare D1
- 认证使用 Better Auth，已有 `serviceAuth` 中间件
- 角色系统已定义：`admin`, `comic_admin`，但未充分利用

**技术栈**:
- 前端：Vue 3 + TypeScript + Tailwind CSS 4
- 后端：Hono (Cloudflare Workers) + Drizzle ORM
- 数据库：Cloudflare D1 (SQLite)
- 存储：Cloudflare R2
- 认证：Better Auth (GitHub OAuth2)

**约束条件**:
- Cloudflare Workers 的执行时间限制（CPU 时间 < 30s，墙钟时间 < 30s）
- D1 单次查询最多返回 10,000 行
- 批量操作需要分批执行
- 审计日志不能无限增长（需要定期清理或归档）

**关键需求**:
1. **法规合规**: 漫画和电影必须完全隔离，不同管理员不能跨界访问
2. **性能**: 支持大数据量（未来可能数万部电影/漫画）
3. **可追溯性**: 所有管理操作必须有审计日志

## Goals / Non-Goals

**Goals:**
1. 实现完整的电影管理功能（与漫画管理平级）
2. 建立严格的角色权限隔离机制
3. 提供高效的筛选、排序、批量操作工具
4. 实现爬虫监控和失败任务恢复界面
5. 建立操作审计日志系统
6. 管理演员、厂商等关联实体

**Non-Goals:**
1. 不实现用户注册功能（仅 GitHub OAuth2）
2. 不实现会员系统/付费内容
3. 不实现前台（Comic/Movie App）的新功能
4. 不实现复杂的 BI 报表（基础统计即可）
5. 不实现自动化内容审核（人工审核）

## Decisions

### Decision 1: 权限模型设计

**选择**: 基于角色的访问控制 (RBAC) + 资源隔离

```
权限矩阵:

Resource Type     | admin | comic_admin | movie_admin
------------------|-------|-------------|------------
Comics (CRUD)     |  ✓    |      ✓      |     ✗
Chapters (CRUD)   |  ✓    |      ✓      |     ✗
Movies (CRUD)     |  ✓    |      ✗      |     ✓
Players (CRUD)    |  ✓    |      ✗      |     ✓
Actors (CRUD)     |  ✓    |      ✗      |     ✓
Publishers (CRUD) |  ✓    |      ✗      |     ✓
Crawlers (View)   |  ✓    |      ✓*     |     ✓*
Audit Logs (View) |  ✓    |      ✗      |     ✗
Users (Manage)    |  ✓    |      ✗      |     ✗

* Crawlers: comic_admin 只能查看漫画爬虫，movie_admin 只能查看电影爬虫
```

**实现方式**:

```typescript
// 1. 增强的权限检查中间件
function requireResource(resource: 'comic' | 'movie' | 'global') {
  return createMiddleware<AppEnv>(async (c, next) => {
    const user = c.get('user') // 从 session 中获取
    
    // Super admin 和 admin 全局访问
    if (user.role === 'admin' || user.role === 'super_admin') {
      return await next()
    }
    
    // 资源级权限检查
    if (resource === 'comic' && user.role === 'comic_admin') {
      return await next()
    }
    
    if (resource === 'movie' && user.role === 'movie_admin') {
      return await next()
    }
    
    throw new HTTPException(403, { message: 'Insufficient permissions' })
  })
}

// 2. 路由分组
admin.route('/comics', comicRoutes) // 需要 comic 权限
admin.route('/movies', movieRoutes) // 需要 movie 权限
admin.route('/users', userRoutes)   // 需要 admin 权限
```

**前端路由守卫**:

```typescript
// Dashboard 路由配置
const routes = [
  { 
    path: '/comics', 
    component: Comics,
    meta: { requiredRoles: ['admin', 'comic_admin'] }
  },
  { 
    path: '/movies', 
    component: Movies,
    meta: { requiredRoles: ['admin', 'movie_admin'] }
  },
  // ...
]

// 路由守卫
router.beforeEach((to, from, next) => {
  const userRole = session.user.role
  const requiredRoles = to.meta.requiredRoles
  
  if (!requiredRoles.includes(userRole)) {
    return next('/unauthorized')
  }
  
  next()
})
```

**替代方案**:
- ❌ 基于权限位的 ACL：过于复杂，维护成本高
- ❌ 不隔离权限：违反法规要求
- ✅ RBAC + 资源隔离（选中）：清晰简单，易于维护

### Decision 2: Movies 表 Schema 扩展

**选择**: 添加与 Comics 对等的管理字段

```sql
-- 需要添加的字段
ALTER TABLE movies ADD COLUMN metadata_locked BOOLEAN DEFAULT FALSE NOT NULL;
ALTER TABLE movies ADD COLUMN sort_order INTEGER DEFAULT 0;
ALTER TABLE movies ADD COLUMN crawl_status TEXT CHECK(crawl_status IN ('pending', 'partial', 'complete')) DEFAULT 'complete';
ALTER TABLE movies ADD COLUMN last_crawled_at TIMESTAMP;
ALTER TABLE movies ADD COLUMN total_players INTEGER DEFAULT 0;
ALTER TABLE movies ADD COLUMN crawled_players INTEGER DEFAULT 0;
```

**字段说明**:

| 字段 | 类型 | 说明 | 默认值 |
|-----|------|------|--------|
| `metadataLocked` | boolean | 锁定元数据，防止爬虫覆盖 | false |
| `sortOrder` | integer | 人工排序权重（越大越靠前）| 0 |
| `crawlStatus` | enum | 爬取状态（pending/partial/complete）| complete |
| `lastCrawledAt` | timestamp | 最后爬取时间 | null |
| `totalPlayers` | integer | 总播放源数量 | 0 |
| `crawledPlayers` | integer | 已爬取播放源数量 | 0 |

**理由**:
- `metadataLocked`: 与 comics 一致，允许管理员手动编辑后锁定
- `sortOrder`: 支持人工排序（推荐位、置顶等）
- `crawlStatus`: 追踪爬取进度，与 comics 保持一致
- `totalPlayers` / `crawledPlayers`: 监控播放源爬取进度

**迁移策略**:
- 现有 movies 记录的 `crawlStatus` 默认设为 `complete`（已爬取完成）
- 现有记录的 `totalPlayers` 需要计算（COUNT players）

### Decision 3: 审计日志设计

**选择**: 独立的 `audit_logs` 表 + 中间件拦截

```typescript
// Schema
export const auditLogs = sqliteTable('audit_log', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(), // 操作者
  userEmail: text('user_email').notNull(), // 冗余存储，便于查询
  action: text('action').notNull(), // CREATE, UPDATE, DELETE, BULK_UPDATE, BULK_DELETE
  resourceType: text('resource_type').notNull(), // comic, movie, chapter, actor, etc.
  resourceId: text('resource_id'), // 资源 ID（批量操作时为 null）
  resourceIdentifier: text('resource_identifier'), // 资源标识符（slug, code 等）
  affectedCount: integer('affected_count').default(1), // 批量操作影响的数量
  changes: text('changes', { mode: 'json' }), // 变更详情 JSON
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: integer('created_at', { mode: 'timestamp' }),
})
```

**拦截方式**:

```typescript
// 审计日志中间件
function auditMiddleware() {
  return createMiddleware<AppEnv>(async (c, next) => {
    const user = c.get('user')
    const method = c.req.method
    const path = c.req.path
    
    // 只记录 POST/PUT/PATCH/DELETE 操作
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      // 记录操作前的快照（可选）
      const before = await captureResourceState(c)
      
      await next()
      
      // 记录操作后的结果
      await logAuditEntry(c, {
        user,
        method,
        path,
        before,
      })
    } else {
      await next()
    }
  })
}
```

**查询优化**:
- 按 `userId` 索引（查询特定用户的操作）
- 按 `resourceType` 索引（查询特定类型的操作）
- 按 `createdAt` 索引（时间范围查询）
- 组合索引：`(resourceType, resourceId)` 查询特定资源的历史

**数据清理策略**:
- 保留 90 天的审计日志
- 超过 90 天的日志归档到 R2（JSON 格式）
- 提供手动导出功能（CSV/JSON）

**替代方案**:
- ❌ 使用第三方服务（如 Sentry）：成本高，隐私问题
- ❌ 仅记录到日志文件：不可查询，不持久
- ✅ 数据库表 + 定期归档（选中）

### Decision 4: 高级筛选与排序实现

**选择**: 后端动态构建 SQL + 前端 URL 状态管理

**后端实现**:

```typescript
// 筛选参数接口
interface MovieFilter {
  // 基础筛选
  isR18?: boolean
  crawlStatus?: 'pending' | 'partial' | 'complete'
  metadataLocked?: boolean
  
  // 关联筛选
  actor?: string  // 演员名称（LIKE 查询）
  publisher?: string  // 厂商名称
  genre?: string[]  // 类型（支持多选）
  
  // 时间范围
  releaseDateFrom?: string  // ISO 8601
  releaseDateTo?: string
  createdAtFrom?: string
  createdAtTo?: string
  
  // 搜索
  search?: string  // 标题或番号模糊搜索
}

// 动态构建 WHERE 子句
function buildMovieFilters(filter: MovieFilter) {
  const conditions = []
  
  if (filter.isR18 !== undefined) {
    conditions.push(eq(movies.isR18, filter.isR18))
  }
  
  if (filter.crawlStatus) {
    conditions.push(eq(movies.crawlStatus, filter.crawlStatus))
  }
  
  if (filter.actor) {
    conditions.push(sql`${movies.actors} LIKE ${`%${filter.actor}%`}`)
  }
  
  if (filter.genre && filter.genre.length > 0) {
    const genreConditions = filter.genre.map(g => 
      sql`${movies.genres} LIKE ${`%${g}%`}`
    )
    conditions.push(or(...genreConditions))
  }
  
  // ... 其他条件
  
  return conditions.length > 0 ? and(...conditions) : undefined
}

// 动态排序
function buildOrderBy(sortBy: string, sortOrder: 'asc' | 'desc') {
  const column = {
    'releaseDate': movies.releaseDate,
    'createdAt': movies.createdAt,
    'updatedAt': movies.updatedAt,
    'sortOrder': movies.sortOrder,
    'title': movies.title,
  }[sortBy] || movies.createdAt
  
  return sortOrder === 'desc' ? desc(column) : asc(column)
}
```

**前端状态管理**:

```typescript
// URL 查询参数同步
const route = useRoute()
const router = useRouter()

const filters = ref<MovieFilter>({
  isR18: route.query.isR18 === 'true',
  crawlStatus: route.query.crawlStatus as any,
  actor: route.query.actor as string,
  // ...
})

// 监听变化，更新 URL
watch(filters, (newFilters) => {
  router.push({
    query: {
      ...newFilters,
      page: 1, // 重置页码
    }
  })
}, { deep: true })
```

**筛选器 UI 设计**:

```
┌─────────────────────────────────────────────────┐
│  [电影管理]                            [+ 新建] │
├─────────────────────────────────────────────────┤
│                                                  │
│  🔍 筛选器                                       │
│  ┌──────────────────────────────────────────┐  │
│  │ R18: [全部 ▼]  状态: [全部 ▼]           │  │
│  │ 演员: [________]  厂商: [________]      │  │
│  │ 类型: ☑ 剧情 ☐ 写真 ☐ ...              │  │
│  │ 日期: [2024-01-01] - [2024-12-31]      │  │
│  │                                          │  │
│  │  [重置]  [应用筛选]  [保存为预设 ▼]   │  │
│  └──────────────────────────────────────────┘  │
│                                                  │
│  排序: [更新时间 ▼]  [降序 ▼]                   │
│                                                  │
│  已选中 12 项  [批量操作 ▼]                     │
│                                                  │
│  ┌─────────────────────────────────────────┐   │
│  │ ☑ SSIS-001 | 标题...      | 2024-01-15 │   │
│  │ ☐ SSIS-002 | 标题...      | 2024-01-14 │   │
│  │ ...                                      │   │
│  └─────────────────────────────────────────┘   │
│                                                  │
│  显示 1-20 / 共 485 项   [< 1 2 3 ... 25 >]    │
└─────────────────────────────────────────────────┘
```

**替代方案**:
- ❌ 前端全量加载 + 客户端筛选：数据量大时性能差
- ❌ GraphQL：增加复杂度，Cloudflare Workers 支持有限
- ✅ REST API + 动态 SQL（选中）：简单高效

### Decision 5: 批量操作实现

**选择**: 两阶段确认 + 后台任务队列

**安全机制**:

```
批量操作流程:

1. 选择阶段
   用户在列表中勾选项目
   → 前端显示已选中数量
   
2. 操作选择阶段
   用户选择操作类型：
   - 批量修改 R18 标记
   - 批量锁定/解锁元数据
   - 批量修改排序权重
   - 批量删除
   
3. 预览与确认阶段
   ┌────────────────────────────────┐
   │ ⚠️ 确认批量操作                 │
   ├────────────────────────────────┤
   │ 操作: 批量删除                  │
   │ 影响: 12 部电影                 │
   │                                 │
   │ 预览:                           │
   │  • SSIS-001 - 标题1            │
   │  • SSIS-002 - 标题2            │
   │  ... (更多)                     │
   │                                 │
   │ ⚠️ 此操作不可撤销              │
   │                                 │
   │ 输入 "CONFIRM" 以继续:          │
   │ [__________]                    │
   │                                 │
   │  [取消]  [确认删除]             │
   └────────────────────────────────┘
   
4. 执行阶段
   后端分批执行（每批 20 条）
   前端显示进度：
   "正在处理... 8/12 已完成"
   
5. 结果报告
   ✓ 成功: 10 项
   ✗ 失败: 2 项
   - SSIS-003: 资源被锁定
   - SSIS-005: 数据库错误
```

**后端实现**:

```typescript
// 批量操作 API
admin.post('/movies/bulk-operation',
  requireResource('movie'),
  zValidator('json', z.object({
    ids: z.array(z.string()).min(1).max(100), // 限制最多 100 条
    operation: z.enum(['update_r18', 'lock_metadata', 'unlock_metadata', 'delete']),
    payload: z.record(z.any()).optional(), // 根据操作类型的额外数据
  })),
  async (c) => {
    const { ids, operation, payload } = c.req.valid('json')
    const db = c.get('db')
    const user = c.get('user')
    
    const results = {
      success: [] as string[],
      failed: [] as { id: string, reason: string }[],
    }
    
    // 分批处理（D1 限制）
    const BATCH_SIZE = 20
    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const batch = ids.slice(i, i + BATCH_SIZE)
      
      for (const id of batch) {
        try {
          await performOperation(db, id, operation, payload)
          results.success.push(id)
          
          // 记录审计日志
          await logAudit(c, {
            action: operation,
            resourceType: 'movie',
            resourceId: id,
          })
        } catch (error) {
          results.failed.push({
            id,
            reason: (error as Error).message
          })
        }
      }
    }
    
    return c.json(results)
  }
)
```

**替代方案**:
- ❌ 直接执行无确认：风险高
- ❌ 使用后台队列服务：Cloudflare Workers 无原生支持，增加复杂度
- ✅ 两阶段确认 + 同步分批执行（选中）

### Decision 6: 爬虫管理界面设计

**选择**: 只读监控 + 手动恢复触发

**数据来源**:

```typescript
// 爬虫统计 API
admin.get('/crawlers/stats', async (c) => {
  const user = c.get('user')
  const db = c.get('db')
  
  // 根据角色过滤
  const canViewComics = ['admin', 'comic_admin'].includes(user.role)
  const canViewMovies = ['admin', 'movie_admin'].includes(user.role)
  
  const stats: any = {}
  
  if (canViewComics) {
    stats.comics = {
      total: await db.$count(comics),
      pending: await db.$count(comics, eq(comics.crawlStatus, 'pending')),
      partial: await db.$count(comics, eq(comics.crawlStatus, 'partial')),
      complete: await db.$count(comics, eq(comics.crawlStatus, 'complete')),
      lastCrawl: await getLastCrawlTime(db, 'comic'),
    }
  }
  
  if (canViewMovies) {
    stats.movies = {
      total: await db.$count(movies),
      // ... 类似的统计
    }
  }
  
  return c.json(stats)
})

// 失败任务列表 API
admin.get('/crawlers/failed-tasks', async (c) => {
  // 读取 .crawler-failed-tasks.json 和 .javbus-failed-tasks.json
  // 返回合并后的列表（根据角色过滤）
})

// 触发恢复 API
admin.post('/crawlers/recover', async (c) => {
  // 触发 GitHub Actions workflow (workflow_dispatch)
  // 或者排队到后台任务系统
  
  // 简化版：返回说明让管理员手动触发
  return c.json({
    message: '请在 GitHub Actions 中手动触发恢复任务',
    recoveryCommand: 'RECOVERY_MODE=true pnpm crawl:manga'
  })
})
```

**UI 布局**:

```
┌─────────────────────────────────────────────────┐
│  [爬虫监控]                                     │
├─────────────────────────────────────────────────┤
│                                                  │
│  📊 实时统计                                     │
│  ┌──────────────┐  ┌──────────────┐            │
│  │ 漫画爬虫     │  │ 电影爬虫     │            │
│  │              │  │              │            │
│  │ 总数: 1,234  │  │ 总数: 5,678  │            │
│  │ 完成: 98%    │  │ 完成: 100%   │            │
│  │ 失败: 23 个  │  │ 失败: 5 个   │            │
│  │              │  │              │            │
│  │ 最后运行:    │  │ 最后运行:    │            │
│  │ 2小时前      │  │ 5小时前      │            │
│  └──────────────┘  └──────────────┘            │
│                                                  │
│  ❌ 失败任务 (28 个)                            │
│  ┌─────────────────────────────────────────┐   │
│  │ 类型: [全部 ▼]  来源: [全部 ▼]         │   │
│  ├─────────────────────────────────────────┤   │
│  │ ERR_ABORTED (15 个)                     │   │
│  │  • https://...book/1141                 │   │
│  │  • https://...book/1153                 │   │
│  │                                          │   │
│  │ TIMEOUT (10 个)                         │   │
│  │  • https://...book/1150                 │   │
│  │                                          │   │
│  │ [导出列表]  [触发恢复任务]              │   │
│  └─────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

### Decision 7: 演员/厂商管理

**选择**: 独立管理页面 + 电影关联展示

**演员管理功能**:
- 列表页：按作品数量排序，支持搜索
- 详情页：编辑头像、简介、社交链接，查看关联电影
- 合并功能：处理爬虫导致的重复（如 "波多野结衣" vs "波多野結衣"）

**实现要点**:

```typescript
// 合并演员 API
admin.post('/actors/merge',
  requireResource('movie'),
  zValidator('json', z.object({
    sourceId: z.string(),  // 源演员 ID
    targetId: z.string(),  // 目标演员 ID
  })),
  async (c) => {
    const { sourceId, targetId } = c.req.valid('json')
    const db = c.get('db')
    
    // 1. 更新所有电影中的演员名称
    const sourceActor = await db.query.actors.findFirst({ where: eq(actors.id, sourceId) })
    const targetActor = await db.query.actors.findFirst({ where: eq(actors.id, targetId) })
    
    if (!sourceActor || !targetActor) {
      return c.json({ error: 'Actor not found' }, 404)
    }
    
    // 2. 查找包含源演员的所有电影
    const affectedMovies = await db.query.movies.findMany({
      where: sql`${movies.actors} LIKE ${`%${sourceActor.name}%`}`,
    })
    
    // 3. 更新电影的 actors 数组（替换名称）
    for (const movie of affectedMovies) {
      const updatedActors = (movie.actors as string[]).map(name =>
        name === sourceActor.name ? targetActor.name : name
      )
      
      await db.update(movies)
        .set({ actors: updatedActors })
        .where(eq(movies.id, movie.id))
    }
    
    // 4. 更新目标演员的作品计数
    await db.update(actors)
      .set({ movieCount: sql`${actors.movieCount} + ${sourceActor.movieCount}` })
      .where(eq(actors.id, targetId))
    
    // 5. 删除源演员
    await db.delete(actors).where(eq(actors.id, sourceId))
    
    return c.json({ 
      success: true, 
      mergedCount: affectedMovies.length 
    })
  }
)
```

**替代方案**:
- ❌ 多对多关系表：增加复杂度，D1 JOIN 性能问题
- ✅ JSON 数组存储 + 合并工具（选中）：简单，已有数据结构

### Decision 8: 前端架构

**选择**: Vue 3 Composition API + 可复用 Composables

**代码组织**:

```
apps/dashboard/src/
├── views/
│   ├── Comics.vue          # 漫画管理（已存在，需增强）
│   ├── Movies.vue          # 电影管理（新建）
│   ├── Crawlers.vue        # 爬虫监控（新建）
│   ├── Actors.vue          # 演员管理（新建）
│   ├── Publishers.vue      # 厂商管理（新建）
│   ├── Players.vue         # 播放源管理（新建，或集成到 Movies.vue）
│   ├── AuditLogs.vue       # 审计日志（新建）
│   └── Users.vue           # 用户管理（已存在）
├── components/
│   ├── DataTable.vue       # 通用表格组件（支持筛选、排序、分页）
│   ├── FilterPanel.vue     # 筛选器面板
│   ├── BatchOperationMenu.vue  # 批量操作菜单
│   ├── ConfirmDialog.vue   # 确认对话框
│   └── AuditTimeline.vue   # 审计日志时间线
├── composables/
│   ├── useFilters.ts       # 筛选器状态管理
│   ├── usePagination.ts    # 分页逻辑
│   ├── useBatchSelect.ts   # 批量选择逻辑
│   └── useResourceGuard.ts # 权限检查 hook
└── lib/
    └── api.ts              # API 客户端（扩展）
```

**可复用的 Composables**:

```typescript
// useFilters.ts - 通用筛选器逻辑
export function useFilters<T>(initialFilters: T) {
  const route = useRoute()
  const router = useRouter()
  
  const filters = ref<T>({
    ...initialFilters,
    ...route.query, // 从 URL 恢复
  })
  
  const applyFilters = () => {
    router.push({ query: filters.value })
  }
  
  const resetFilters = () => {
    filters.value = initialFilters
    applyFilters()
  }
  
  return {
    filters,
    applyFilters,
    resetFilters,
  }
}

// useBatchSelect.ts - 批量选择逻辑
export function useBatchSelect<T extends { id: string }>(items: Ref<T[]>) {
  const selected = ref<Set<string>>(new Set())
  
  const toggleItem = (id: string) => {
    if (selected.value.has(id)) {
      selected.value.delete(id)
    } else {
      selected.value.add(id)
    }
  }
  
  const toggleAll = () => {
    if (selected.value.size === items.value.length) {
      selected.value.clear()
    } else {
      items.value.forEach(item => selected.value.add(item.id))
    }
  }
  
  const clearSelection = () => selected.value.clear()
  
  return {
    selected,
    toggleItem,
    toggleAll,
    clearSelection,
    selectedCount: computed(() => selected.value.size),
    selectedIds: computed(() => Array.from(selected.value)),
  }
}
```

**替代方案**:
- ❌ React (Next.js)：切换成本高，团队不熟悉
- ❌ Solid.js：生态不成熟
- ✅ Vue 3 + Composition API（选中）：已有基础，学习曲线低

## Risks / Trade-offs

### Risk 1: D1 查询性能

**风险**: 大数据量下（10000+ 电影），筛选查询可能变慢

**Mitigation**:
- 添加必要的数据库索引（`code`, `releaseDate`, `createdAt`, `sortOrder`）
- 限制单次查询返回数量（最多 1000 条）
- 使用分页和虚拟滚动优化前端渲染
- 考虑未来引入 Cloudflare Analytics Engine 做预聚合

### Risk 2: 权限隔离的边界情况

**风险**: 某些操作（如审计日志、系统设置）的权限归属不明确

**Mitigation**:
- 明确定义权限矩阵，覆盖所有资源类型
- 默认原则：全局资源只有 `admin` 可访问
- 添加权限测试用例，覆盖边界情况

### Risk 3: 批量操作误操作

**风险**: 管理员可能误删大量数据

**Mitigation**:
- 两阶段确认（预览 + 输入 CONFIRM）
- 批量删除记录到审计日志（可回溯）
- 考虑未来添加"软删除"功能
- 限制单次批量操作数量（最多 100 条）

### Risk 4: 审计日志存储膨胀

**风险**: 审计日志无限增长，占用大量存储

**Mitigation**:
- 保留最近 90 天的日志
- 定期归档到 R2（每月一次）
- 提供手动清理和导出功能
- 监控日志表大小，超过阈值时告警

### Trade-off 1: 实时性 vs 简单性

**Trade-off**: 爬虫监控是实时还是定期刷新？

**选择**: 定期刷新（每 30 秒）
- 实时需要 WebSocket，Cloudflare Workers 支持有限
- 定期刷新足够满足监控需求
- 可手动刷新按钮

### Trade-off 2: 筛选器的持久化

**Trade-off**: 是否保存用户的筛选预设？

**选择**: 第一版不实现，URL 状态已足够
- 可以通过浏览器书签保存
- 未来可扩展到用户表（`user_preferences` 字段）
- 当前专注核心功能

### Trade-off 3: Dashboard 部署方式

**Trade-off**: Cloudflare Pages (SSG) vs Workers (SSR) vs 独立部署？

**选择**: Cloudflare Pages (SPA)
- Dashboard 是管理工具，SEO 不重要
- SPA 模式最简单，无需 SSR 开销
- 使用 Vite 构建，输出到 `dist/` 后部署到 Pages

## Migration Plan

### Phase 1: 数据库 Schema 扩展
```bash
# 1. 更新 schema.ts
#    添加 movies 表字段
#    添加 audit_logs 表

# 2. 生成迁移
pnpm --filter @starye/db generate

# 3. 应用迁移
pnpm --filter @starye/db migrate

# 4. 数据回填
#    为现有 movies 记录设置默认值
#    计算 totalPlayers 字段
```

### Phase 2: API 路由扩展
```bash
# 按优先级实现:
# 1. 电影管理 API (CRUD, 筛选, 排序)
# 2. 批量操作 API
# 3. 爬虫监控 API
# 4. 播放源管理 API
# 5. 演员/厂商管理 API
# 6. 审计日志 API
```

### Phase 3: Dashboard UI 实现
```bash
# 1. 创建可复用组件 (DataTable, FilterPanel, etc.)
# 2. 实现电影管理页面
# 3. 增强漫画管理页面（添加筛选和批量操作）
# 4. 实现爬虫监控页面
# 5. 实现演员/厂商管理页面
# 6. 实现审计日志查看页面
```

### Phase 4: 权限系统迁移
```bash
# 1. 更新所有 API 路由的权限检查
# 2. 添加前端路由守卫
# 3. 迁移现有管理员角色（如需要）
# 4. 测试权限隔离
```

### Rollback Strategy

如果出现问题：

1. **数据库回滚**:
   ```sql
   -- 回退 movies 表字段（保留数据）
   -- 删除 audit_logs 表
   ```

2. **API 回滚**:
   - 使用 Git revert
   - 旧的 API 端点仍然兼容

3. **前端回滚**:
   - 回滚到旧版 Dashboard
   - 或者隐藏新功能（feature flag）

## Open Questions

1. **Q: 是否需要为审计日志添加变更回滚功能？**
   - A: 第一版仅记录和查看，不实现回滚
   - 回滚复杂度高，收益有限
   - 可作为未来扩展

2. **Q: 播放源测试功能是否需要实际验证链接？**
   - A: 第一版仅提供手动测试按钮（打开链接）
   - 自动验证需要爬虫逻辑，超出当前范围

3. **Q: 是否需要为爬虫恢复任务实现自动触发？**
   - A: 第一版提供手动触发说明
   - 自动触发需要与 GitHub Actions 集成（workflow_dispatch API）
   - 可作为 Phase 2 扩展

4. **Q: Dashboard 是否需要移动端适配？**
   - A: 低优先级，管理后台主要在桌面端使用
   - 基础响应式布局即可

5. **Q: 是否需要为大批量操作（500+ 条）添加后台队列？**
   - A: 第一版限制批量操作最多 100 条
   - 如未来需求增加，考虑使用 Cloudflare Queues
