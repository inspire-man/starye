# Movie 模块 Bug 修复 + Dashboard 播放源管理

## 背景

在探索 movie 模块现状后，发现以下两类问题：

1. **公共 API 静默 Bug**：`movie.service.ts` 中存在参数名错误和逻辑错误，导致 publisher 过滤从未生效，sortBy/sortOrder 参数被完全忽略，以及 `getHotMovies` 实际返回"最新"而非"热门"内容。这些 Bug 对用户透明，一直潜伏至今。

2. **Dashboard 播放源管理残缺**：Admin API 已完整实现播放源的 CRUD 端点，`dashboard/api.ts` 客户端方法也已存在，但 `Movies.vue` 的 Players Tab 只有只读展示，管理功能（添加、编辑、删除）从未接入，导致管理员无法通过 UI 维护播放源数据。

## 目标

- 修复公共 API 的三处 Bug，使 publisher 过滤、sortBy/sortOrder 排序、热门榜单逻辑正确工作
- 在 Dashboard `Movies.vue` 的 Players Tab 补全 inline CRUD 操作，让管理员可以直接添加、编辑、删除播放源

## 非目标

- **不做**播放源批量导入 UI（API 已存在，可后续迭代）
- **不做**播放源拖拽排序
- **不做**观看历史页、Genre 浏览页等其他功能方向
- **不做** DB schema 变更（现有字段已满足需求）
- **不做** `viewCount` 热门算法（方案 α 已足够，真实热度留待后续）

## 范围

**涉及应用**：`apps/api`、`apps/dashboard`

### A. API Bug 修复（apps/api）

**A1 — publisher 过滤修复**
- 文件：`apps/api/src/routes/movies/handlers/movies.handler.ts`
- 文件：`apps/api/src/routes/movies/services/movie.service.ts`
- 当前 handler 读取 `publisherId` 参数（名称错误），service 中 `eq(moviesTable.id, publisherId)` 将电影 ID 与 publisher 值对比（逻辑错误）
- 修复：handler 改为读 `publisher` 参数，service 改为 `like(moviesTable.publisher, '%xxx%')`

**A2 — sortBy/sortOrder 实现**
- 文件：`apps/api/src/routes/movies/services/movie.service.ts`
- 当前 `GetMoviesOptions` 不接受 `sortBy`/`sortOrder`，排序硬编码为 `desc(movies.createdAt)`
- 修复：`GetMoviesOptions` 增加两个可选参数，service 内根据参数动态构建 `orderBy`；handler 从 query 中传入

**A3 — getHotMovies 排序修复**
- 文件：`apps/api/src/routes/movies/services/movie.service.ts`
- 当前以 `createdAt DESC` 排序，语义是"最新"而非"热门"
- 修复：改为 `sortOrder DESC, createdAt DESC`，管理员手动权重优先、兜底用创建时间

### B. Dashboard 播放源管理（apps/dashboard）

**B — Players Tab inline CRUD**
- 文件：`apps/dashboard/src/views/Movies.vue`
- 在现有 Players Tab 基础上补全 UI 交互，API 客户端方法已全部就绪
- 添加播放源：Tab 顶部"+ 添加"按钮，展开内联表单（sourceName、sourceUrl、quality）
- 编辑播放源：每行"编辑"按钮，行内展开编辑字段，确认保存
- 删除播放源：每行"删除"按钮，二次确认后删除

## 风险

- A1/A2 修复后，已有前端对排序和 publisher 过滤的行为可能发生变化（原本无效变有效）；前端 movie-app 传参本身正确，修复后行为符合预期，风险低
- B 中删除播放源为不可逆操作，**MUST** 提供二次确认，防止误操作
- B 中 inline 编辑状态存在于 `Movies.vue` 组件内存，刷新/关闭 modal 后丢失，属于预期行为

## 里程碑

1. A1 + A2 + A3 打包提交（纯后端，可独立验证）
2. B Players Tab CRUD 提交（纯前端，可独立验证）
