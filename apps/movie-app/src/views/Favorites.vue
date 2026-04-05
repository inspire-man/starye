<script setup lang="ts">
import type { SelectOption } from '../components/Select.vue'
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import Select from '../components/Select.vue'
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
  isEmpty,
  hasMore,
  fetchFavorites,
  removeFavorite,
  loadMore,
  refresh,
} = useFavorites({
  entityType: computed(() => selectedType.value === 'all' ? undefined : selectedType.value).value,
  autoLoad: false,
})

// 实体类型标签映射
const entityTypeLabels: Record<string, { label: string, icon: string, color: string }> = {
  movie: { label: '影片', icon: '🎬', color: 'blue' },
  actor: { label: '女优', icon: '👤', color: 'pink' },
  publisher: { label: '厂商', icon: '🏢', color: 'purple' },
  comic: { label: '漫画', icon: '📚', color: 'green' },
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

// 加载更多
async function handleLoadMore() {
  await loadMore()
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
  <div class="favorites-page">
    <!-- 页面标题 -->
    <div class="mb-6">
      <h1 class="text-3xl font-bold text-white mb-2">
        ⭐ 我的收藏
      </h1>
      <p class="text-gray-400">
        共 {{ total }} 项收藏
      </p>
    </div>

    <!-- 筛选器 -->
    <div class="mb-6 flex items-center gap-4">
      <div class="shrink-0">
        <label class="text-sm text-gray-400 mb-2 block">类型筛选</label>
        <Select
          :model-value="selectedType"
          :options="typeOptions"
          size="default"
          class="w-40"
          @update:model-value="handleTypeChange"
        />
      </div>

      <button
        class="ml-auto px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md transition-colors"
        :disabled="loading"
        @click="refresh"
      >
        <span v-if="loading">⟳</span>
        <span v-else>🔄</span>
        刷新
      </button>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading && favorites.length === 0" class="text-center py-12">
      <div class="inline-block animate-spin text-4xl mb-4">
        ⟳
      </div>
      <p class="text-gray-400">
        加载中...
      </p>
    </div>

    <!-- 错误状态 -->
    <div v-else-if="error" class="text-center py-12">
      <div class="text-4xl mb-4">
        ⚠️
      </div>
      <p class="text-red-400 mb-4">
        {{ error }}
      </p>
      <button
        class="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-md transition"
        @click="refresh"
      >
        重试
      </button>
    </div>

    <!-- 空状态 -->
    <div v-else-if="isEmpty" class="text-center py-12">
      <div class="text-6xl mb-4">
        ⭐
      </div>
      <p class="text-gray-400 mb-6">
        还没有收藏任何内容
      </p>
      <RouterLink
        to="/"
        class="inline-block px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-md transition"
      >
        去首页看看
      </RouterLink>
    </div>

    <!-- 收藏列表 -->
    <div v-else class="space-y-4">
      <div
        v-for="favorite in favorites"
        :key="favorite.id"
        class="favorite-card"
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
              class="w-16 h-20 object-cover rounded-lg"
              :class="favorite.entityType === 'movie' ? 'object-right' : 'object-center'"
            >
            <div
              v-else
              class="w-16 h-20 rounded-lg flex items-center justify-center text-2xl"
              :class="{
                'bg-blue-500/10 border border-blue-500/30': favorite.entityType === 'movie',
                'bg-pink-500/10 border border-pink-500/30': favorite.entityType === 'actor',
                'bg-purple-500/10 border border-purple-500/30': favorite.entityType === 'publisher',
                'bg-green-500/10 border border-green-500/30': favorite.entityType === 'comic',
              }"
            >
              {{ entityTypeLabels[favorite.entityType]?.icon || '📌' }}
            </div>
          </RouterLink>
          <div
            v-else
            class="shrink-0 w-16 h-20 rounded-lg flex items-center justify-center text-2xl bg-gray-700/50 border border-gray-600/30"
          >
            🚫
          </div>

          <!-- 内容区 -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-1">
              <span
                class="text-xs px-2 py-0.5 rounded-full font-medium"
                :class="{
                  'bg-blue-500/20 text-blue-400': favorite.entityType === 'movie',
                  'bg-pink-500/20 text-pink-400': favorite.entityType === 'actor',
                  'bg-purple-500/20 text-purple-400': favorite.entityType === 'publisher',
                  'bg-green-500/20 text-green-400': favorite.entityType === 'comic',
                }"
              >
                {{ entityTypeLabels[favorite.entityType]?.label || favorite.entityType }}
              </span>
            </div>
            <RouterLink
              v-if="favorite.entity"
              :to="getEntityLink(favorite)"
              class="text-white font-medium hover:text-primary-400 transition-colors block truncate"
            >
              {{ favorite.entity.name }}
            </RouterLink>
            <div v-else class="text-gray-500 font-medium">
              内容已删除
            </div>
            <div class="text-sm text-gray-400">
              收藏于 {{ new Date(favorite.createdAt * 1000).toLocaleDateString('zh-CN') }}
            </div>
          </div>

          <!-- 操作按钮 -->
          <button
            class="shrink-0 px-4 py-2 bg-red-600/80 hover:bg-red-600 text-white rounded-md transition-colors disabled:opacity-50"
            :disabled="deletingId === favorite.id"
            @click="requestDelete(favorite.id)"
          >
            <span v-if="deletingId === favorite.id">⟳</span>
            <span v-else>🗑️</span>
            {{ isMobile ? '' : '取消收藏' }}
          </button>
        </div>
      </div>

      <!-- 加载更多 -->
      <div v-if="hasMore" class="text-center py-6">
        <button
          class="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-md transition-colors disabled:opacity-50"
          :disabled="loading"
          @click="handleLoadMore"
        >
          <span v-if="loading">⟳ 加载中...</span>
          <span v-else>加载更多</span>
        </button>
      </div>

      <!-- 底部提示 -->
      <div v-else-if="favorites.length > 0" class="text-center py-6 text-gray-500 text-sm">
        已加载全部 {{ total }} 项收藏
      </div>
    </div>

    <!-- 确认删除弹窗 -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="confirmModal.show" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" @click.self="cancelDelete">
          <div class="bg-gray-800 border border-gray-600 rounded-xl p-6 max-w-sm mx-4 shadow-2xl">
            <p class="text-white text-lg font-medium mb-2">
              确认取消收藏？
            </p>
            <p class="text-gray-400 text-sm mb-6">
              取消后可随时重新收藏。
            </p>
            <div class="flex gap-3 justify-end">
              <button class="px-4 py-2 text-sm rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors" @click="cancelDelete">
                取消
              </button>
              <button class="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-500 transition-colors" @click="confirmDeleteAction">
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
.favorite-card {
  background: rgba(31, 41, 55, 0.5);
  border: 1px solid rgba(75, 85, 99, 0.5);
  border-radius: 12px;
  padding: 16px;
  transition: all 0.2s;
}

.favorite-card:hover {
  background: rgba(31, 41, 55, 0.8);
  border-color: rgba(75, 85, 99, 0.8);
  transform: translateY(-2px);
}

@media (max-width: 768px) {
  .favorite-card {
    padding: 12px;
  }
}
</style>
