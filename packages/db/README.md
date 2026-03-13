# @starye/db

Starye 项目的数据库 Schema 定义和 ORM 配置。

## 技术栈

- **ORM**: Drizzle ORM
- **数据库**: Cloudflare D1 / Turso (libSQL)
- **迁移工具**: Drizzle Kit

## Schema 概览

### 认证相关

- `user` - 用户表（Better Auth 标准）
- `session` - 会话表
- `account` - OAuth 账户表
- `verification` - 验证表

### 内容相关

#### 漫画模块

- `comic` - 漫画表
- `chapter` - 章节表
- `page` - 页面表

#### 电影模块

- `movie` - 电影表
- `player` - 播放源表
- `actor` - 演员表
- `publisher` - 厂商表

#### 其他

- `post` - 博客文章表
- `media` - 媒体资源表（R2）
- `job` - 系统任务表
- `audit_log` - 审计日志表

---

## 字段说明

### Comics 表管理字段

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `metadataLocked` | boolean | false | 锁定元数据：管理员手动编辑后可锁定，防止爬虫覆盖 |
| `sortOrder` | integer | 0 | 人工排序权重：用于推荐位、置顶等（值越大越靠前）|
| `crawlStatus` | enum | 'pending' | 爬取状态：`pending`（未爬取）、`partial`（部分完成）、`complete`（完成）|
| `lastCrawledAt` | timestamp | null | 最后爬取时间：用于追踪爬虫运行历史 |
| `totalChapters` | integer | 0 | 总章节数：从源站获取的章节总数 |
| `crawledChapters` | integer | 0 | 已爬取章节数：已成功爬取的章节数量 |
| `isSerializing` | boolean | true | 是否连载中：用于判断是否需要持续更新 |

### Movies 表管理字段

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `metadataLocked` | boolean | false | 锁定元数据：防止爬虫覆盖手动编辑的内容 |
| `sortOrder` | integer | 0 | 人工排序权重：用于推荐、置顶等 |
| `crawlStatus` | enum | 'complete' | 爬取状态：`pending`/`partial`/`complete` |
| `lastCrawledAt` | timestamp | null | 最后爬取时间 |
| `totalPlayers` | integer | 0 | 总播放源数量：源站显示的播放源总数 |
| `crawledPlayers` | integer | 0 | 已爬取播放源数量：已成功抓取的播放源数 |

**设计说明**:
- `metadataLocked = true` 时，爬虫跳过元数据更新（title, description, genres 等），但仍可添加新播放源
- `crawlStatus` 用于追踪爬取进度：
  - `pending`: 新发现但未爬取
  - `partial`: 部分内容已爬取（如只有元数据，缺少播放源）
  - `complete`: 所有内容已爬取（`crawledPlayers >= totalPlayers`）
- `sortOrder` 用于人工干预排序，高权重内容优先展示

### Audit Logs 表

审计日志记录所有管理员的 CUD 操作（Create, Update, Delete），用于：
- 操作追溯和审计
- 安全事件调查
- 数据恢复参考

**记录范围**:
- ✅ 所有 POST/PUT/PATCH/DELETE 操作
- ✅ 批量操作（单条日志，`affectedCount` 标记数量）
- ❌ 读取操作（GET）不记录

**Changes 字段格式**:

```json
{
  "before": {
    "title": "旧标题",
    "isR18": false
  },
  "after": {
    "title": "新标题",
    "isR18": true
  }
}
```

**数据保留策略**:
- 数据库保留 90 天
- 超过 90 天的日志归档到 R2
- 提供手动导出功能

---

## 使用方式

### 开发环境

```typescript
import { db } from '@starye/db'
import { auditLogs, movies } from '@starye/db/schema'

// 查询电影（支持新字段）
const lockedMovies = await db.query.movies.findMany({
  where: eq(movies.metadataLocked, true),
})

// 记录审计日志
await db.insert(auditLogs).values({
  id: generateId(),
  userId: user.id,
  userEmail: user.email,
  action: 'UPDATE',
  resourceType: 'movie',
  resourceId: movie.id,
  resourceIdentifier: movie.code,
  changes: {
    before: { title: '旧标题' },
    after: { title: '新标题' },
  },
  ipAddress: request.headers.get('CF-Connecting-IP'),
  userAgent: request.headers.get('User-Agent'),
})
```

### 迁移命令

```bash
# 生成迁移文件
pnpm --filter @starye/db run generate

# 应用迁移
pnpm --filter @starye/db run migrate

# 运行数据迁移脚本
pnpm tsx packages/db/scripts/migrate-movies-metadata.ts

# 打开 Drizzle Studio（可视化工具）
pnpm --filter @starye/db run studio
```

---

## 索引优化说明

### Movies 表索引策略

```sql
-- 单字段索引（用于常见查询）
CREATE INDEX idx_movie_code ON movie(code);
CREATE INDEX idx_movie_release_date ON movie(release_date);
CREATE INDEX idx_movie_created_at ON movie(created_at);
CREATE INDEX idx_movie_sort_order ON movie(sort_order);
CREATE INDEX idx_movie_crawl_status ON movie(crawl_status);

-- 查询性能预期
-- 按番号查询：O(log n)
-- 按日期排序：O(log n)
-- 按爬取状态筛选：O(log n)
```

### Audit Logs 表索引策略

```sql
-- 单字段索引
CREATE INDEX idx_audit_user_id ON audit_log(user_id);
CREATE INDEX idx_audit_resource_type ON audit_log(resource_type);
CREATE INDEX idx_audit_created_at ON audit_log(created_at);

-- 组合索引（用于复杂查询）
CREATE INDEX idx_audit_resource_composite ON audit_log(resource_type, resource_id);

-- 查询性能预期
-- 按用户查询：O(log n)
-- 按资源类型查询：O(log n)
-- 按时间范围查询：O(log n)
-- 查询特定资源的历史：O(log n) via 组合索引
```

---

## 数据完整性约束

### 外键约束

- `audit_log.user_id` → `user.id`
- `movie.players` → 级联删除（删除电影时自动删除播放源）
- `comic.chapters` → 级联删除（删除漫画时自动删除章节和页面）

### Check 约束

- `comic.crawl_status` - 必须是 'pending', 'partial', 'complete' 之一
- `movie.crawl_status` - 必须是 'pending', 'partial', 'complete' 之一

### 唯一约束

- `movie.code` - 番号唯一
- `movie.slug` - URL Slug 唯一
- `actor.name` - 演员名称唯一（用于去重）
- `publisher.name` - 厂商名称唯一（用于去重）

---

## 相关文档

- [迁移指南](./MIGRATION.md) - 数据库迁移详细步骤
- [Drizzle ORM 文档](https://orm.drizzle.team/)
- [Cloudflare D1 文档](https://developers.cloudflare.com/d1/)
