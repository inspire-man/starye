# Design: Movie Bug 修复 + Dashboard 播放源管理

## Context

### 当前状态

**公共 API 层（`apps/api/src/routes/movies/`）**

`getMovieList` handler 中存在三处长期静默的 bug：

1. `c.req.query('publisherId')` 读取了不存在的查询参数（前端传的是 `publisher`），同时 service 层将 `eq(moviesTable.id, publisherId)` 用电影自身 ID 与 publisher 值对比，导致 publisher 过滤从来不工作。

2. `GetMoviesOptions` 接口不接受 `sortBy`/`sortOrder` 参数，`getMovies()` 中排序硬编码为 `desc(movies.createdAt)`，`GetMoviesQuerySchema` 中定义的两个字段形同虚设。

3. `getHotMovies()` 同样用 `desc(movies.createdAt)` 排序，语义是"最新"而非"热门"，与路由名称 `/featured/hot` 不符。

**Admin API 层（`apps/api/src/routes/admin/movies/index.ts`）**

播放源 CRUD 端点已全部完整实现：
- `GET    /:id/players`      — 列表
- `POST   /:id/players`      — 新增（含重复检测）
- `PATCH  /players/:id`      — 编辑（含重复 URL 检测）
- `DELETE /players/:id`      — 删除（级联更新 totalPlayers）

`apps/dashboard/src/lib/api.ts` 中的 `api.admin` 对象也已封装全部五个方法（`getPlayers`、`addPlayer`、`updatePlayer`、`deletePlayer`、`batchImportPlayers`）。

**Dashboard `Movies.vue` Players Tab**

当前只做了只读渲染（`loadPlayers` → 展示列表），`player-actions` 区域只有一个被注释掉的"测试"按钮，CRUD 交互完全缺失。

### 约束

- Cloudflare Workers 环境，无文件系统，所有操作走 D1（SQLite）
- `Movies.vue` 已是 1000+ 行的单文件组件，inline 编辑逻辑需要精简，避免进一步膨胀

## Goals / Non-Goals

**Goals:**

- publisher 过滤 **MUST** 按 `movies.publisher` 字段模糊匹配正确工作
- `sortBy`/`sortOrder` 参数 **MUST** 在 public API 中生效
- `getHotMovies` **MUST** 优先返回 `sortOrder` 高的影片，体现人工推荐权重
- Dashboard Players Tab **SHALL** 支持添加、inline 编辑、删除播放源
- 删除操作 **MUST** 有二次确认，防止误删

**Non-Goals:**

- 不引入播放源批量导入 UI
- 不做播放源拖拽排序
- 不做 DB schema 变更
- 不做真实 viewCount 热门算法

## Decisions

### 决策 1：publisher 过滤用名称模糊匹配，而非 entity ID

**选项 A（选用）**：`like(moviesTable.publisher, '%xxx%')` — 按 `movies.publisher` 文本字段模糊查
**选项 B**：通过 `moviePublishers` 关联表做 subquery，按 publisher entity ID 精确过滤

选用 A 的理由：
- 前端 movie-app 传的参数类型是字符串名称（`publisher?: string`），并非 ID
- `movies.publisher` 字段本身就存储了厂商名称文本，与现有 admin 侧 `like(movies.publisher, ...)` 做法一致
- 改动最小（仅一行），无需引入额外 JOIN

---

### 决策 2：sortBy/sortOrder 直接在 public service 层实现，参考 admin 侧

admin 侧已有 `buildOrderBy()` 函数，用相同逻辑复制到 `movie.service.ts` 的 `getMovies()`。

支持字段：`releaseDate`、`createdAt`、`updatedAt`、`title`，默认 `createdAt DESC`（保持现有行为）。

---

### 决策 3：getHotMovies 改为 sortOrder DESC + createdAt DESC

**方案 α（选用）**：`sortOrder DESC, createdAt DESC`  
**方案 β**：按 `ratingCount DESC + averageRating DESC`（需跨表聚合，复杂）  
**方案 γ**：加 `viewCount` 字段（需 DB migration + 前端埋点，超出范围）

方案 α 最务实：管理员可通过手动设置 `sortOrder` 将精选内容置顶，兜底用最近创建时间，零改动 DB。

---

### 决策 4：Players inline 编辑用单一 `editingPlayerId` 状态

Dashboard `Movies.vue` 中增加 `editingPlayerId: ref<string | null>(null)` 和 `editingPlayerData: ref<Partial<Player>>({})`。

- 同一时间只允许一行处于编辑态（切换行时自动丢弃未保存修改）
- 删除确认用 `deletingPlayerId: ref<string | null>(null)` 实现行内确认，不弹全屏 dialog
- 不抽取子组件，保持在 Movies.vue 内实现，避免组件拆分的协调成本

**选用 inline 而非弹窗 modal 的理由**：
Players Tab 本身已在 modal 内，再加一层 modal 体验差；行内展开编辑字段更直观，也符合数据表格的操作惯例。

---

### 决策 5：添加播放源用 Tab 顶部展开表单，而非永久展示输入行

点击"+ 添加"后在列表顶部展开一行表单（`showAddForm: ref<boolean>(false)`），提交/取消后收起。  
这样在无需添加时界面干净，符合现有 modal 的视觉密度。

## Risks / Trade-offs

| 风险 | 缓解措施 |
|------|----------|
| A1/A2 修复后 publisher 过滤和 sortBy 开始生效，前端某些原本"无效静默"的传参会真正触发过滤/排序，可能影响用户感知到的结果集 | 修复方向符合前端传参语义，属于 bug fix 而非 breaking change，风险可接受 |
| B 删除播放源不可逆 | 行内二次确认（MUST），无全局 undo |
| `Movies.vue` 进一步膨胀（预计 +150~200 行） | inline 编辑逻辑集中在 Players Tab 区域，变量命名清晰，后续有需要时可拆出 `PlayerItem.vue` |
| SQLite `like` 模糊匹配无索引，全表扫描 | `movies.publisher` 字段目前无索引，数据量较小时可接受；大规模数据场景可后续加索引 |

## Migration Plan

### 部署步骤

1. 合并 API 修复（里程碑 1）→ 无 DB 迁移，直接部署 Worker
2. 合并 Dashboard 前端（里程碑 2）→ 重新构建 dashboard 静态资源并部署

### 回滚策略

两个里程碑相互独立，任一可单独回滚：
- API 回滚：git revert + 重新部署 Worker
- Dashboard 回滚：git revert + 重新构建部署静态资源

## Open Questions

- `getHotMovies` 的 `limit` 参数当前默认 12，是否合理？ → 暂保持不变，留待产品迭代
- 后续是否要支持 `publisher` 精确按 entity ID 过滤（面向厂商详情页跳转）？ → 当前名称模糊匹配够用，ID 精确过滤留作后续 enhancement
