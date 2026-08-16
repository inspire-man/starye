<script setup lang="ts">
import { ComicCard, Pagination, SkeletonCard } from '@starye/ui'
import { onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { useFavorites } from '../composables/useFavorites'
import { useUserStore } from '../stores/user'

const userStore = useUserStore()
const {
  favorites,
  loading,
  error,
  total,
  currentPage,
  totalPages,
  fetchFavorites,
  removeFavorite,
} = useFavorites()

onMounted(() => {
  if (userStore.user) {
    fetchFavorites(1)
  }
})

function changePage(page: number) {
  void fetchFavorites(page)
  window.scrollTo({ top: 0, behavior: 'smooth' })
}
</script>

<template>
  <div class="ui-public-page">
    <header class="ui-public-page-header">
      <div>
        <h1 class="ui-public-page-title">
          我的收藏
        </h1>
        <p class="ui-public-page-description">
          共 {{ total }} 部漫画
        </p>
      </div>
    </header>

    <!-- 加载中 -->
    <div v-if="loading" class="ui-public-grid">
      <SkeletonCard v-for="i in 10" :key="i" variant="poster" />
    </div>

    <div v-else-if="error" class="ui-public-empty">
      <span class="text-3xl text-[hsl(var(--status-danger))]">!</span>
      <p>{{ error }}</p>
      <button class="ui-public-button ui-public-button-ghost" @click="fetchFavorites(currentPage)">
        重试
      </button>
    </div>

    <!-- 空状态 -->
    <div v-else-if="favorites.length === 0" class="ui-public-empty">
      <span class="text-3xl">♡</span>
      <p class="font-medium">
        还没有收藏任何漫画
      </p>
      <RouterLink to="/" class="text-sm text-primary hover:underline">
        去发现好漫画
      </RouterLink>
    </div>

    <!-- 收藏列表 -->
    <div v-else class="space-y-4">
      <div class="ui-public-grid">
        <div
          v-for="item in favorites"
          :key="item.id"
          class="group relative min-w-0"
        >
          <ComicCard
            v-if="item.entity"
            :title="item.entity.name"
            :href="`/${item.entity.slug}`"
            :cover="item.entity.cover"
            label-missing-cover="暂无封面"
            label-unknown-author="收藏漫画"
          />
          <div v-else class="ui-public-empty min-h-0 aspect-[3/4] p-3">
            <span class="text-2xl">□</span>
            <p class="line-clamp-2 text-sm">
              内容已删除
            </p>
          </div>

          <!-- 取消收藏按钮 -->
          <button
            class="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/30 bg-black/65 text-white opacity-0 shadow-sm transition-opacity group-hover:opacity-100 hover:bg-[hsl(var(--status-danger))]"
            title="取消收藏"
            @click.prevent="removeFavorite(item.id, item.entityId, item.entity?.name)"
          >
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
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
  </div>
</template>
