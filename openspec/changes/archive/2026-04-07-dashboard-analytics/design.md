## Context

`movies.view_count` 字段已在生产环境积累数据，`/public/movies/genres` 聚合接口也已就绪，但 Dashboard 管理端对这些数据没有任何消费。当前 `GET /api/admin/stats` 只返回总量计数（影片数、女优数等），无法回答"哪些影片最热门"和"哪些 Genre 占比最高"的运营问题。

## Goals / Non-Goals

**Goals:**
- 新增 `GET /api/admin/movies/analytics` 接口，返回热门 Top 10 排行 + Genre 分布
- Dashboard 首页新增两个 section 展示上述数据
- 接口仅限管理员访问（需 admin 鉴权）

**Non-Goals:**
- 不提供时间维度的趋势图（用户活跃趋势留待后续）
- 不提供影片维度的详细统计（如每部影片的日/周 viewCount 曲线）
- 不修改 DB schema

## Decisions

### 1. 新增独立 analytics 端点，不复用公开接口

`/admin/movies/analytics` 与 `/public/movies/genres` 虽然数据来源相似，但面向对象不同（管理员 vs 普通用户）、鉴权要求不同、返回字段也更丰富（热门排行需要 code、title、coverImage、viewCount）。复用会导致公开接口职责膨胀，选择独立端点职责更清晰。

**热门排行查询：**
```sql
SELECT id, code, title, cover_image, view_count, is_r18
FROM movie
ORDER BY view_count DESC
LIMIT 10
```

**Genre 分布复用 json_each 聚合：**
```sql
SELECT value AS genre, count(*) AS count
FROM movie, json_each(movie.genres)
WHERE json_each.value != ''
GROUP BY genre
ORDER BY count DESC
LIMIT 50
```
管理端不过滤 R18（管理员需要看全量数据）。

### 2. 两个查询合并为单次请求

`/admin/movies/analytics` 在一个 handler 中并行执行两个查询（`Promise.all`），前端一次请求获取全部数据，减少 Dashboard 首屏请求数。

### 3. Dashboard 前端新增独立 section，不修改现有统计卡片

在 `Home.vue` 的"爬取状态"section 下方新增"内容洞察"section，包含：
- 热门影片排行：简单列表，序号 + 标题 + viewCount + 点击跳转 `/movies?code=xxx`
- Genre 分布：列表形式展示 genre name + count + 进度条（count / total * 100%）

选择列表而非图表（echarts/chart.js），避免引入新依赖，与 Dashboard 现有 UI 风格保持一致。

## Risks / Trade-offs

- **[风险] viewCount 初期数据量少，排行意义有限** → 缓解：随使用积累自然增长；初期显示"暂无数据"占位即可
- **[风险] json_each 在大量影片时性能** → 缓解：与公开 `/genres` 接口相同的查询模式，已验证可行；管理员使用频率低，可接受
- **[取舍] 无缓存** → 管理员操作，访问频率极低，实时查询即可，不引入缓存复杂度
