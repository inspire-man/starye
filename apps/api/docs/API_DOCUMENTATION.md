# API 文档 - Aria2 集成、评分系统与收藏夹

> Starye API 新增端点文档

---

## 📖 目录

- [概述](#概述)
- [认证](#认证)
- [收藏夹 API](#收藏夹-api)
- [评分 API](#评分-api)
- [Aria2 配置 API](#aria2-配置-api)
- [Aria2 代理 API](#aria2-代理-api)
- [错误处理](#错误处理)

---

## 概述

### 基础信息

- **Base URL**: `https://your-domain.com/api`
- **数据格式**: JSON
- **认证方式**: Session Cookie
- **字符编码**: UTF-8

### 版本历史

| 版本 | 日期 | 说明 |
|------|------|------|
| v1.2 | 2026-03-30 | 新增 Aria2 集成和评分系统 |
| v1.1 | 2026-01-15 | 电影搜索优化 |
| v1.0 | 2025-12-01 | 初始版本 |

---

## 认证

大多数 API 需要用户登录。认证通过 Session Cookie 进行。

### 获取 Session

```http
GET /api/auth/get-session
```

**响应示例**:

```json
{
  "user": {
    "id": "user-123",
    "name": "张三",
    "email": "zhangsan@example.com"
  },
  "session": {
    "id": "session-456",
    "userId": "user-123",
    "expiresAt": "2026-04-30T00:00:00.000Z"
  }
}
```

---

## 收藏夹 API

### 概述

收藏夹功能允许用户收藏电影、女优、厂商和漫画等实体。所有收藏夹 API 均需要用户认证。

**支持的实体类型**：
- `movie` - 电影
- `actor` - 女优
- `publisher` - 厂商
- `comic` - 漫画

### 1. 获取收藏列表

获取当前用户的收藏列表，支持分页和类型筛选。

```http
GET /api/favorites?page=1&limit=24&entityType=movie
```

**查询参数**：

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| page | number | ❌ | 1 | 页码 |
| limit | number | ❌ | 20 | 每页数量（最大 100） |
| entityType | string | ❌ | - | 筛选实体类型 |

**响应 (200 OK)**：

```json
{
  "success": true,
  "data": {
    "data": [
      {
        "id": "fav_abc123",
        "userId": "user_xyz789",
        "entityType": "movie",
        "entityId": "movie_001",
        "createdAt": 1711872000000
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 24,
      "total": 42,
      "totalPages": 2
    }
  },
  "message": "成功返回收藏列表"
}
```

**需要认证**：✅

---

### 2. 添加收藏

将指定实体添加到收藏列表。如果已存在，返回现有收藏 ID（幂等操作）。

```http
POST /api/favorites
Content-Type: application/json
```

**请求体**：

```json
{
  "entityType": "movie",
  "entityId": "movie_abc123"
}
```

**参数说明**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| entityType | string | ✅ | 实体类型 (movie/actor/publisher/comic) |
| entityId | string | ✅ | 实体 ID |

**响应 (200 OK) - 新添加**：

```json
{
  "success": true,
  "data": {
    "id": "fav_new123",
    "alreadyExists": false
  },
  "message": "成功添加收藏"
}
```

**响应 (200 OK) - 已存在**：

```json
{
  "success": true,
  "data": {
    "id": "fav_existing456",
    "alreadyExists": true
  },
  "message": "成功添加收藏"
}
```

**需要认证**：✅

---

### 3. 删除收藏

从收藏列表中移除指定项。

```http
DELETE /api/favorites/:id
```

**路径参数**：

| 参数 | 类型 | 说明 |
|------|------|------|
| id | string | 收藏 ID |

**响应 (200 OK)**：

```json
{
  "success": true,
  "data": {
    "success": true
  },
  "message": "成功删除收藏"
}
```

**错误响应 (404)**：

```json
{
  "success": false,
  "error": "Favorite not found"
}
```

**需要认证**：✅

---

### 4. 检查收藏状态

检查指定实体是否已被当前用户收藏。

```http
GET /api/favorites/check/:entityType/:entityId
```

**路径参数**：

| 参数 | 类型 | 说明 |
|------|------|------|
| entityType | string | 实体类型 (movie/actor/publisher/comic) |
| entityId | string | 实体 ID |

**响应 (200 OK) - 已收藏**：

```json
{
  "success": true,
  "data": {
    "isFavorited": true
  },
  "message": "成功返回收藏状态"
}
```

**响应 (200 OK) - 未收藏**：

```json
{
  "success": true,
  "data": {
    "isFavorited": false
  },
  "message": "成功返回收藏状态"
}
```

**需要认证**：✅

---

### 收藏夹 cURL 示例

```bash
# 获取收藏列表
curl "https://api.example.com/api/favorites?page=1&limit=24&entityType=movie" \
  -H "Cookie: better-auth.session_token=YOUR_SESSION"

# 添加收藏
curl -X POST "https://api.example.com/api/favorites" \
  -H "Content-Type: application/json" \
  -H "Cookie: better-auth.session_token=YOUR_SESSION" \
  -d '{"entityType":"movie","entityId":"movie_abc123"}'

# 删除收藏
curl -X DELETE "https://api.example.com/api/favorites/fav_abc123" \
  -H "Cookie: better-auth.session_token=YOUR_SESSION"

# 检查收藏状态
curl "https://api.example.com/api/favorites/check/movie/movie_abc123" \
  -H "Cookie: better-auth.session_token=YOUR_SESSION"
```

---

## 评分 API

### 1. 提交/更新评分

提交或更新播放源评分。

```http
POST /api/ratings
Content-Type: application/json
```

**请求体**:

```json
{
  "playerId": "player-123",
  "score": 85
}
```

**参数说明**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| playerId | string | ✅ | 播放源 ID |
| score | number | ✅ | 评分（0-100） |

**响应 (201 Created)**:

```json
{
  "code": 0,
  "data": {
    "id": "rating-789",
    "userId": "user-123",
    "playerId": "player-123",
    "score": 85,
    "createdAt": "2026-03-30T10:00:00.000Z",
    "updatedAt": "2026-03-30T10:00:00.000Z"
  }
}
```

**错误响应**:

```json
{
  "code": 401,
  "message": "未登录，请先登录"
}
```

```json
{
  "code": 429,
  "message": "评分过于频繁，请稍后再试"
}
```

**频率限制**: 每分钟最多 10 次

---

### 2. 获取播放源评分

获取指定播放源的评分信息，包括当前用户的评分（如已登录）。

```http
GET /api/ratings/player/:playerId
```

**路径参数**:

| 参数 | 类型 | 说明 |
|------|------|------|
| playerId | string | 播放源 ID |

**响应 (200 OK)**:

```json
{
  "code": 0,
  "data": {
    "playerId": "player-123",
    "averageRating": 82.5,
    "ratingCount": 15,
    "userScore": 85
  }
}
```

**字段说明**:

| 字段 | 类型 | 说明 |
|------|------|------|
| playerId | string | 播放源 ID |
| averageRating | number | 平均评分（0-100） |
| ratingCount | number | 评分人数 |
| userScore | number \| null | 当前用户的评分（未登录或未评分时为 null） |

---

### 3. 获取用户评分历史

获取当前登录用户的所有评分记录。

```http
GET /api/ratings/my-ratings?page=1&limit=20
```

**查询参数**:

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| page | number | 1 | 页码 |
| limit | number | 20 | 每页数量 |

**响应 (200 OK)**:

```json
{
  "code": 0,
  "data": [
    {
      "id": "rating-789",
      "playerId": "player-123",
      "score": 85,
      "player": {
        "id": "player-123",
        "sourceName": "磁力链接 1080P",
        "quality": "1080P",
        "movie": {
          "code": "IPX-001",
          "title": "电影标题"
        }
      },
      "createdAt": "2026-03-30T10:00:00.000Z",
      "updatedAt": "2026-03-30T10:00:00.000Z"
    }
  ],
  "meta": {
    "total": 50,
    "page": 1,
    "limit": 20,
    "totalPages": 3
  }
}
```

**需要认证**: ✅

---

### 4. 获取评分统计

获取播放源的详细评分统计信息。

```http
GET /api/ratings/player/:playerId/stats
```

**响应 (200 OK)**:

```json
{
  "code": 0,
  "data": {
    "playerId": "player-123",
    "averageRating": 82.5,
    "ratingCount": 15,
    "distribution": {
      "star5": 6,
      "star4": 5,
      "star3": 3,
      "star2": 1,
      "star1": 0
    },
    "trend": [
      {
        "date": "2026-03-30",
        "averageRating": 83.0,
        "count": 5
      }
    ]
  }
}
```

**字段说明**:

| 字段 | 类型 | 说明 |
|------|------|------|
| distribution | object | 评分分布（每个星级的人数） |
| trend | array | 评分趋势（按日期统计） |

---

### 5. 获取 Top 评分列表

获取用户给出最高分的播放源列表。

```http
GET /api/ratings/top-ratings?limit=10
```

**查询参数**:

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| limit | number | 10 | 返回数量 |

**响应 (200 OK)**:

```json
{
  "code": 0,
  "data": [
    {
      "id": "rating-123",
      "score": 95,
      "player": {
        "id": "player-456",
        "sourceName": "蓝光原盘",
        "quality": "1080P",
        "movie": {
          "code": "IPX-001",
          "title": "电影标题",
          "coverImage": "https://..."
        }
      },
      "createdAt": "2026-03-30T10:00:00.000Z"
    }
  ]
}
```

**需要认证**: ✅

---

## Aria2 配置 API

### 1. 获取用户配置

获取当前用户的 Aria2 配置。

```http
GET /api/aria2/config
```

**响应 (200 OK)**:

```json
{
  "code": 0,
  "data": {
    "id": "config-123",
    "userId": "user-123",
    "rpcUrl": "http://localhost:6800/jsonrpc",
    "secret": "***",
    "useProxy": true,
    "createdAt": "2026-03-30T10:00:00.000Z",
    "updatedAt": "2026-03-30T10:00:00.000Z"
  }
}
```

**字段说明**:

| 字段 | 类型 | 说明 |
|------|------|------|
| rpcUrl | string | Aria2 RPC 地址 |
| secret | string | RPC 密钥（已脱敏） |
| useProxy | boolean | 是否使用后端代理 |

**需要认证**: ✅

**注**: 如果用户未配置，返回 `data: null`

---

### 2. 保存/更新配置

保存或更新用户的 Aria2 配置。

```http
PUT /api/aria2/config
Content-Type: application/json
```

**请求体**:

```json
{
  "rpcUrl": "http://localhost:6800/jsonrpc",
  "secret": "my-secret-token",
  "useProxy": true
}
```

**参数说明**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| rpcUrl | string | ✅ | Aria2 RPC 地址 |
| secret | string | ❌ | RPC 密钥（可选） |
| useProxy | boolean | ❌ | 是否使用代理（默认 true） |

**响应 (200 OK)**:

```json
{
  "code": 0,
  "data": {
    "id": "config-123",
    "userId": "user-123",
    "rpcUrl": "http://localhost:6800/jsonrpc",
    "secret": "***",
    "useProxy": true,
    "updatedAt": "2026-03-30T10:00:00.000Z"
  }
}
```

**需要认证**: ✅

**安全说明**: 密钥会在服务端加密存储，响应中会脱敏显示。

---

## Aria2 代理 API

### 1. 代理 RPC 请求

代理用户的 Aria2 RPC 请求，避免 CORS 问题并提供密钥管理。

```http
POST /api/aria2/rpc
Content-Type: application/json
```

**请求体**（JSON-RPC 2.0 格式）:

```json
{
  "jsonrpc": "2.0",
  "method": "aria2.getVersion",
  "id": "1"
}
```

**常用方法**:

| 方法 | 说明 | 参数 |
|------|------|------|
| aria2.getVersion | 获取版本 | 无 |
| aria2.addUri | 添加任务 | [uris, options] |
| aria2.tellStatus | 查询状态 | [gid] |
| aria2.pause | 暂停任务 | [gid] |
| aria2.unpause | 恢复任务 | [gid] |
| aria2.remove | 删除任务 | [gid] |
| aria2.tellActive | 活跃任务 | 无 |

**响应 (200 OK)**:

```json
{
  "code": 0,
  "data": {
    "jsonrpc": "2.0",
    "id": "1",
    "result": {
      "version": "1.37.0",
      "enabledFeatures": ["BitTorrent", "HTTPS", "..."]
    }
  }
}
```

**需要认证**: ✅

**前置条件**: 用户必须已配置 Aria2

---

### 2. 添加下载任务示例

```http
POST /api/aria2/rpc
Content-Type: application/json
```

**请求体**:

```json
{
  "jsonrpc": "2.0",
  "method": "aria2.addUri",
  "params": [
    ["magnet:?xt=urn:btih:1234567890abcdef"],
    {
      "dir": "/downloads",
      "out": "movie.mp4"
    }
  ],
  "id": "2"
}
```

**响应**:

```json
{
  "code": 0,
  "data": {
    "jsonrpc": "2.0",
    "id": "2",
    "result": "2089b05ecca3d829"
  }
}
```

**字段说明**:
- `result`: 返回的 GID（任务唯一标识符）

---

### 3. 查询任务状态示例

```http
POST /api/aria2/rpc
Content-Type: application/json
```

**请求体**:

```json
{
  "jsonrpc": "2.0",
  "method": "aria2.tellStatus",
  "params": ["2089b05ecca3d829"],
  "id": "3"
}
```

**响应**:

```json
{
  "code": 0,
  "data": {
    "jsonrpc": "2.0",
    "id": "3",
    "result": {
      "gid": "2089b05ecca3d829",
      "status": "active",
      "totalLength": "1073741824",
      "completedLength": "536870912",
      "downloadSpeed": "1048576",
      "files": [
        {
          "path": "/downloads/movie.mp4",
          "length": "1073741824",
          "completedLength": "536870912"
        }
      ]
    }
  }
}
```

**状态说明**:
- `active`: 下载中
- `waiting`: 等待中
- `paused`: 已暂停
- `error`: 错误
- `complete`: 已完成
- `removed`: 已删除

---

## 错误处理

### 标准错误响应

所有 API 错误响应遵循统一格式：

```json
{
  "code": 400,
  "message": "错误描述",
  "details": {
    "field": "具体错误字段",
    "reason": "详细原因"
  }
}
```

### 常见错误码

| HTTP 状态 | code | 说明 |
|-----------|------|------|
| 400 | 400 | 请求参数错误 |
| 401 | 401 | 未登录或认证失败 |
| 403 | 403 | 无权限访问 |
| 404 | 404 | 资源不存在 |
| 429 | 429 | 请求频率超限 |
| 500 | 500 | 服务器内部错误 |
| 503 | 503 | 服务不可用 |

### 评分 API 特定错误

```json
{
  "code": 429,
  "message": "评分过于频繁，请稍后再试",
  "details": {
    "retryAfter": 30
  }
}
```

### Aria2 API 特定错误

```json
{
  "code": 502,
  "message": "Aria2 RPC 连接失败",
  "details": {
    "error": "ECONNREFUSED",
    "rpcUrl": "http://localhost:6800/jsonrpc"
  }
}
```

---

## 速率限制

| 端点 | 限制 | 说明 |
|------|------|------|
| POST /api/ratings | 10/分钟 | 评分提交 |
| POST /api/aria2/rpc | 30/分钟 | RPC 请求 |
| GET /api/ratings/* | 60/分钟 | 评分查询 |
| 其他 GET | 120/分钟 | 通用查询 |

**响应头**:
- `X-RateLimit-Limit`: 速率限制
- `X-RateLimit-Remaining`: 剩余次数
- `X-RateLimit-Reset`: 重置时间（Unix 时间戳）

---

## 测试环境

### 测试账号

```
Email: test@example.com
Password: test123456
```

### 测试数据

- 电影代码: `TEST-001`
- 播放源 ID: `player-test-1`

### cURL 示例

```bash
# 提交评分
curl -X POST https://api.example.com/api/ratings \
  -H "Content-Type: application/json" \
  -H "Cookie: session=YOUR_SESSION" \
  -d '{"playerId":"player-test-1","score":85}'

# 查询评分
curl https://api.example.com/api/ratings/player/player-test-1 \
  -H "Cookie: session=YOUR_SESSION"

# 代理 Aria2 请求
curl -X POST https://api.example.com/api/aria2/rpc \
  -H "Content-Type: application/json" \
  -H "Cookie: session=YOUR_SESSION" \
  -d '{"jsonrpc":"2.0","method":"aria2.getVersion","id":"1"}'
```

---

## SDK 和客户端库

官方客户端库：

- **JavaScript/TypeScript**: `@starye/api-client` (规划中)
- **Python**: `starye-api` (规划中)

社区贡献：
- 欢迎提交您的客户端库！

---

## 变更日志

### v1.3.0 (2026-03-31)

**新增**:
- ✅ 收藏夹 API（4 个端点）
- ✅ 完整的 OpenAPI 文档与示例
- ✅ 实体类型支持（movie/actor/publisher/comic）

**优化**:
- 增强 API 文档说明
- 添加更多请求/响应示例

### v1.2.0 (2026-03-30)

**新增**:
- ✅ 评分 API（5 个端点）
- ✅ Aria2 配置 API（2 个端点）
- ✅ Aria2 代理 API（1 个端点）

**优化**:
- 改进错误响应格式
- 添加速率限制头

### v1.1.0 (2026-01-15)

**新增**:
- 电影搜索优化
- 分页查询支持

---

## 联系与支持

- 📧 Email: api@starye.com
- 🐙 GitHub: https://github.com/starye/starye
- 📖 Wiki: https://wiki.starye.com

---

**最后更新**: 2026-03-31
**文档版本**: v1.3.0
