## ADDED Requirements

### Requirement: 影片详情页展示系列导航
当影片属于某个系列（`series` 字段非空）时，详情页 MUST 展示系列导航区块，让用户感知当前位置并跳转相邻影片。

- MUST 显示当前影片在系列中的位置：「第 N 部 / 共 M 部」
- MUST 提供"上一部"链接（若存在）；不存在时 MUST 禁用/隐藏
- MUST 提供"下一部"链接（若存在）；不存在时 MUST 禁用/隐藏
- 系列内顺序 MUST 按 `releaseDate ASC` 排列（无 releaseDate 的按 `code ASC` 兜底）
- 导航数据 MUST 从 `relatedMovies`（同系列部分）前端推导，不新增 API 请求
- 影片无系列时（`series == null`），MUST 不渲染系列导航区块

#### Scenario: 系列中间位置的影片
- **WHEN** 影片位于系列第 2 部（共 4 部）
- **THEN** MUST 显示「第 2 部 / 共 4 部」，"上一部"和"下一部"链接均可点击

#### Scenario: 系列第一部影片
- **WHEN** 影片位于系列第 1 部
- **THEN** MUST 显示「第 1 部 / 共 N 部」，"上一部"按钮 MUST 禁用或不显示

#### Scenario: 系列最后一部影片
- **WHEN** 影片位于系列最后一部
- **THEN** "下一部"按钮 MUST 禁用或不显示

#### Scenario: 无系列的影片
- **WHEN** 影片 `series` 字段为 null
- **THEN** 系列导航区块 MUST 不渲染

### Requirement: 播放页同步展示系列导航
播放页（Player.vue）MUST 同步展示与详情页相同逻辑的系列导航，方便用户在播放结束后直接跳转下一部。

#### Scenario: 播放页系列导航跳转
- **WHEN** 用户在播放页点击"下一部"
- **THEN** MUST 跳转至下一部影片的播放页（`/movie/:code/play`）
