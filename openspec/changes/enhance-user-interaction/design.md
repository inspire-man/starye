## Context

现有播放源 UI 已支持：复制磁力链接、通过 Aria2 下载、二维码预览。但缺少：评分、失效上报。

后端已有评分表和路由：`POST /ratings`，字段为 `playerId` + `score（1-5）`，并在 `getMovieByIdentifier` 中聚合返回 `averageRating`、`ratingCount`、`userScore`。

## Changes

### 1. 播放源评分组件（`RatingStars.vue`）

复用已有的 `RatingStars` 组件（已在项目中），在每个 player 卡片底部展示：
```
⭐ 4.2 (38人) [我的评分: ★★★★☆]
```

评分交互：
- 点击星级 → 调用 `POST /movie-app-api/ratings` `{ playerId, score }`
- 未登录时展示 Toast 提示登录
- 重复评分时覆盖（后端已支持 upsert）

### 2. 播放源失效上报

每个 player 卡片添加"🚩 上报失效"按钮，交互逻辑：
- 点击 → 弹出确认 Toast（"确认上报此播放源为失效？"）
- 确认后调用 `POST /api/players/:id/report`（需新增此端点）
- 成功后该条目变灰显示"已上报"，防止重复提交

后端新端点设计：
```typescript
POST /api/players/:id/report
Body: { reason?: string }
// 将 player 的 reportCount+1，超过阈值时 isActive=false
```

### 3. Player 类型扩展

```typescript
// types.ts
export interface Player {
  id: string
  sourceName: string
  sourceUrl: string
  quality: string | null
  sortOrder: number
  averageRating?: number
  ratingCount?: number
  userScore?: number         // 已有
  reportCount?: number       // 新增
  isActive?: boolean         // 新增
}
```

### 4. 排序逻辑

播放源列表排序：`sortOrder ASC`（现有），若平均评分存在则在同 sortOrder 内按 `averageRating DESC` 次排序。前端计算，无需后端改动。
