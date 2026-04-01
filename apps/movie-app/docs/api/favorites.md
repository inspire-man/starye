# 收藏夹 API 文档

用户收藏功能的完整 API 接口文档，支持电影、女优、厂商、漫画等多种实体类型。

## 基础信息

**Base URL**: `/api/favorites`  
**认证方式**: Bearer Token (Session-based)  
**内容类型**: `application/json`

## 数据模型

### Favorite 对象

```typescript
interface Favorite {
  id: string                                      // 收藏 ID
  userId: string                                  // 用户 ID
  entityType: 'movie' | 'actor' | 'publisher' | 'comic'  // 实体类型
  entityId: string                                // 实体 ID
  createdAt: number                               // 创建时间（Unix 时间戳）
}
```

### 支持的实体类型

| 类型 | 说明 | 示例 |
|------|------|------|
| `movie` | 电影 | 影片详情页收藏 |
| `actor` | 女优 | 女优详情页收藏 |
| `publisher` | 厂商 | 厂商详情页收藏 |
| `comic` | 漫画 | 漫画详情页收藏 |

## API 端点

### 1. 获取收藏列表

获取当前用户的收藏列表，支持分页和类型筛选。

**端点**: `GET /api/favorites`

**请求参数**（Query）

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `page` | `number` | 否 | `1` | 页码 |
| `limit` | `number` | 否 | `24` | 每页数量 |
| `entityType` | `'movie' \| 'actor' \| 'publisher' \| 'comic'` | 否 | - | 筛选实体类型 |

**响应示例**

```json
{
  "success": true,
  "data": [
    {
      "id": "fav_abc123",
      "userId": "user_xyz789",
      "entityType": "movie",
      "entityId": "movie_001",
      "createdAt": 1711872000000
    },
    {
      "id": "fav_def456",
      "userId": "user_xyz789",
      "entityType": "actor",
      "entityId": "actor_001",
      "createdAt": 1711858400000
    }
  ],
  "meta": {
    "total": 42,
    "page": 1,
    "limit": 24,
    "totalPages": 2
  }
}
```

**错误响应**

```json
{
  "success": false,
  "error": "Authentication required"
}
```

**状态码**

- `200`: 成功
- `401`: 未认证
- `500`: 服务器错误

### 2. 添加收藏

将指定实体添加到用户的收藏列表。

**端点**: `POST /api/favorites`

**请求体**

```json
{
  "entityType": "movie",
  "entityId": "movie_001"
}
```

**请求参数**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `entityType` | `'movie' \| 'actor' \| 'publisher' \| 'comic'` | ✅ | 实体类型 |
| `entityId` | `string` | ✅ | 实体 ID |

**响应示例（成功添加）**

```json
{
  "success": true,
  "data": {
    "id": "fav_new123",
    "alreadyExists": false
  }
}
```

**响应示例（已存在）**

```json
{
  "success": true,
  "data": {
    "id": "fav_existing",
    "alreadyExists": true
  }
}
```

**错误响应**

```json
{
  "success": false,
  "error": "Invalid entity type"
}
```

**状态码**

- `200`: 成功（包括已存在的情况）
- `400`: 参数错误
- `401`: 未认证
- `500`: 服务器错误

### 3. 删除收藏

从用户的收藏列表中移除指定项。

**端点**: `DELETE /api/favorites/:id`

**路径参数**

| 参数 | 类型 | 说明 |
|------|------|------|
| `id` | `string` | 收藏 ID |

**响应示例**

```json
{
  "success": true,
  "data": {
    "success": true
  }
}
```

**错误响应**

```json
{
  "success": false,
  "error": "Favorite not found"
}
```

**状态码**

- `200`: 成功
- `401`: 未认证
- `404`: 收藏不存在
- `500`: 服务器错误

### 4. 检查收藏状态

检查指定实体是否已被当前用户收藏。

**端点**: `GET /api/favorites/check/:entityType/:entityId`

**路径参数**

| 参数 | 类型 | 说明 |
|------|------|------|
| `entityType` | `'movie' \| 'actor' \| 'publisher' \| 'comic'` | 实体类型 |
| `entityId` | `string` | 实体 ID |

**响应示例**

```json
{
  "success": true,
  "data": {
    "isFavorited": true
  }
}
```

**状态码**

- `200`: 成功
- `401`: 未认证
- `500`: 服务器错误

## 前端集成

### 使用 useFavorites Composable（推荐）

```vue
<script setup lang="ts">
import { useFavorites } from '@/composables/useFavorites'

const {
  favorites,        // 收藏列表
  loading,          // 加载状态
  error,            // 错误信息
  addFavorite,      // 添加收藏
  removeFavorite,   // 删除收藏
  checkIsFavorited, // 检查状态
  fetchFavorites,   // 获取列表
} = useFavorites()

// 添加收藏
async function handleAddFavorite() {
  const result = await addFavorite('movie', 'movie_001')
  if (result.success) {
    console.log('收藏成功')
  }
}

// 检查收藏状态
const isFavorited = await checkIsFavorited('movie', 'movie_001')
</script>
```

### 直接使用 API 客户端

```typescript
import { favoritesApi } from '@/api'

// 获取收藏列表
const response = await favoritesApi.getFavorites({
  page: 1,
  limit: 24,
  entityType: 'movie',
})

// 添加收藏
const result = await favoritesApi.addFavorite('movie', 'movie_001')

// 删除收藏
await favoritesApi.deleteFavorite('fav_abc123')

// 检查状态
const isFavorited = await favoritesApi.checkFavorite('movie', 'movie_001')
```

## 完整示例：电影详情页收藏

```vue
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useFavorites } from '@/composables/useFavorites'

const props = defineProps<{ movieId: string }>()

const { addFavorite, removeFavorite, checkIsFavorited } = useFavorites()
const isFavorited = ref(false)
const favoritingLoading = ref(false)
const favoriteId = ref<string | null>(null)

// 检查收藏状态
async function checkFavoriteStatus() {
  try {
    isFavorited.value = await checkIsFavorited('movie', props.movieId)
  } catch (e) {
    console.error('检查收藏状态失败:', e)
  }
}

// 切换收藏状态
async function toggleFavorite() {
  if (favoritingLoading.value) return
  
  favoritingLoading.value = true
  try {
    if (isFavorited.value && favoriteId.value) {
      // 取消收藏
      await removeFavorite(favoriteId.value)
      isFavorited.value = false
      favoriteId.value = null
      showToast('已取消收藏')
    } else {
      // 添加收藏
      const result = await addFavorite('movie', props.movieId)
      if (result.success) {
        isFavorited.value = true
        favoriteId.value = result.data.id
        showToast(result.data.alreadyExists ? '已在收藏夹中' : '已添加到收藏夹')
      }
    }
  } catch (e) {
    console.error('收藏操作失败:', e)
    showToast('操作失败', 'error')
  } finally {
    favoritingLoading.value = false
  }
}

onMounted(checkFavoriteStatus)
</script>

<template>
  <button
    :disabled="favoritingLoading"
    :class="isFavorited ? 'bg-yellow-600' : 'bg-gray-700'"
    @click="toggleFavorite"
  >
    <span v-if="favoritingLoading">⟳</span>
    <span v-else>{{ isFavorited ? '⭐ 已收藏' : '☆ 收藏' }}</span>
  </button>
</template>
```

## 数据库 Schema

收藏数据存储在 `userFavorites` 表：

```typescript
// packages/db/src/schema.ts
export const userFavorites = sqliteTable('user_favorites', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  entityType: text('entity_type', { enum: ['movie', 'actor', 'publisher', 'comic'] }).notNull(),
  entityId: text('entity_id').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
}, (table) => ({
  // 唯一索引：防止重复收藏
  uniqueFavorite: uniqueIndex('unique_favorite').on(table.userId, table.entityType, table.entityId),
}))
```

## 错误码

| 错误码 | 说明 | 处理建议 |
|--------|------|----------|
| `Authentication required` | 未登录 | 跳转到登录页 |
| `Invalid entity type` | 实体类型无效 | 检查参数 |
| `Favorite not found` | 收藏不存在 | 刷新列表 |
| `Failed to add favorite` | 添加失败 | 提示用户重试 |
| `Failed to delete favorite` | 删除失败 | 提示用户重试 |

## 性能优化建议

### 1. 批量检查收藏状态

```typescript
// 不推荐：多次单独请求
for (const movie of movies) {
  const isFavorited = await checkFavorite('movie', movie.id)
}

// 推荐：在列表接口返回时包含收藏状态
const response = await movieApi.getMovies({ includeFavoriteStatus: true })
```

### 2. 缓存收藏列表

```typescript
// 使用 useFavorites 的 autoLoad 特性
const { favorites } = useFavorites({ autoLoad: true })

// 收藏列表会自动缓存，避免重复请求
```

### 3. 乐观更新

```typescript
async function toggleFavorite() {
  // 立即更新 UI
  isFavorited.value = !isFavorited.value
  
  try {
    // 后台请求
    await addFavorite('movie', movieId)
  } catch (e) {
    // 失败时回滚
    isFavorited.value = !isFavorited.value
    showToast('操作失败', 'error')
  }
}
```

## 安全性

1. **认证检查**：所有端点都需要用户认证
2. **用户隔离**：只能访问自己的收藏
3. **防重复**：数据库唯一索引防止重复收藏
4. **级联删除**：用户删除时自动清理收藏

## 限制

- **最大收藏数**：无限制（建议前端提示超过 1000 条）
- **请求频率**：建议添加防抖，避免频繁点击
- **分页大小**：最大 100 条/页

## 测试数据

### Mock 数据示例

```typescript
// 用于前端测试的 mock 数据
const mockFavorites: Favorite[] = [
  {
    id: 'fav_1',
    userId: 'user_1',
    entityType: 'movie',
    entityId: 'movie_001',
    createdAt: Date.now(),
  },
  {
    id: 'fav_2',
    userId: 'user_1',
    entityType: 'actor',
    entityId: 'actor_001',
    createdAt: Date.now() - 86400000,
  },
]
```

## 使用场景

### 场景 1：电影详情页收藏按钮

```vue
<template>
  <button @click="toggleFavorite">
    {{ isFavorited ? '⭐ 已收藏' : '☆ 收藏' }}
  </button>
</template>
```

### 场景 2：收藏夹页面

```vue
<template>
  <div>
    <!-- 类型筛选 -->
    <Select v-model="filterType" :options="typeOptions" />
    
    <!-- 收藏列表 -->
    <div v-for="fav in favorites" :key="fav.id">
      <FavoriteCard :favorite="fav" @delete="handleDelete" />
    </div>
  </div>
</template>
```

### 场景 3：批量操作

```typescript
// 批量添加收藏
async function addMultipleFavorites(movieIds: string[]) {
  const results = await Promise.allSettled(
    movieIds.map(id => favoritesApi.addFavorite('movie', id))
  )
  
  const successCount = results.filter(r => r.status === 'fulfilled').length
  showToast(`成功收藏 ${successCount} 部影片`)
}

// 批量删除收藏
async function removeMultipleFavorites(favoriteIds: string[]) {
  await Promise.all(
    favoriteIds.map(id => favoritesApi.deleteFavorite(id))
  )
  showToast('批量删除成功')
}
```

## 错误处理

```typescript
try {
  await favoritesApi.addFavorite('movie', movieId)
} catch (error) {
  if (error.response?.status === 401) {
    // 未登录，跳转到登录页
    router.push('/login')
  } else if (error.response?.status === 500) {
    // 服务器错误
    showToast('服务器错误，请稍后重试', 'error')
  } else {
    // 其他错误
    showToast('操作失败', 'error')
  }
}
```

## 最佳实践

### 1. 使用 Composable 管理状态

```typescript
// ✅ 推荐
const { favorites, addFavorite, removeFavorite } = useFavorites()

// ❌ 不推荐：直接调用 API
import { favoritesApi } from '@/api'
```

### 2. 防抖收藏操作

```typescript
import { useDebounceFn } from '@vueuse/core'

const toggleFavorite = useDebounceFn(async () => {
  // 收藏操作
}, 500)
```

### 3. 本地状态同步

```typescript
// 添加收藏后更新本地状态
const result = await addFavorite('movie', movieId)
if (result.success) {
  // 立即更新列表，无需重新请求
  favorites.value.unshift({
    id: result.data.id,
    entityType: 'movie',
    entityId: movieId,
    createdAt: Date.now(),
  })
}
```

### 4. 错误重试

```typescript
async function addFavoriteWithRetry(type: string, id: string, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await addFavorite(type, id)
    } catch (e) {
      if (i === maxRetries - 1) throw e
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)))
    }
  }
}
```

## API 调用示例

### cURL 示例

```bash
# 获取收藏列表
curl -X GET "http://localhost:3000/api/favorites?page=1&limit=24&entityType=movie" \
  -H "Authorization: Bearer YOUR_TOKEN"

# 添加收藏
curl -X POST "http://localhost:3000/api/favorites" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"entityType":"movie","entityId":"movie_001"}'

# 删除收藏
curl -X DELETE "http://localhost:3000/api/favorites/fav_abc123" \
  -H "Authorization: Bearer YOUR_TOKEN"

# 检查收藏状态
curl -X GET "http://localhost:3000/api/favorites/check/movie/movie_001" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Axios 示例

```typescript
import axios from 'axios'

const api = axios.create({
  baseURL: 'http://localhost:3000',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
})

// 获取收藏列表
const { data } = await api.get('/api/favorites', {
  params: { page: 1, limit: 24, entityType: 'movie' }
})

// 添加收藏
const { data } = await api.post('/api/favorites', {
  entityType: 'movie',
  entityId: 'movie_001'
})

// 删除收藏
await api.delete(`/api/favorites/${favoriteId}`)

// 检查状态
const { data } = await api.get(`/api/favorites/check/movie/movie_001`)
```

## 变更日志

### v1.0.0 (2026-03-31)

**新增**：
- ✅ 获取收藏列表接口
- ✅ 添加收藏接口
- ✅ 删除收藏接口
- ✅ 检查收藏状态接口
- ✅ 支持 4 种实体类型
- ✅ 完整的认证和授权
- ✅ 防重复收藏机制

## 相关文档

- [useFavorites Composable](../composables/useFavorites.md)
- [Favorites 页面](../views/Favorites.md)
- [数据库 Schema](../../../packages/db/README.md)

---

**版本**：1.0.0  
**维护者**：Starye Team  
**最后更新**：2026-03-31
