# Spec：观看计数与热门算法

## 目标

通过真实观看计数优化热门影片排序，使热门区块反映用户实际行为。

## DB 规格

### movies 表新增字段

| 字段 | 类型 | 默认值 | 约束 |
|---|---|---|---|
| `viewCount` | INTEGER | 0 | NOT NULL |

- MUST 所有现有影片行初始 viewCount 为 0
- MUST 通过 Drizzle migration 文件完成，不手动修改 D1

---

## 观看埋点接口

### POST /public/movies/:code/view

无需认证，匿名可调用。

#### 参数

| 参数 | 来源 | 说明 |
|---|---|---|
| `code` | URL path | 影片番号 |

#### 行为规格

- MUST 将对应 `code` 影片的 `viewCount` 自增 1（原子操作）
- 若 `code` 不存在，MUST 静默成功（不返回 404），影响行数为 0 即可
- MUST 返回 `200 { success: true }`

#### 场景

##### 场景 1：正常上报

- 请求：`POST /public/movies/SSIS-001/view`（影片存在）
- 期望：`viewCount` 加 1，返回 `{ success: true }`，MUST 原子操作

##### 场景 2：影片不存在时上报

- 请求：`POST /public/movies/INVALID-999/view`
- 期望：返回 `200 { success: true }`，MUST 不返回 404

##### 场景 3：并发上报

- 场景：同一影片同时收到 10 个 `POST /view` 请求
- 期望：`viewCount` 最终应增加 10（不少于），MUST 使用原子 SQL 表达式防止竞争

---

## 热门排序规格

### getHotMovies 排序优先级

MUST 按以下优先级排序：

1. `sortOrder DESC`（人工权重，越大越靠前）
2. `viewCount DESC`（观看次数，越多越靠前）
3. `createdAt DESC`（创建时间，越新越靠前）

#### 场景

##### 场景 1：sortOrder 优先于 viewCount

- 数据：影片 A（sortOrder=10, viewCount=1000）；影片 B（sortOrder=20, viewCount=0）
- 期望：影片 B MUST 排在影片 A 前面

##### 场景 2：相同 sortOrder 时按 viewCount 排序

- 数据：影片 A（sortOrder=0, viewCount=100）；影片 B（sortOrder=0, viewCount=50）
- 期望：影片 A MUST 排在影片 B 前面

##### 场景 3：相同 sortOrder 和 viewCount 时按 createdAt 排序

- 数据：影片 A（sortOrder=0, viewCount=0, createdAt=2026-01-01）；影片 B（sortOrder=0, viewCount=0, createdAt=2026-03-01）
- 期望：影片 B（更新）MUST 排在影片 A 前面

---

## 前端埋点规格

### movie-app 播放页上报

- MUST 在播放页组件挂载时（`onMounted`）调用 `POST /movies/:code/view`
- MUST 使用 fire-and-forget 方式，不 await，不阻塞渲染
- MUST 在上报失败时静默忽略（catch 空处理），不向用户展示任何错误
- 每次进入播放页 MUST 上报一次（刷新页面再次上报可接受）
