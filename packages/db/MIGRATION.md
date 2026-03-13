# 数据库迁移指南

## 迁移说明

### 迁移 0013: 管理后台增强（Movies 表扩展 + 审计日志）

**日期**: 2026-03-13
**变更**: enhance-admin-dashboard

#### 新增字段（Movies 表）

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `metadataLocked` | boolean | false | 锁定元数据，防止爬虫覆盖 |
| `sortOrder` | integer | 0 | 人工排序权重（越大越靠前）|
| `crawlStatus` | enum | 'complete' | 爬取状态（pending/partial/complete）|
| `lastCrawledAt` | timestamp | null | 最后爬取时间 |
| `totalPlayers` | integer | 0 | 总播放源数量 |
| `crawledPlayers` | integer | 0 | 已爬取播放源数量 |

#### 新增索引（Movies 表）

- `idx_movie_code` - 番号索引（用于快速查询）
- `idx_movie_release_date` - 发布日期索引（用于排序）
- `idx_movie_created_at` - 创建时间索引（用于排序）
- `idx_movie_sort_order` - 人工排序索引（用于排序）
- `idx_movie_crawl_status` - 爬取状态索引（用于筛选）

#### 新增表（Audit Logs）

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | text | 主键 |
| `userId` | text | 操作者 ID |
| `userEmail` | text | 操作者邮箱（冗余，便于查询）|
| `action` | text | 操作类型（CREATE/UPDATE/DELETE/BULK_*）|
| `resourceType` | text | 资源类型（comic/movie/chapter/player/actor/publisher/user）|
| `resourceId` | text | 资源 ID（批量操作时为 null）|
| `resourceIdentifier` | text | 资源标识符（slug/code）|
| `affectedCount` | integer | 批量操作影响的数量 |
| `changes` | json | 变更详情（before/after）|
| `ipAddress` | text | IP 地址 |
| `userAgent` | text | User Agent |
| `createdAt` | timestamp | 创建时间 |

#### 审计日志索引

- `idx_audit_user_id` - 用户 ID 索引
- `idx_audit_resource_type` - 资源类型索引
- `idx_audit_created_at` - 创建时间索引
- `idx_audit_resource_composite` - 组合索引（resourceType + resourceId）

---

## 运行迁移步骤

### 1. 本地开发环境

```bash
# 1. 确保 .env 配置了数据库连接
# DATABASE_URL=file:./dev.db  # 本地 SQLite
# 或
# DATABASE_URL=libsql://your-turso-database.turso.io
# DATABASE_AUTH_TOKEN=your-token

# 2. 应用 Schema 迁移
pnpm --filter @starye/db run migrate

# 3. 运行数据迁移脚本（为现有 movies 计算 totalPlayers）
pnpm tsx packages/db/scripts/migrate-movies-metadata.ts
```

### 2. 生产环境

**重要：生产环境迁移需要谨慎操作**

```bash
# 1. 备份数据库（Turso）
# 使用 Turso CLI 创建快照
turso db shell <db-name> --command ".backup backup-$(date +%Y%m%d).db"

# 2. 在 staging 环境测试迁移
# 确保迁移脚本无误

# 3. 应用生产环境迁移
# 设置生产环境的 DATABASE_URL 和 DATABASE_AUTH_TOKEN
pnpm --filter @starye/db run migrate

# 4. 运行数据迁移
pnpm tsx packages/db/scripts/migrate-movies-metadata.ts

# 5. 验证数据
# 检查 movies 表新增字段是否正确
turso db shell <db-name> --command "SELECT id, totalPlayers, crawlStatus FROM movie LIMIT 10;"
```

### 3. Cloudflare D1（如使用）

```bash
# 1. 生成 SQL 迁移
# 已完成：drizzle/0013_rainy_bastion.sql

# 2. 应用到 D1
wrangler d1 execute <database-name> --file=packages/db/drizzle/0013_rainy_bastion.sql

# 3. 运行数据迁移（需要适配为 D1 Workers）
# 或手动在 D1 Console 执行 UPDATE 语句
```

---

## 验证迁移

### 检查 Movies 表

```sql
-- 验证新增字段
SELECT
  code,
  title,
  metadataLocked,
  sortOrder,
  crawlStatus,
  totalPlayers,
  crawledPlayers
FROM movie
LIMIT 5;

-- 验证索引
SELECT * FROM sqlite_master
WHERE type='index' AND tbl_name='movie';
```

### 检查 Audit Logs 表

```sql
-- 验证表结构
SELECT * FROM audit_log LIMIT 1;

-- 验证索引
SELECT * FROM sqlite_master
WHERE type='index' AND tbl_name='audit_log';
```

---

## 回滚步骤

如果迁移出现问题，可以回滚：

### 回滚 Movies 表字段

```sql
-- SQLite 不支持 DROP COLUMN，需要重建表
-- 方案 1: 保留字段但不使用（推荐）
-- 方案 2: 使用 SQLite 重建表语法（复杂，风险高）

-- 恢复数据库快照（Turso）
turso db shell <db-name> --command ".restore backup-20260313.db"
```

### 回滚代码

```bash
# 回退 schema.ts 到之前的版本
git checkout HEAD~1 -- packages/db/src/schema.ts

# 重新生成迁移
pnpm --filter @starye/db run generate
```

---

## 故障排查

### 问题 1: 迁移脚本找不到电影

**症状**: `找到 0 部电影`

**解决**:
- 检查 DATABASE_URL 是否指向正确的数据库
- 确认 movies 表中有数据：`SELECT COUNT(*) FROM movie;`

### 问题 2: totalPlayers 计算不准确

**症状**: `totalPlayers` 值为 0，但实际有播放源

**解决**:
- 手动运行查询验证：
  ```sql
  SELECT m.id, m.code, COUNT(p.id) as player_count
  FROM movie m
  LEFT JOIN player p ON p.movie_id = m.id
  GROUP BY m.id;
  ```
- 重新运行数据迁移脚本

### 问题 3: 迁移超时（数据量大）

**症状**: 脚本执行时间过长

**解决**:
- 分批处理：修改脚本，每次处理 100 条
- 使用批量更新语句（SQL 优化）
