## Context

Movie App 当前影片列表接口（`GET /public/movies`）仅支持 genre、actor、publisher、series、search 文本筛选，以及 sortBy/sortOrder 排序，**不支持年份范围和时长范围过滤**。首页仅有"继续观看"和影片列表，缺乏推荐区块和时间线浏览入口。

DB 现有字段：
- `movies.releaseDate`：`integer (timestamp)` — 可做年份范围过滤
- `movies.duration`：`integer (分钟)` — 可做时长过滤
- `movies.viewCount`：`integer` — 已用于热门排序
- `watching_progress`：关联 `movieCode`，记录 `progress`/`duration` — 可提取用户偏好

部署环境为 Cloudflare Workers + D1(SQLite)，须注意 CPU 时间限制，推荐接口**最多 3 次串行 DB 查询**。

## Goals / Non-Goals

**Goals:**
- 扩展 `GET /public/movies` 支持年份范围和时长范围参数
- 首页新增 inline 高级筛选面板（年份 + 时长），URL 状态同步
- 新增 `/new-releases` 路由，前端按月分组展示影片
- 新增 `GET /public/movies/recommended` 接口，首页展示"猜你喜欢"区块

**Non-Goals:**
- 不做协同过滤（user-item matrix）或 ML 推荐
- 不新增 DB schema / migration
- 不做高级筛选的服务端分面计数（facet counts）
- 不实现用户主动管理推荐偏好的界面

## Decisions

### 决策 1：扩展现有列表接口而非新建

**选择**：在 `GET /public/movies` 的 `GetMoviesQuerySchema` 中追加 `yearFrom`、`yearTo`、`durationMin`、`durationMax` 参数。

**备选**：新建 `/public/movies/filter` 端点。

**理由**：现有端点已有完整的分页、R18、排序逻辑；新端点会造成功能重复。最新发布页和高级筛选面板均可复用同一端点，`api-client.ts` 的调用方式也保持一致。

### 决策 2：年份过滤使用 SQLite 时间范围计算

```sql
-- yearFrom=2024 → release_date >= 2024-01-01 00:00:00 UTC (Unix)
-- yearTo=2025   → release_date <= 2025-12-31 23:59:59 UTC (Unix)
WHERE release_date >= strftime('%s', '2024-01-01')
  AND release_date <= strftime('%s', '2026-01-01') - 1
```

**备选**：`strftime('%Y', datetime(release_date,'unixepoch')) = '2024'`（按年字符串匹配）。

**理由**：时间戳范围比较能使用索引（若存在），字符串函数则不走索引。使用 `yearFrom` 转换为年初 Unix 秒数、`yearTo` 转换为年末 Unix 秒数，在 Drizzle `sql` 模板中直接计算，无需额外依赖。

### 决策 3：推荐算法采用 content-based + 3次 DB 查询

```
Query 1: SELECT movieCode FROM watching_progress
         WHERE userId = ? ORDER BY updatedAt DESC LIMIT 30

Query 2: SELECT genres, actors FROM movies
         WHERE code IN (Query1 结果)

内存计算: 提取 top3 genres + top5 actorIds（频次排序）

Query 3: SELECT * FROM movies
         WHERE JSON_EACH genre overlap OR actor overlap
         AND code NOT IN (watched)
         ORDER BY viewCount DESC LIMIT 12
```

D1 三次串行查询在典型数据量下（< 1000 部影片）预计总耗时 < 30ms，在 Workers CPU 限制内。

**冷启动降级**：无历史记录时 Query 1 返回空集，直接降级调用 `getHotMovies(limit=12)`。

### 决策 4：高级筛选面板 inline 展开

时长分段使用**固定按钮组**而非自由输入 Slider，原因：
- Slider 在移动端触摸体验差
- 影片库时长分布通常集中在 60-180 分钟，固定分段够用
- 按钮组状态简单，URL 序列化为单个字符串参数（`short` / `medium` / `long` / 空）

年份使用**两个 number input**（from / to），限制范围 2000 ~ 当前年，空值表示不过滤。

### 决策 5：最新发布页前端分组

新接口或复用现有接口？**复用**。

`/new-releases` 页面请求 `GET /public/movies?sortBy=releaseDate&sortOrder=desc&yearFrom=X&yearTo=X`（年份 Tab 切换），前端按 `releaseDate` 月份用 `computed` 分组展示，**不新增 API**。

releaseDate 为 null 的影片在此页**不展示**（过滤掉），因为时间线语义要求有明确发布日期。

## Risks / Trade-offs

| 风险 | 缓解措施 |
|------|----------|
| releaseDate 覆盖率不足，最新发布页内容稀疏 | 页面展示数量说明；为空时提示"该年份暂无有发布日期的影片" |
| 推荐接口 Query 3 actor JSON_EACH 性能 | LIMIT 30 历史 → top5 actorIds；Cloudflare D1 CPU 软限 10ms/请求，实测超限时降级热门 |
| 年份范围与 R18 组合导致结果过少 | 现有 R18 过滤逻辑已在 `conditions` 数组中，组合过滤正常工作 |
| 高级筛选 URL 参数过多影响分享体验 | 仅筛选有值时写入 URL，其余不写（`syncUrl` 已有此模式） |

## Migration Plan

- 无 DB schema 变更，无 migration 文件
- API 为纯增量扩展（新参数均有默认值/可选），现有调用方不受影响
- 前端新增路由 `/new-releases`，不修改现有路由

## Open Questions

- `movies.duration` 字段单位确认为**分钟**（非秒），需在实现前从实际数据验证（短片典型值应在 60-180 分钟范围）
- 推荐接口 Query 3 中 actor 匹配：`movies.actors` 为 JSON 数组（存 actor name 还是 actor id？），需查实际数据确认，以决定 Query 2→3 的关联字段
</parameters>
</invoke>