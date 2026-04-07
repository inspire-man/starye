## ADDED Requirements

### Requirement: Dashboard 可添加播放源
Dashboard `Movies.vue` 的 Players Tab **SHALL** 提供添加播放源的内联表单，管理员可为当前电影添加新的播放源。

#### Scenario: 成功添加播放源
- **WHEN** 管理员填写 sourceName 和 sourceUrl 后点击「确认添加」
- **THEN** 调用 `POST /api/admin/movies/:id/players`，成功后列表刷新并显示新播放源，Tab 计数同步更新

#### Scenario: 添加重复 sourceUrl
- **WHEN** 管理员输入的 sourceUrl 已存在于该电影的播放源中
- **THEN** 后端返回 409，前端显示"该播放源已存在"错误提示，表单保持展开

#### Scenario: 取消添加
- **WHEN** 管理员点击「取消」
- **THEN** 表单收起，无任何 API 调用，列表不变

### Requirement: Dashboard 可 inline 编辑播放源
Dashboard `Movies.vue` 的 Players Tab **SHALL** 支持行内编辑播放源，每行提供「编辑」按钮，点击后该行切换为编辑态。

#### Scenario: 成功保存编辑
- **WHEN** 管理员修改字段后点击「保存」
- **THEN** 调用 `PATCH /api/admin/movies/players/:id`，成功后该行退出编辑态并显示更新后数据

#### Scenario: 同一时间只有一行处于编辑态
- **WHEN** 管理员点击另一行的「编辑」按钮，当前已有一行在编辑态
- **THEN** 前一行自动退出编辑态（丢弃未保存修改），新行进入编辑态

#### Scenario: 取消编辑
- **WHEN** 管理员点击「取消」
- **THEN** 该行恢复原始数据，无任何 API 调用

### Requirement: Dashboard 可删除播放源（含确认）
Dashboard `Movies.vue` 的 Players Tab **MUST** 在删除播放源前提供行内二次确认，防止误删。

#### Scenario: 确认后删除成功
- **WHEN** 管理员点击「删除」后再点击行内「确认」
- **THEN** 调用 `DELETE /api/admin/movies/players/:id`，成功后该行从列表中移除，Tab 计数减少

#### Scenario: 取消删除
- **WHEN** 管理员点击「删除」后点击「取消」
- **THEN** 行内确认收起，无任何 API 调用，列表不变

#### Scenario: 删除进行中防止重复操作
- **WHEN** 删除请求正在进行中
- **THEN** 删除按钮处于禁用状态，无法再次点击
