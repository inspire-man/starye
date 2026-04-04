## Why

Movie App 客户端目前缺少关键的用户互动反馈机制：播放源点击无任何反馈、播放源无法上报失效、用户评分系统已在后端实现但前端未接入。这导致用户在使用磁力下载时遇到死链无处反馈，优质播放源无法被其他用户识别，整体互动体验停留在静态展示层面。

## What Changes

- **播放源评分**：MovieDetail 播放源列表中为每个 player 添加星级评分组件，接入已有的 `POST /ratings` API
- **播放源失效上报**：每个 player 条目添加"失效上报"按钮，调用后端标记接口（或前端聚合后提交）
- **复制/打开反馈动画**：磁力链接复制按钮点击后的 Toast 提示已存在，确保所有播放源操作均有视觉反馈
- **评分结果展示**：player 列表按平均评分排序并展示星级和评分人数

## Capabilities

### New Capabilities

- `player-rating-ui`: 播放源评分界面 — 前端评分组件与 POST /ratings API 集成，显示平均分和评分人数
- `player-report-invalid`: 播放源失效上报 — 用户可标记无效播放源，供管理员审查

### Modified Capabilities

（无现有 spec 级别行为变更）

## Impact

- **客户端视图**: `apps/movie-app/src/views/MovieDetail.vue` — 播放源列表添加评分和上报功能
- **客户端类型**: `apps/movie-app/src/types.ts` — 扩展 Player 类型
- **客户端 API**: `apps/movie-app/src/lib/api-client.ts` — 添加 rating 和 report 方法
- **后端 API**: `apps/api/src/routes/` — 评分接口已存在；上报接口需确认或新增
- **范围外**: 管理端上报审查界面、邮件通知、批量操作评分
