# Spec：观看历史 API（增强版）

## 目标

`GET /api/public/progress/watching` 在无参数时返回含影片详情的历史列表，MUST 替代仅返回原始字段的旧行为。

## 接口规格

### GET /public/progress/watching

#### 参数

| 参数 | 类型 | 必填 | 默认 | 说明 |
|---|---|---|---|---|
| `movieCode` | string | 否 | — | 传入时查询单条进度（原有行为不变） |
| `limit` | number | 否 | 20 | 无 movieCode 时生效，最大 50，MUST 限制上限 |

#### 响应（无 movieCode 时）

```typescript
{
  success: true,
  data: Array<{
    id: string
    movieCode: string
    title: string          // 从 movies 表 JOIN 获取，MUST 包含
    coverImage: string | null
    isR18: boolean
    progress: number       // 已观看秒数
    duration: number | null
    updatedAt: string      // ISO 8601
  }>
}
```

#### 响应（有 movieCode 时）

行为与现有保持一致，返回单条 `WatchingProgress` 或 null，**MUST 不受本次变更影响**。

## 场景

### 场景 1：未登录用户请求历史

- 请求：`GET /public/progress/watching`（无 Authorization / Cookie）
- 期望：`401 { success: false, error: '需要登录' }`，MUST 返回 401

### 场景 2：登录用户获取历史列表

- 前提：用户有 3 条观看记录，对应 movies 均存在
- 请求：`GET /public/progress/watching`
- 期望：返回 3 条记录，每条 MUST 包含 `title`、`coverImage`、`isR18`
- 期望：按 `updatedAt DESC` 排序，MUST 最新记录在前

### 场景 3：limit 参数限制

- 请求：`GET /public/progress/watching?limit=5`（用户有 10 条记录）
- 期望：仅返回 5 条，MUST 不超过请求的 limit

### 场景 4：limit 超过上限

- 请求：`GET /public/progress/watching?limit=100`
- 期望：实际返回 MUST 不超过 50 条

### 场景 5：影片已被删除的进度记录

- 前提：某条 watchingProgress 对应的 movie 已从数据库删除
- 期望：该进度记录 MUST 不出现在返回列表中（INNER JOIN 自然过滤）

### 场景 6：传入 movieCode 时行为不变

- 请求：`GET /public/progress/watching?movieCode=ABC-001`
- 期望：返回单条原始 `WatchingProgress` 对象（不含 title 等额外字段），MUST 保持向后兼容
