## Why

当前影片详情页缺少播放源和下载信息展示，用户需要手动搜索磁链并在外部下载工具中管理下载任务。这导致用户体验割裂，找到想看的影片后无法便捷地获取下载资源。虽然数据库中已存储播放源信息（players 表），但前端未展示，造成数据价值浪费。

此变更旨在打通"发现内容 → 获取资源 → 管理下载"的完整用户旅程，提升内容消费体验。

## What Changes

- 影片详情页新增播放源区块，展示所有可用的播放源（在线播放、磁力链接等）
- 实现磁链一键复制功能（使用浏览器 Clipboard API）
- 支持 magnet:// 协议链接，直接调用系统默认 BT 客户端
- 新增"我的下载列表"功能，用户可标记和管理计划下载的影片
- 优化播放源排序逻辑（优先显示高清源和磁力链接）
- 新增下载状态管理（计划下载、下载中、已完成）

此变更 MUST 保持向后兼容，不影响现有影片浏览和详情页基础功能。

## Capabilities

### New Capabilities

- `movie-playback-sources-display`: 影片详情页播放源展示能力，包括数据读取、UI 渲染、交互逻辑
- `magnet-link-management`: 磁链管理能力，包括复制、协议调用、用户反馈
- `user-download-list`: 用户下载列表管理能力，包括添加、状态标记、列表展示

### Modified Capabilities

- `movie-app-frontend`: 现有电影应用前端需要修改详情页布局，新增个人中心下载列表页面
- `public-api`: API 需要确保播放源数据的返回格式和权限控制

## Impact

**前端影响：**
- `apps/movie-app/src/views/MovieDetail.vue`: 需要新增播放源区块
- `apps/movie-app/src/views/Profile.vue`: 需要新增下载列表 tab
- `apps/movie-app/src/api/`: 可能需要新增下载列表相关 API 调用
- `apps/movie-app/src/stores/`: 可能需要新增下载列表状态管理

**后端影响：**
- `apps/api/src/routes/movies.ts`: 确认播放源数据是否完整返回
- 可能需要新增用户下载列表相关 API（如果使用服务端存储）

**数据库影响：**
- 可能需要新增 `user_downloads` 表（如果使用服务端存储方案）
- 或使用浏览器 localStorage（轻量级方案）

**依赖变更：**
- 无新增外部依赖，使用浏览器原生 API（Clipboard API、localStorage）
