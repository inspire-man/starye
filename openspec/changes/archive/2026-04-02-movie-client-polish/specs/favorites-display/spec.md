## ADDED Requirements

### Requirement: Favorites API MUST 返回关联实体信息
`GET /favorites` 接口 SHALL 在每条收藏记录中附加 `entity` 字段，包含实体名称、封面和 slug。

#### Scenario: 收藏列表包含影片类型
- **WHEN** 用户请求收藏列表，其中包含 `entityType: "movie"` 的记录
- **THEN** 每条影片收藏记录 MUST 包含 `entity: { name: string, cover: string | null, slug: string }`，数据来源于 `movies` 表

#### Scenario: 收藏列表包含演员类型
- **WHEN** 用户请求收藏列表，其中包含 `entityType: "actor"` 的记录
- **THEN** 每条演员收藏记录 MUST 包含 `entity: { name: string, cover: string | null, slug: string }`，数据来源于 `actors` 表

#### Scenario: 关联实体已被删除
- **WHEN** 收藏的实体在源表中已不存在
- **THEN** `entity` 字段 SHALL 为 `null`，收藏记录仍正常返回

### Requirement: 收藏夹页面 MUST 展示实体卡片
客户端 `Favorites.vue` SHALL 使用 `entity` 字段渲染实体名称和封面，而非显示原始 `entityId`。

#### Scenario: 影片收藏展示封面和标题
- **WHEN** 收藏列表中有影片类型的收藏
- **THEN** 页面 MUST 显示影片封面图和标题，点击可跳转到影片详情页

#### Scenario: 实体信息缺失时展示占位符
- **WHEN** 收藏记录的 `entity` 为 `null`
- **THEN** 页面 SHALL 显示「内容已删除」占位提示
