# Capability: movie-recommendation

## Purpose
TBD: Generated during movie-discovery-enhancement change.

## Requirements

### Requirement: 个性化推荐接口
系统 MUST 提供 `GET /public/movies/recommended` 接口，基于已登录用户的近期观看历史计算个性化推荐，未登录时降级为热门影片。

- 接口 MUST 无需强制登录（公开可访问），但行为根据认证状态不同
- 已登录且有历史：MUST 基于近 30 条观看历史提取 top3 genres + top5 actors 偏好，查询匹配影片
- 已登录但无历史：MUST 降级返回按 `viewCount DESC` 排序的热门影片（最多 12 部）
- 未登录：MUST 降级返回热门影片（最多 12 部）
- MUST 排除用户已经观看过（在历史记录中）的影片
- 返回结果 MUST 不超过 12 部，不分页
- R18 过滤 MUST 与列表接口保持一致（未 R18 认证用户不返回 R18 影片）

#### 响应格式

```typescript
{
  success: true,
  data: Movie[],          // 最多 12 部
  meta: {
    strategy: 'personalized' | 'hot'  // 实际使用的推荐策略
  }
}
```

#### Scenario: 已登录用户有观看历史
- **WHEN** 已登录用户请求 `GET /public/movies/recommended`，且有 >= 5 条观看记录
- **THEN** MUST 返回基于 genre/actor 偏好匹配的影片，`meta.strategy = 'personalized'`，已观看影片 MUST 不出现

#### Scenario: 已登录但无历史（冷启动）
- **WHEN** 已登录用户请求 `GET /public/movies/recommended`，观看记录为空
- **THEN** MUST 返回热门影片（viewCount DESC），`meta.strategy = 'hot'`

#### Scenario: 未登录用户
- **WHEN** 未登录用户请求 `GET /public/movies/recommended`
- **THEN** MUST 返回热门影片（viewCount DESC），`meta.strategy = 'hot'`

#### Scenario: 推荐结果不足 12 部时用热门补充
- **WHEN** 个性化查询结果不足 12 部
- **THEN** MUST 以热门影片（viewCount DESC，排除已有结果和已看记录）补充至 12 部

#### Scenario: R18 过滤
- **WHEN** 未 R18 认证用户请求推荐
- **THEN** 推荐结果 MUST 不包含任何 isR18=true 的影片

---

### Requirement: 首页"猜你喜欢"推荐区块
首页 `Home.vue` MUST 为已登录用户展示"猜你喜欢"区块，展示个性化推荐影片。

- MUST 仅对已登录用户展示，未登录用户 MUST 静默隐藏该区块
- MUST 在页面加载时调用 `GET /public/movies/recommended`，与影片列表并行请求
- MUST 展示最多 12 部推荐影片（横向可滚动卡片列表）
- 推荐接口请求失败时 MUST 静默隐藏区块（不展示错误状态）
- 区块标题 MUST 为"猜你喜欢"，点击跳转对应影片详情页
- 推荐影片加载中 MUST 展示 skeleton 占位

#### Scenario: 已登录用户看到推荐区块
- **WHEN** 已登录用户加载首页
- **THEN** "猜你喜欢"区块 MUST 在"继续观看"区块下方展示，包含最多 12 部推荐影片

#### Scenario: 未登录用户不展示推荐区块
- **WHEN** 未登录用户加载首页
- **THEN** "猜你喜欢"区块 MUST 不渲染，不发起推荐请求

#### Scenario: 推荐接口失败时静默处理
- **WHEN** `GET /public/movies/recommended` 返回错误
- **THEN** 首页 MUST 不展示"猜你喜欢"区块，不显示错误提示，其他区块正常显示

#### Scenario: 推荐区块加载中
- **WHEN** 推荐接口请求进行中
- **THEN** MUST 显示 skeleton 卡片占位（与"继续观看"区块样式一致）
