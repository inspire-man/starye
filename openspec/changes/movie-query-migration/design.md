## Context

当前 Public Movies API 有两套数据路径：

```
旧路径（即将被清理）:
  movies.actors   (JSON text)  ──LIKE──▶ 演员筛选 / 相关影片推荐
  movies.publisher (text)      ──LIKE──▶ 厂商筛选

新路径（关联表，已有数据）:
  movie_actors    (movieId → actorId)    ── Admin API 已使用
  movie_publishers (movieId → publisherId) ── Admin API 已使用
```

Admin API（`/api/admin/movies`）已经完全使用关联表（通过 Drizzle `with` 关系查询），但 Public API 仍依赖旧字段。

关联表已有完整数据（由爬虫同步写入），索引也已建立：
- `idx_movie_actor` (movieId, actorId) UNIQUE
- `idx_movie_actor_actor_id` (actorId) — 反向查询索引
- `idx_movie_pub` (movieId, publisherId) UNIQUE
- `idx_movie_pub_publisher_id` (publisherId) — 反向查询索引

## Goals / Non-Goals

**Goals:**
- 将 Public Movies API 的演员/厂商筛选和相关影片推荐查询迁移到关联表
- 保持 API 响应格式完全不变（客户端零修改）
- 影片详情接口返回结构化的演员/厂商对象（而非旧 JSON 字符串）

**Non-Goals:**
- 不修改 Admin API（已使用关联表）
- 不修改客户端代码（响应格式兼容）
- 不删除旧 `movies.actors` / `movies.publisher` 字段（由 cleanup 脚本处理）
- 不修改爬虫的写入逻辑

## Decisions

### Decision 1: 列表筛选 — 使用 subquery 而非 JOIN

**选择**: 演员/厂商筛选使用 `EXISTS` 子查询而非 `JOIN`。

**理由**: `JOIN` 关联表后会产生重复行（一部电影有多个演员时），需要额外 `DISTINCT` 或 `GROUP BY`，在 D1 (SQLite) 上的性能更差且复杂度更高。`EXISTS` 子查询语义清晰，且 SQLite 对此有良好优化。

```sql
-- 演员筛选
WHERE EXISTS (
  SELECT 1 FROM movie_actor ma
  JOIN actor a ON ma.actor_id = a.id
  WHERE ma.movie_id = movie.id AND a.slug = :actorSlug
)
```

**替代方案**: `JOIN + DISTINCT` — 语义不够清晰，D1 上 DISTINCT 开销大。

### Decision 2: 详情页演员/厂商 — 使用 Drizzle `with` 关系查询

**选择**: 复用 Drizzle schema 中已定义的 relations，使用 `db.query.movies.findFirst({ with: { movieActors: { with: { actor } } } })`。

**理由**: Admin API 已经用这个模式成功运行，复用同样的查询模式减少认知负担和 bug 可能性。

### Decision 3: 相关影片推荐 — 基于共同演员数量排序

**选择**: 查找与当前影片有共同演员的其他影片，按共同演员数量降序排列。

```sql
SELECT m.*, COUNT(DISTINCT ma2.actor_id) as shared_actors
FROM movie m
JOIN movie_actor ma2 ON m.id = ma2.movie_id
WHERE ma2.actor_id IN (
  SELECT actor_id FROM movie_actor WHERE movie_id = :currentMovieId
)
AND m.id != :currentMovieId
GROUP BY m.id
ORDER BY shared_actors DESC
LIMIT 6
```

同时保留原有的「同系列」逻辑，两者取并集后去重。

**替代方案**: 仅按第一个演员筛选（现有逻辑）— 推荐质量差，一个多人作品可能完全忽略其他演员。

### Decision 4: 筛选参数语义变更 — actor 参数改为 slug

**选择**: `?actor=xxx` 参数从原来的模糊匹配演员名改为精确匹配 `actor.slug`。

**理由**: 关联表是通过 ID 关联的，模糊匹配名称需要额外 JOIN + LIKE，而 slug 是唯一索引，查询更精确高效。客户端搜索页的演员筛选是文本输入框，改为 slug 匹配后需要确认客户端传参是否兼容。

**兼容策略**: 同时支持 slug 和 name 模糊匹配 — 先精确匹配 slug，未命中则退化为 name LIKE。

## Risks / Trade-offs

- **[性能] EXISTS 子查询在大表上的表现** → D1 表规模不大（< 10 万），SQLite 对 EXISTS 优化良好，风险低。可通过 `EXPLAIN QUERY PLAN` 验证。
- **[兼容] 筛选结果可能与旧实现略有差异** → 旧实现是 JSON text LIKE 模糊匹配（可能匹配到子串），新实现是精确关联。结果更准确，但可能少返回一些误匹配的结果。这是正向改进。
- **[数据] 关联表数据不完整** → 如果部分电影未正确建立关联表记录，这些电影将无法被筛选到。需在迁移前验证关联表的数据覆盖率。
