## Context

当前 `GET /public/movies/:code` 已实现相关影片查询（演员优先+系列），但无 genre 兜底，导致关联演员稀少的影片推荐列表为空。系列相关信息虽在 DB 中存在（`movies.series` 字段），但详情页和播放页没有位置感 UI。观看历史页面通过 `progress/duration` 计算进度，但缺少"已看完"的视觉区分。

## Goals / Non-Goals

**Goals:**
- 相关影片在 < 4 条时自动用同 genre 热门补足至 6 条
- 详情页和播放页展示系列位置（第 N 部 / 共 M 部）+ 前后跳转
- 历史页 progress ≥ 0.9 的记录显示"已看完"徽标，支持按完成状态筛选

**Non-Goals:**
- 不引入协同过滤或机器学习推荐
- 不新增系列管理接口（系列数据已存在于 `movies.series` 字段）
- 不修改 DB schema

## Decisions

### 1. Genre Fallback 在 API 层实现，不在前端拼接

在 `GET /:code` handler 内，当 `merged.length < 4` 时追加一次 genre 查询（取当前影片 `genres` JSON 数组的第一个 genre）。选择 API 层而非前端多一次请求，避免额外 RTT 和跨域复杂度。

```
merged.length < 4 ?
  → 查同 genre 热门（viewCount DESC），排除已在 merged 中的 id，LIMIT (6 - merged.length)
  → 追加至 merged
```

边界：若影片 genres 为空，跳过 genre fallback 静默返回当前结果。

### 2. 系列导航数据由前端从 relatedMovies 推导

`relatedMovies` 中已包含同系列影片，前端通过 `releaseDate` 升序排列后计算当前位置，无需新增 API。优点：零后端改动，复用已有数据。缺点：系列影片数超过 6 部时 relatedMovies 可能不完整（当前 limit=6，同系列 limit=6，被演员结果占位后可能截断）。

**补充：当前影片有系列时，系列查询提高 limit 至 8**（`series`优先 slot 保证）。

### 3. Watch Status 完全前端计算，不持久化

`watchedStatus = progress / (duration || 1) >= 0.9`。纯 computed，无需新字段。历史页新增 tab 筛选："全部 / 在看 / 已看完"。

## Risks / Trade-offs

- **[风险] 系列影片 > 6 部时导航不完整** → 缓解：系列结果 limit 提升到 8；完整系列导航可在后续 change 中单独新增专用 API
- **[风险] genre fallback 额外查询增加响应时间** → 缓解：仅在 `merged.length < 4` 时触发，多数影片（有关联演员）不会触发
- **[取舍] watch status 不持久化** → 页面刷新后状态从 progress 实时计算，不需要服务端存储，简单可靠
