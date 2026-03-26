<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { fetchApi } from '@/lib/api'

interface Props {
  entityType: 'actor' | 'publisher' | 'movie' | 'comic'
  entityId: string
  compact?: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  favorited: []
  unfavorited: []
}>()

const isFavorited = ref(false)
const loading = ref(false)
const error = ref('')

async function checkFavoriteStatus() {
  try {
    const response = await fetchApi<{ data: any[] }>(`/favorites?entityType=${props.entityType}`)
    const favorites = response.data || []
    isFavorited.value = favorites.some(f => f.entityId === props.entityId)
  }
  catch (e) {
    console.error('Failed to check favorite status:', e)
  }
}

async function toggleFavorite() {
  if (loading.value)
    return

  loading.value = true
  error.value = ''

  try {
    if (isFavorited.value) {
      // 取消收藏：需要先找到收藏 ID
      const response = await fetchApi<{ data: any[] }>(`/favorites?entityType=${props.entityType}`)
      const favorite = response.data.find(f => f.entityId === props.entityId)

      if (favorite) {
        await fetchApi(`/favorites/${favorite.id}`, {
          method: 'DELETE',
        })
      }

      isFavorited.value = false
      emit('unfavorited')
    }
    else {
      // 添加收藏
      await fetchApi('/favorites', {
        method: 'POST',
        body: JSON.stringify({
          entityType: props.entityType,
          entityId: props.entityId,
        }),
      })

      isFavorited.value = true
      emit('favorited')
    }
  }
  catch (e: any) {
    error.value = e.message || '操作失败'
    console.error('Failed to toggle favorite:', e)
  }
  finally {
    loading.value = false
  }
}

onMounted(() => {
  checkFavoriteStatus()
})
</script>

<template>
  <button
    class="favorite-button"
    :class="{ 'is-favorited': isFavorited }"
    :disabled="loading"
    :title="isFavorited ? '取消收藏' : '收藏'"
    @click.stop="toggleFavorite"
  >
    <span class="heart-icon">{{ isFavorited ? '♥' : '♡' }}</span>
    <span v-if="!compact" class="button-text">
      {{ isFavorited ? '已收藏' : '收藏' }}
    </span>
  </button>
</template>

<style scoped>
.favorite-button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: white;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  color: #374151;
  transition: all 0.2s;
}

.favorite-button:hover:not(:disabled) {
  border-color: #ef4444;
  color: #ef4444;
}

.favorite-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.favorite-button.is-favorited {
  background: #fef2f2;
  border-color: #ef4444;
  color: #ef4444;
}

.favorite-button.is-favorited:hover:not(:disabled) {
  background: #fee2e2;
}

.heart-icon {
  font-size: 16px;
  line-height: 1;
}

.button-text {
  font-weight: 500;
}
</style>
