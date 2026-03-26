<script setup lang="ts">
/**
 * 用户收藏页面
 *
 * 功能：
 * - 显示用户的所有收藏
 * - 按类型筛选（演员/厂商/电影/漫画）
 * - 分页展示
 */

import { onMounted, ref, watch } from 'vue'
import FavoriteButton from '@/components/FavoriteButton.vue'
import Pagination from '@/components/Pagination.vue'
import { useFilters } from '@/composables/useFilters'
import { usePagination } from '@/composables/usePagination'
import { fetchApi } from '@/lib/api'
import { formatDateTime } from '@/lib/date-utils'

interface Favorite {
  id: string
  userId: string
  entityType: 'actor' | 'publisher' | 'movie' | 'comic'
  entityId: string
  createdAt: number
}

interface EntityDetails {
  id: string
  name: string
  slug?: string
  avatar?: string
  logo?: string
  coverImage?: string
  movieCount?: number
}

const favorites = ref<Favorite[]>([])
const entityDetailsMap = ref<Map<string, EntityDetails>>(new Map())
const loading = ref(false)
const error = ref('')

const { filters, applyFilters } = useFilters({
  entityType: '', // '' | 'actor' | 'publisher' | 'movie' | 'comic'
})

const { currentPage, limit: pageSize, totalPages, total: totalItems, setMeta, goToPage, updatePageSize } = usePagination()

// 监听页码和筛选条件变化
watch([currentPage, () => filters.value.entityType], () => {
  loadFavorites()
}, { immediate: true })

async function loadFavorites() {
  loading.value = true
  error.value = ''

  try {
    const params = new URLSearchParams({
      page: String(currentPage.value),
      limit: String(pageSize.value),
    })

    if (filters.value.entityType) {
      params.append('entityType', filters.value.entityType)
    }

    const response = await fetchApi<{
      success: boolean
      data: Favorite[]
      meta: { total: number, page: number, limit: number, totalPages: number }
    }>(`/favorites?${params}`)

    favorites.value = response.data || []
    setMeta({ total: response.meta.total, totalPages: response.meta.totalPages })

    // 加载实体详情
    await loadEntityDetails()
  }
  catch (e: any) {
    error.value = e.message || '加载失败'
    console.error('Failed to load favorites:', e)
  }
  finally {
    loading.value = false
  }
}

async function loadEntityDetails() {
  const detailsMap = new Map<string, EntityDetails>()

  // 按类型分组实体 ID
  const actorIds = favorites.value.filter(f => f.entityType === 'actor').map(f => f.entityId)
  const publisherIds = favorites.value.filter(f => f.entityType === 'publisher').map(f => f.entityId)

  // 批量加载演员详情
  for (const id of actorIds) {
    try {
      const response = await fetchApi<{ data: any }>(`/admin/actors/${id}`)
      detailsMap.set(id, {
        id: response.data.id,
        name: response.data.name,
        slug: response.data.slug,
        avatar: response.data.avatar,
        movieCount: response.data.movieCount,
      })
    }
    catch (e) {
      console.error(`Failed to load actor ${id}:`, e)
    }
  }

  // 批量加载厂商详情
  for (const id of publisherIds) {
    try {
      const response = await fetchApi<{ data: any }>(`/admin/publishers/${id}`)
      detailsMap.set(id, {
        id: response.data.id,
        name: response.data.name,
        slug: response.data.slug,
        logo: response.data.logo,
        movieCount: response.data.movieCount,
      })
    }
    catch (e) {
      console.error(`Failed to load publisher ${id}:`, e)
    }
  }

  entityDetailsMap.value = detailsMap
}

function getEntityDetails(entityId: string): EntityDetails | null {
  return entityDetailsMap.value.get(entityId) || null
}

function getEntityTypeName(type: string): string {
  const typeNames: Record<string, string> = {
    actor: '演员',
    publisher: '厂商',
    movie: '电影',
    comic: '漫画',
  }
  return typeNames[type] || type
}

function handleUnfavorited(favoriteId: string) {
  favorites.value = favorites.value.filter(f => f.id !== favoriteId)
}

onMounted(() => {
  loadFavorites()
})
</script>

<template>
  <div class="favorites-page">
    <div class="page-header">
      <div>
        <h2 class="page-title">
          我的收藏
        </h2>
        <p class="page-subtitle">
          管理您收藏的演员、厂商和内容
        </p>
      </div>
    </div>

    <!-- 筛选器 -->
    <div class="filter-bar">
      <select v-model="filters.entityType" class="filter-select" @change="applyFilters">
        <option value="">
          全部类型
        </option>
        <option value="actor">
          👤 演员
        </option>
        <option value="publisher">
          🏢 厂商
        </option>
        <option value="movie">
          🎬 电影
        </option>
        <option value="comic">
          📚 漫画
        </option>
      </select>

      <div class="filter-info">
        共 {{ totalItems }} 个收藏
      </div>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="loading">
      加载中...
    </div>

    <!-- 错误提示 -->
    <div v-else-if="error" class="error-message">
      {{ error }}
    </div>

    <!-- 收藏列表 -->
    <div v-else-if="favorites.length > 0" class="favorites-grid">
      <div
        v-for="favorite in favorites"
        :key="favorite.id"
        class="favorite-card"
      >
        <div class="card-image">
          <img
            v-if="getEntityDetails(favorite.entityId)?.avatar"
            :src="getEntityDetails(favorite.entityId)!.avatar"
            :alt="getEntityDetails(favorite.entityId)?.name"
            class="entity-avatar"
          >
          <img
            v-else-if="getEntityDetails(favorite.entityId)?.logo"
            :src="getEntityDetails(favorite.entityId)!.logo"
            :alt="getEntityDetails(favorite.entityId)?.name"
            class="entity-logo"
          >
          <div v-else class="entity-placeholder">
            {{ getEntityDetails(favorite.entityId)?.name?.charAt(0) || '?' }}
          </div>
        </div>

        <div class="card-content">
          <div class="entity-type-badge">
            {{ getEntityTypeName(favorite.entityType) }}
          </div>

          <h3 class="entity-name">
            {{ getEntityDetails(favorite.entityId)?.name || '加载中...' }}
          </h3>

          <div v-if="getEntityDetails(favorite.entityId)?.movieCount" class="entity-meta">
            {{ getEntityDetails(favorite.entityId)?.movieCount }} 部作品
          </div>

          <div class="card-footer">
            <span class="favorite-time">
              收藏于 {{ formatDateTime(favorite.createdAt) }}
            </span>

            <FavoriteButton
              :entity-type="favorite.entityType"
              :entity-id="favorite.entityId"
              compact
              @unfavorited="handleUnfavorited(favorite.id)"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-else class="empty-state">
      <p>暂无收藏</p>
      <p class="hint">
        您可以在演员、厂商、电影和漫画页面添加收藏
      </p>
    </div>

    <!-- 分页器 -->
    <Pagination
      v-if="totalPages > 1"
      :current-page="currentPage"
      :total-pages="totalPages"
      :total="totalItems"
      :page-size="pageSize"
      :page-sizes="[12, 24, 48]"
      layout="total, sizes, prev, pager, next, jumper"
      :background="true"
      @update:current-page="goToPage"
      @update:page-size="updatePageSize"
    />
  </div>
</template>

<style scoped>
.favorites-page {
  padding: 24px;
}

.page-header {
  margin-bottom: 24px;
}

.page-title {
  font-size: 24px;
  font-weight: 600;
  margin: 0 0 8px 0;
}

.page-subtitle {
  color: #6b7280;
  font-size: 14px;
  margin: 0;
}

.filter-bar {
  display: flex;
  gap: 16px;
  align-items: center;
  margin-bottom: 24px;
  padding: 16px;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
}

.filter-select {
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  background: white;
}

.filter-select:hover {
  border-color: #9ca3af;
}

.filter-info {
  margin-left: auto;
  color: #6b7280;
  font-size: 14px;
}

.loading {
  padding: 48px;
  text-align: center;
  color: #6b7280;
}

.error-message {
  padding: 16px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #dc2626;
  border-radius: 8px;
  margin-bottom: 24px;
}

.favorites-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 24px;
  margin-bottom: 24px;
}

.favorite-card {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
  transition: all 0.2s;
}

.favorite-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
}

.card-image {
  width: 100%;
  height: 200px;
  background: #f3f4f6;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.entity-avatar {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.entity-logo {
  max-width: 80%;
  max-height: 80%;
  object-fit: contain;
}

.entity-placeholder {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: #e5e7eb;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  font-weight: 600;
  color: #9ca3af;
}

.card-content {
  padding: 16px;
}

.entity-type-badge {
  display: inline-block;
  padding: 4px 12px;
  background: #dbeafe;
  color: #1e40af;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  margin-bottom: 12px;
}

.entity-name {
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 8px 0;
  color: #111827;
}

.entity-meta {
  font-size: 13px;
  color: #6b7280;
  margin-bottom: 16px;
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 12px;
  border-top: 1px solid #e5e7eb;
}

.favorite-time {
  font-size: 12px;
  color: #9ca3af;
}

.empty-state {
  padding: 96px 24px;
  text-align: center;
  color: #6b7280;
}

.empty-state p {
  margin: 0 0 8px 0;
  font-size: 16px;
}

.empty-state .hint {
  font-size: 14px;
  color: #9ca3af;
}

@media (max-width: 1024px) {
  .favorites-grid {
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  }
}

@media (max-width: 768px) {
  .favorites-grid {
    grid-template-columns: 1fr;
  }
}
</style>
