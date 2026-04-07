## 1. API Bug 修复（apps/api）

- [x] 1.1 修复 publisher 过滤参数名与过滤逻辑
  - 文件：`apps/api/src/routes/movies/handlers/movies.handler.ts`
  - 将 `c.req.query('publisherId')` 改为 `c.req.query('publisher')`，变量名同步改为 `publisher`
  - 文件：`apps/api/src/routes/movies/services/movie.service.ts`
  - `GetMoviesOptions` 字段名从 `publisherId` 改为 `publisher`
  - `FilterBuilder` 中将 `.eq(moviesTable.id, publisherId)` 改为 `.like(moviesTable.publisher, publisher)`
  - **验证**：`GET /api/public/movies?publisher=SOD` 能按厂商名过滤返回结果

- [x] 1.2 实现 sortBy/sortOrder 动态排序
  - 文件：`apps/api/src/routes/movies/services/movie.service.ts`
  - `GetMoviesOptions` 新增 `sortBy?: 'releaseDate' | 'createdAt' | 'updatedAt' | 'title'` 和 `sortOrder?: 'asc' | 'desc'`
  - `getMovies()` 内参考 admin 侧 `buildOrderBy()` 替换硬编码的 `desc(movies.createdAt)`，默认值保持 `createdAt DESC`
  - 文件：`apps/api/src/routes/movies/handlers/movies.handler.ts`
  - 从 query 读取 `sortBy`、`sortOrder` 并传入 `getMovies()`
  - **验证**：`GET /api/public/movies?sortBy=releaseDate&sortOrder=asc` 按发布日期升序返回

- [x] 1.3 修复 getHotMovies 排序为 sortOrder + createdAt
  - 文件：`apps/api/src/routes/movies/services/movie.service.ts`
  - 将 `getHotMovies()` 中 `orderBy: (movies, { desc }) => [desc(movies.createdAt)]` 改为双字段排序：先 `sortOrder DESC`，再 `createdAt DESC`
  - **验证**：手动给某部影片设置 `sortOrder=10`，调用热门接口后该影片排在列表最前面

## 2. Dashboard Players Tab — 添加功能

- [x] 2.1 在 Players Tab 顶部添加「+ 添加播放源」按钮与展开状态管理
  - 文件：`apps/dashboard/src/views/Movies.vue`
  - 在 `<script setup>` 中新增 `showAddForm: ref<boolean>(false)` 和 `newPlayerData: ref({ sourceName: '', sourceUrl: '', quality: '' })`
  - Players Tab 顶部添加「+ 添加播放源」按钮，点击切换 `showAddForm`

- [x] 2.2 实现内联新增表单及提交逻辑
  - 文件：`apps/dashboard/src/views/Movies.vue`
  - `showAddForm` 为 true 时，在列表顶部渲染一行内联表单（sourceName 必填、sourceUrl 必填、quality 可选）
  - 提交调用 `api.admin.addPlayer(editingMovie.value!.id, newPlayerData.value)`
  - 成功：刷新 `players` 列表，重置 `newPlayerData`，关闭表单
  - 失败（409）：调用 `handleError` 显示"该播放源已存在"
  - **验证**：填写合法数据后点击确认，列表立即出现新条目，Tab 标签计数更新

## 3. Dashboard Players Tab — 编辑功能

- [x] 3.1 新增编辑态状态变量
  - 文件：`apps/dashboard/src/views/Movies.vue`
  - 新增 `editingPlayerId: ref<string | null>(null)` 和 `editingPlayerData: ref<Partial<Player>>({})`
  - 编写 `startEditPlayer(player)` 函数：设置 `editingPlayerId` 和 `editingPlayerData`（浅拷贝）
  - 编写 `cancelEditPlayer()` 函数：清空两个 ref

- [x] 3.2 每行 player-item 添加编辑态切换与内联输入框
  - 文件：`apps/dashboard/src/views/Movies.vue`
  - 非编辑态：展示 `sourceName`、`sourceUrl`、`quality`，右侧显示「编辑」按钮
  - 编辑态（`editingPlayerId === player.id`）：三个字段变为输入框，右侧显示「保存」「取消」按钮
  - 点击「编辑」调用 `startEditPlayer(player)`，若已有其他行在编辑态则先自动取消

- [x] 3.3 实现编辑保存逻辑
  - 文件：`apps/dashboard/src/views/Movies.vue`
  - 「保存」调用 `api.admin.updatePlayer(editingPlayerId.value!, editingPlayerData.value)`
  - 成功：局部更新 `players` 列表中对应项数据，调用 `cancelEditPlayer()`
  - 失败：调用 `handleError` 显示错误，保持编辑态
  - **验证**：修改 sourceName 后保存，该行立即显示新名称，不触发整个 players 列表刷新

## 4. Dashboard Players Tab — 删除功能

- [x] 4.1 新增删除确认状态变量
  - 文件：`apps/dashboard/src/views/Movies.vue`
  - 新增 `deletingPlayerId: ref<string | null>(null)` 和 `deletePlayerLoading: ref<boolean>(false)`

- [x] 4.2 每行添加删除按钮与行内二次确认
  - 文件：`apps/dashboard/src/views/Movies.vue`
  - 非确认态：显示「删除」按钮
  - 确认态（`deletingPlayerId === player.id`）：显示「确认删除？」文字 + 「确认」「取消」按钮
  - 确认进行中：「确认」按钮禁用，显示加载状态

- [x] 4.3 实现删除执行逻辑
  - 文件：`apps/dashboard/src/views/Movies.vue`
  - 「确认」调用 `api.admin.deletePlayer(deletingPlayerId.value!)`
  - 成功：从 `players` 列表中移除该项，清空 `deletingPlayerId`，Tab 计数同步减少
  - 失败：调用 `handleError`，清空 loading 状态，保留确认态
  - **验证**：删除一条播放源后列表立即减少一项，Tab 标签计数同步减小
