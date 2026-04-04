<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { useFavorites } from '../composables/useFavorites'
import { useUserStore } from '../stores/user'

const userStore = useUserStore()
const { favorites, loading, fetchFavorites, removeFavorite } = useFavorites()

onMounted(() => {
  if (userStore.user) {
    fetchFavorites()
  }
})
</script>

<template>
  <div class="max-w-5xl mx-auto">
    <header class="mb-8">
      <h1 class="text-2xl sm:text-3xl font-bold mb-1">
        我的收藏
      </h1>
      <p class="text-muted-foreground text-sm">
        共 {{ favorites.length }} 部漫画
      </p>
    </header>

    <!-- 加载中 -->
    <div v-if="loading" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
      <div v-for="i in 10" :key="i" class="animate-pulse">
        <div class="bg-muted aspect-3/4 rounded-xl mb-2" />
        <div class="bg-muted h-4 rounded mb-1" />
        <div class="bg-muted h-3 rounded w-2/3" />
      </div>
    </div>

    <!-- 空状态 -->
    <div v-else-if="favorites.length === 0" class="text-center py-24 text-muted-foreground">
      <svg class="w-16 h-16 mx-auto mb-4 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
      </svg>
      <p class="text-lg font-medium mb-2">
        还没有收藏任何漫画
      </p>
      <RouterLink to="/" class="text-primary hover:underline text-sm">
        去发现好漫画 →
      </RouterLink>
    </div>

    <!-- 收藏列表 -->
    <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
      <div
        v-for="item in favorites"
        :key="item.comicId"
        class="group relative"
      >
        <RouterLink :to="`/comic/${item.comic?.slug || item.comicId}`">
          <div class="relative overflow-hidden rounded-xl shadow-sm group-hover:shadow-md transition-shadow duration-200">
            <div class="aspect-3/4 bg-muted">
              <img
                v-if="item.comic?.coverImage"
                :src="item.comic.coverImage"
                :alt="item.comic.title"
                class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                loading="lazy"
              >
              <div v-else class="w-full h-full flex items-center justify-center text-muted-foreground">
                <svg class="w-12 h-12 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
                  <path stroke-linecap="round" stroke-linejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
                </svg>
              </div>
            </div>
            <!-- R18 标签 -->
            <span v-if="item.comic?.isR18" class="absolute top-2 right-2 bg-red-600 text-white text-xs px-1.5 py-0.5 rounded font-medium">
              R18
            </span>
          </div>
          <h3 class="mt-2 text-sm font-medium line-clamp-2 group-hover:text-primary transition-colors">
            {{ item.comic?.title || item.comicId }}
          </h3>
          <p class="text-xs text-muted-foreground line-clamp-1 mt-0.5">
            {{ item.comic?.author || '未知作者' }}
          </p>
        </RouterLink>

        <!-- 取消收藏按钮 -->
        <button
          class="absolute top-2 left-2 w-7 h-7 flex items-center justify-center rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600/80"
          title="取消收藏"
          @click.prevent="removeFavorite(item.comicId, item.comic?.title)"
        >
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>
