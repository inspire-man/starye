# Spec：Genre 浏览系统

## 目标

新增 Genre 列表 API 和首页 Genre 标签栏，让用户可以通过可视化标签快速过滤影片类型。

## Genre 列表 API

### GET /public/genres

不需要登录。聚合所有可见影片的 genre 列表。

#### 参数

无必填参数。系统根据请求用户的 R18 认证状态决定是否包含 R18 影片的 genres。

#### 响应

```typescript
{
  success: true,
  data: Array<{
    genre: string   // genre 名称，非空
    count: number   // 该 genre 下影片数量
  }>
}
```

#### 约束

- MUST 按 `count DESC` 排序
- MUST 过滤空字符串 genre
- MUST 最多返回 100 条（Cloudflare CPU 限制保护）
- 未 R18 认证用户：MUST 仅统计 `isR18 = false` 的影片 genre

## 场景

### 场景 1：获取 Genre 列表（未登录）

- 请求：`GET /public/genres`
- 期望：返回所有非 R18 影片的 genre 聚合，MUST 不含 R18 影片专属 genre

### 场景 2：获取 Genre 列表（R18 认证用户）

- 期望：返回包含 R18 影片在内的全量 genre 聚合，count MUST 包含 R18 影片计数

### 场景 3：Genre 数量上限

- 前提：数据库中有超过 100 个不同 genre
- 期望：返回 MUST 不超过 100 条，按 count DESC 取前 100

### 场景 4：空 genres 字段的影片

- 前提：部分影片 `genres = null` 或 `genres = '[]'`
- 期望：这些影片 MUST 不产生任何 genre 条目

---

## 前端 Genre 标签栏 Spec

### 功能描述

首页 `Home.vue` 在筛选栏下方展示 Genre 标签列表。

### 交互规格

- MUST 在页面首次加载时请求 `/public/genres`，并缓存在组件内（不重复请求）
- MUST 展示"全部"作为第一个标签，点击时清空 `activeGenre` 过滤
- MUST 支持点击 Genre 标签激活对应过滤，激活态 MUST 视觉高亮
- MUST 再次点击已激活的 Genre 标签，取消过滤（等同点击"全部"）
- MUST 将当前选中 Genre 同步到 URL query `?genre=`
- MUST 在 URL 含有 `?genre=` 参数时，页面初始化即激活对应标签

### 场景

#### 场景 1：首页加载时 genre 标签渲染

- 期望：Genre 标签按 count 降序展示，MUST 至少展示"全部"标签

#### 场景 2：点击 Genre 标签过滤

- 操作：点击"剧情"标签
- 期望：`activeGenre` 设为 `'剧情'`，MUST 触发影片列表重新请求（带 `genre=剧情`）

#### 场景 3：取消 Genre 过滤

- 操作：点击已激活的"剧情"标签或点击"全部"标签
- 期望：`activeGenre` 清空，MUST 触发影片列表重新请求（不带 genre 参数）

#### 场景 4：URL 初始化 genre 过滤

- 前提：用户访问 `/?genre=动作`
- 期望：页面初始化时 MUST 激活"动作"标签，影片列表 MUST 以 genre=动作 参数请求

---

## 前端观看历史页 Spec

### 路由

- 路径：`/history`
- 认证：`meta.requiresAuth: true`，未登录 MUST 跳转登录页

### 功能规格

- MUST 展示用户所有观看记录，按 `updatedAt DESC` 排序
- MUST 每条记录展示：封面图、影片标题、已观看进度百分比进度条、最后观看时间
- MUST 每条记录提供"继续观看"跳转，路径为 `/movie/:movieCode/play`
- MUST 支持分页展示（每页 10 条，前端分页）
- MUST 展示空状态提示（无记录时）

### 场景

#### 场景 1：有观看记录时

- 期望：按时间倒序展示记录列表，每条 MUST 含封面、标题、进度条

#### 场景 2：无观看记录时

- 期望：MUST 显示"暂无观看历史"空状态提示

#### 场景 3："继续观看"跳转

- 操作：点击任意记录的"继续观看"按钮
- 期望：MUST 跳转到 `/movie/:movieCode/play`

---

## 首页"继续观看"板块 Spec

- MUST 仅对已登录用户展示
- MUST 展示最近 5 部 `progress/duration < 0.9` 的影片（未看完）
- MUST 在 `progress` 或 `duration` 为 null/0 时跳过该条（不展示）
- MUST 点击跳转 `/movie/:movieCode/play`
- 未登录用户 MUST 静默隐藏该板块，不报错、不请求接口
