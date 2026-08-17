<script setup lang="ts">
import type { SelectOption } from '@starye/ui'
import { Pagination, Select } from '@starye/ui'
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useFavorites } from '../composables/useFavorites'
import { useMobileDetect } from '../composables/useMobileDetect'
import { useToast } from '../composables/useToast'

const { isMobile } = useMobileDetect()
const { showToast } = useToast()

// 筛选器
const selectedType = ref<'all' | 'movie' | 'actor' | 'publisher' | 'comic'>('all')

// 类型选项
const typeOptions: SelectOption<typeof selectedType.value>[] = [
  { label: '全部', value: 'all', icon: '📋' },
  { label: '影片', value: 'movie', icon: '🎬' },
  { label: '女优', value: 'actor', icon: '👤' },
  { label: '厂商', value: 'publisher', icon: '🏢' },
  { label: '漫画', value: 'comic', icon: '📚' },
]

// 使用 composable
const {
  favorites,
  loading,
  error,
  total,
  currentPage,
  totalPages,
  isEmpty,
  fetchFavorites,
  removeFavorite,
  refresh,
} = useFavorites({
  entityType: computed(() => selectedType.value === 'all' ? undefined : selectedType.value),
  autoLoad: false,
})

// 实体类型标签映射
const entityTypeLabels: Record<string, { label: string, icon: string, color: string }> = {
  movie: { label: '影片', icon: '🎬', color: 'blue' },
  actor: { label: '女优', icon: '👤', color: 'pink' },
  publisher: { label: '厂商', icon: '🏢', color: 'purple' },
  comic: { label: '漫画', icon: '📚', color: 'green' },
}

function getEntityStatusClass(entityType: string): string {
  if (entityType === 'movie')
    return 'ui-status-info'
  if (entityType === 'actor')
    return 'ui-status-success'
  if (entityType === 'publisher')
    return 'ui-status-warning'
  return 'ui-status-neutral'
}

// 构建实体跳转链接
function getEntityLink(favorite: { entityType: string, entity?: { slug: string } | null }) {
  const slug = favorite.entity?.slug || ''
  switch (favorite.entityType) {
    case 'movie': return `/movie/${slug}`
    case 'actor': return `/actors/${slug}`
    case 'publisher': return `/publishers/${slug}`
    case 'comic': return `/comic/${slug}`
    default: return '/'
  }
}

// 删除确认
const deletingId = ref<string | null>(null)

// 确认删除弹窗
const confirmModal = ref({ show: false, favoriteId: '' })

function requestDelete(favoriteId: string) {
  confirmModal.value = { show: true, favoriteId }
}

function cancelDelete() {
  confirmModal.value = { show: false, favoriteId: '' }
}

async function confirmDeleteAction() {
  const favoriteId = confirmModal.value.favoriteId
  confirmModal.value = { show: false, favoriteId: '' }

  deletingId.value = favoriteId
  const result = await removeFavorite(favoriteId)
  deletingId.value = null

  if (result.success) {
    showToast('已取消收藏')
  }
  else {
    showToast(result.error || '删除失败', 'error')
  }
}

function changePage(page: number) {
  void fetchFavorites(page)
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

// 类型切换
function handleTypeChange(type: typeof selectedType.value) {
  selectedType.value = type
  refresh()
}

onMounted(() => {
  fetchFavorites(1)
})
</script>

<template>
  <div class="ui-public-page favorites-page">
    <!-- 页面标题 -->
    <div class="ui-public-page-header">
      <div>
        <h1 class="ui-public-page-title">
          我的收藏
        </h1>
        <p class="ui-public-page-description">
          共 {{ total }} 项收藏
        </p>
      </div>
    </div>

    <!-- 筛选器 -->
    <div class="ui-public-surface ui-public-actions mb-5 p-4">
      <div class="ui-public-field min-w-48">
        <label for="movie-favorite-type">类型筛选</label>
        <Select
          id="movie-favorite-type"
          :model-value="selectedType"
          :options="typeOptions"
          size="default"
          class="w-40"
          @update:model-value="handleTypeChange"
        />
      </div>

      <button
        class="ui-public-button ui-public-button-ghost ml-auto"
        :disabled="loading"
        @click="refresh"
      >
        <span v-if="loading">⟳</span>
        <span v-else>🔄</span>
        刷新
      </button>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading && favorites.length === 0" class="ui-public-empty">
      <span class="text-3xl animate-pulse">...</span>
      <p>加载中...</p>
    </div>

    <!-- 错误状态 -->
    <div v-else-if="error" class="ui-public-empty">
      <span class="text-3xl text-[hsl(var(--status-danger))]">!</span>
      <p class="mb-4 text-[hsl(var(--status-danger))]">
        {{ error }}
      </p>
      <button
        class="ui-public-button ui-public-button-primary"
        @click="refresh"
      >
        重试
      </button>
    </div>

    <!-- 空状态 -->
    <div v-else-if="isEmpty" class="ui-public-empty">
      <span class="text-3xl">☆</span>
      <p class="mb-4 text-muted-foreground">
        还没有收藏任何内容
      </p>
      <RouterLink
        to="/"
        class="ui-public-button ui-public-button-primary"
      >
        去首页看看
      </RouterLink>
    </div>

    <!-- 收藏列表 -->
    <div v-else class="space-y-4">
      <div
        v-for="favorite in favorites"
        :key="favorite.id"
        class="ui-public-card-row"
      >
        <div class="flex items-center gap-4">
          <!-- 封面/头像 -->
          <RouterLink
            v-if="favorite.entity"
            :to="getEntityLink(favorite)"
            class="shrink-0"
          >
            <img
              v-if="favorite.entity.cover"
              :src="favorite.entity.cover"
              :alt="favorite.entity.name"
              class="h-20 w-16 rounded-md object-cover"
              :class="favorite.entityType === 'movie' ? 'object-right' : 'object-center'"
            >
            <div
              v-else
              class="ui-public-empty min-h-0 h-20 w-16 rounded-md p-0 text-xl"
              :class="getEntityStatusClass(favorite.entityType)"
            >
              {{ entityTypeLabels[favorite.entityType]?.icon || '📌' }}
            </div>
          </RouterLink>
          <div
            v-else
            class="ui-public-empty min-h-0 h-20 w-16 shrink-0 rounded-md p-0 text-xl"
          >
            🚫
          </div>

          <!-- 内容区 -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-1">
              <span
                class="ui-status-tag"
                :class="getEntityStatusClass(favorite.entityType)"
              >
                {{ entityTypeLabels[favorite.entityType]?.label || favorite.entityType }}
              </span>
            </div>
            <RouterLink
              v-if="favorite.entity"
              :to="getEntityLink(favorite)"
              class="block truncate font-medium text-foreground transition-colors hover:text-primary"
            >
              {{ favorite.entity.name }}
            </RouterLink>
            <div v-else class="font-medium text-muted-foreground">
              内容已删除
            </div>
            <div class="text-sm text-muted-foreground">
              收藏于 {{ new Date(favorite.createdAt * 1000).toLocaleDateString('zh-CN') }}
            </div>
          </div>

          <!-- 操作按钮 -->
          <button
            class="ui-public-button ui-public-button-danger shrink-0"
            :disabled="deletingId === favorite.id"
            @click="requestDelete(favorite.id)"
          >
            <span v-if="deletingId === favorite.id">⟳</span>
            <span v-else>🗑️</span>
            {{ isMobile ? '' : '取消收藏' }}
          </button>
        </div>
      </div>

      <Pagination
        v-if="totalPages > 1"
        :current-page="currentPage"
        :total-pages="totalPages"
        :total="total"
        :page-size="20"
        layout="total, prev, pager, next, jumper"
        @page-change="changePage"
      />
    </div>

    <!-- 确认删除弹窗 -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="confirmModal.show" class="fixed inset-0 z-[1200] flex items-center justify-center bg-black/70 p-4" @click.self="cancelDelete">
          <div class="w-full max-w-sm rounded-[var(--ui-radius-lg)] border border-border bg-card p-5 shadow-2xl">
            <p class="mb-2 text-lg font-medium text-foreground">
              确认取消收藏？
            </p>
            <p class="mb-6 text-sm text-muted-foreground">
              取消后可随时重新收藏。
            </p>
            <div class="flex gap-3 justify-end">
              <button class="ui-public-button ui-public-button-ghost" @click="cancelDelete">
                取消
              </button>
              <button class="ui-public-button ui-public-button-danger" @click="confirmDeleteAction">
                确认删除
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
@media (max-width: 768px) {
  .ui-public-card-row {
    align-items: flex-start;
    padding: var(--ui-space-3);
  }
}
</style>
