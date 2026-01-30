<script setup lang="ts">
import type { Movie } from '@starye/db/schema'
import { useApi } from '../lib/api'

const { data: response, pending, error } = useApi<Movie[]>('/api/movies', {
  query: { limit: 24 },
  server: false, // 强制在客户端请求，避免 SSR 相对路径报错
  lazy: true, // 懒加载，不阻塞页面导航
})

const featuredMovies = computed(() => response.value?.data || [])

function formatDate(dateStr: any) {
  if (!dateStr)
    return ''
  return new Date(dateStr).toLocaleDateString()
}
</script>

<template>
  <div class="container mx-auto py-12 px-4">
    <header class="mb-12">
      <h1 class="text-4xl font-extrabold tracking-tight">
        {{ $t('movie.title') }}
      </h1>
      <p class="text-muted-foreground mt-3 text-lg">
        {{ $t('movie.subtitle') }}
      </p>
    </header>

    <div v-if="pending" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      <div v-for="i in 8" :key="i" class="aspect-video bg-muted animate-pulse rounded-xl" />
    </div>

    <div v-else-if="error" class="p-6 bg-destructive/10 text-destructive rounded-xl border border-destructive/20">
      <p class="font-bold">
        {{ $t('common.error') }}
      </p>
      <p class="text-sm opacity-80">
        {{ error.message }}
      </p>
    </div>

    <div v-else>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
        <NuxtLink
          v-for="movie in featuredMovies"
          :key="movie.slug"
          :to="`/${movie.slug}`"
          class="group block space-y-3"
        >
          <div class="relative aspect-[16/9] overflow-hidden rounded-xl bg-muted border border-border/40">
            <img
              v-if="movie.coverImage"
              :src="movie.coverImage"
              :alt="movie.title"
              class="object-cover w-full h-full transition-transform duration-500 group-hover:scale-110"
              loading="lazy"
            >
            <div v-else class="flex items-center justify-center h-full bg-muted/50">
              <span v-if="movie.isR18" class="text-xs font-bold px-2 py-1 bg-destructive/10 text-destructive border border-destructive/20 rounded">
                {{ $t('movie.adult_only') }}
              </span>
            </div>

            <div class="absolute bottom-2 left-2">
              <span class="text-[10px] font-bold bg-black/60 text-white px-1.5 py-0.5 rounded backdrop-blur-sm uppercase tracking-wider">
                {{ movie.code }}
              </span>
            </div>
          </div>

          <div class="px-1">
            <h3 class="font-bold leading-snug line-clamp-2 group-hover:text-primary transition-colors text-sm md:text-base">
              {{ movie.title }}
            </h3>
            <p class="text-xs text-muted-foreground mt-1.5 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2" /><line x1="16" x2="16" y1="2" y2="6" /><line x1="8" x2="8" y1="2" y2="6" /><line x1="3" x2="21" y1="10" y2="10" /></svg>
              {{ formatDate(movie.releaseDate) }}
            </p>
          </div>
        </NuxtLink>
      </div>
    </div>
  </div>
</template>
