## ADDED Requirements

### Requirement: 最新发布浏览页路由
Movie App MUST 新增 `/new-releases` 路由，对应 `NewReleases.vue` 页面，展示按发布时间组织的影片时间线。

- 路由路径 MUST 为 `/new-releases`，无需登录验证（公开访问）
- 底部导航栏 MUST 新增"新片"入口，点击跳转 `/new-releases`

#### Scenario: 访问新片页面
- **WHEN** 用户点击底部导航"新片"入口
- **THEN** MUST 跳转到 `/new-releases`，显示最新发布影片列表

---

### Requirement: 最新发布页年份 Tab 筛选
最新发布页顶部 MUST 提供年份 Tab 列表，用户可快速切换查看不同年份的影片。

- MUST 展示近 5 个自然年（含当前年）作为 Tab，最新年份在左
- 默认选中当前年份 Tab
- 切换年份 Tab 时 MUST 重新请求对应年份的影片（`yearFrom=X&yearTo=X`），并重置到第 1 页
- 当前激活年份 MUST 同步到 URL query `?year=`，刷新后 MUST 恢复

#### Scenario: 默认展示当前年
- **WHEN** 用户访问 `/new-releases`（无 year 参数）
- **THEN** MUST 默认激活当前年份 Tab，请求该年份影片（`yearFrom=当前年&yearTo=当前年`）

#### Scenario: 切换年份 Tab
- **WHEN** 用户点击"2024"Tab
- **THEN** MUST 请求 `yearFrom=2024&yearTo=2024`，影片列表更新，URL 更新为 `?year=2024`

#### Scenario: URL 年份参数恢复
- **WHEN** 用户访问 `/new-releases?year=2023`
- **THEN** MUST 激活"2023"Tab 并加载该年份影片

---

### Requirement: 最新发布页影片按月分组展示
最新发布页 MUST 将当前年份的影片按 `releaseDate` 月份分组展示，每组显示月份标题。

- 影片 MUST 按 `releaseDate DESC` 排序，月份组 MUST 按月份倒序展示（最新月份在上）
- 每组 MUST 显示月份标题（如"2026 年 4 月"）及该月影片数量
- `releaseDate` 为 null 的影片 MUST 不出现在此页面
- 若当前年份无任何有 releaseDate 的影片，MUST 展示"该年份暂无发布日期数据"提示

#### Scenario: 正常展示月份分组
- **WHEN** 2026 年有 15 部影片（4月10部、3月5部）
- **THEN** MUST 展示"2026 年 4 月（10 部）"区块在上，"2026 年 3 月（5 部）"区块在下

#### Scenario: 当年无有效 releaseDate 影片
- **WHEN** 选中年份的所有影片 releaseDate 均为 null
- **THEN** MUST 展示"该年份暂无发布日期数据"空状态

---

### Requirement: 最新发布页分页
最新发布页 MUST 支持分页，复用现有 `GET /public/movies` 分页机制。

- MUST 每页展示 20 部影片，支持翻页
- 翻页时 MUST 页面滚动到顶部

#### Scenario: 影片超过一页
- **WHEN** 当年有 35 部影片，用户在第 1 页
- **THEN** MUST 展示第 1 页 20 部，分页器显示"1 / 2"，翻页后加载剩余 15 部
