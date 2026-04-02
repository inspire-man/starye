## ADDED Requirements

### Requirement: checkFavorite API MUST 返回 favoriteId
`GET /favorites/check/:entityType/:entityId` 接口在 `isFavorited: true` 时 SHALL 同时返回 `favoriteId`。

#### Scenario: 已收藏的实体
- **WHEN** 用户检查某实体的收藏状态且该实体已被收藏
- **THEN** 响应 MUST 包含 `{ isFavorited: true, favoriteId: "fav_xxx" }`

#### Scenario: 未收藏的实体
- **WHEN** 用户检查某实体的收藏状态且该实体未被收藏
- **THEN** 响应 MUST 包含 `{ isFavorited: false, favoriteId: null }`

### Requirement: 详情页 MUST 支持取消收藏
`MovieDetail.vue` 的收藏按钮在已收藏状态下 SHALL 调用 `DELETE /favorites/:id` 完成取消收藏。

#### Scenario: 取消收藏成功
- **WHEN** 用户在已收藏影片的详情页点击取消收藏按钮
- **THEN** 系统 MUST 调用 `DELETE /favorites/:favoriteId`，成功后按钮状态恢复为「未收藏」

#### Scenario: 取消收藏失败
- **WHEN** 取消收藏 API 返回错误
- **THEN** 系统 SHALL 显示 Toast 错误提示，按钮状态保持「已收藏」

### Requirement: 收藏夹页面 MUST 支持取消收藏
`Favorites.vue` 的取消收藏按钮 SHALL 直接使用列表中的 `favorite.id` 调用删除 API。

#### Scenario: 从收藏夹删除
- **WHEN** 用户在收藏夹页面点击某条记录的取消收藏按钮
- **THEN** 系统 MUST 调用 `DELETE /favorites/:id`，成功后从列表中移除该记录
