# player-rating-ui

## 描述

在电影详情页的播放源列表中，为每个 player 提供星级评分展示与提交功能。

## Requirements

- REQ-1: 每个 player 卡片 MUST 展示平均评分（averageRating）和评分人数（ratingCount），无评分时显示"暂无评分"
- REQ-2: 已登录用户 MUST 能点击 1-5 星为 player 评分，调用 `POST /ratings` API
- REQ-3: 用户自己的评分（userScore）MUST 在 UI 上高亮显示
- REQ-4: 未登录用户点击评分时 SHALL 弹出 Toast 提示"请先登录后评分"
- REQ-5: 评分提交成功后 MUST 乐观更新本地 averageRating 和 ratingCount 显示
- REQ-6: 重复评分（修改评分）MUST 被支持，后端已实现 upsert
