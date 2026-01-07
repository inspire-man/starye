<script setup lang="ts">
/**
 * 漫画首页 - 展示所有可用漫画 (类型安全版)
 */
interface Comic {
  id: string
  title: string
  slug: string
  coverImage: string | null
  author: string | null
  description: string | null
  isR18: boolean
}

const config = useRuntimeConfig()
const { data: comics, pending, error } = useFetch<Comic[]>(`${config.public.apiUrl}/api/comics`)
</script>

<template>
  <div class="container mx-auto py-12 px-4">
    <header class="mb-12">
      <h1 class="text-4xl font-extrabold tracking-tight">星夜漫画</h1>
      <p class="text-muted-foreground mt-3 text-lg">沉浸式阅读</p>
    </header>

    <div v-if="pending" class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
      <div v-for="i in 12" :key="i" class="aspect-[3/4] bg-muted animate-pulse rounded-xl" />
    </div>

    <div v-else-if="error" class="p-6 bg-destructive/10 text-destructive rounded-xl border border-destructive/20">
      <p class="font-bold">加载失败</p>
      <p class="text-sm opacity-80">{{ error.message }}</p>
    </div>

    <div v-else class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-8">
      <NuxtLink
        v-for="comic in comics"
        :key="comic.slug"
        :to="`/${comic.slug}`"
        class="group cursor-pointer"
      >
        <div class="aspect-[3/4] overflow-hidden rounded-xl bg-muted mb-3 border shadow-sm group-hover:shadow-md group-hover:ring-2 ring-primary transition-all duration-300">
          <img
            v-if="comic.coverImage"
            :src="comic.coverImage"
            :alt="comic.title"
            class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
          <div v-else class="w-full h-full flex flex-col items-center justify-center p-4 text-center bg-neutral-100 dark:bg-neutral-900">
            <span class="text-3xl mb-2">🔞</span>
            <span class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Adult Only</span>
          </div>
        </div>
        <h3 class="font-bold leading-tight line-clamp-2 text-sm group-hover:text-primary transition-colors">{{ comic.title }}</h3>
        <p class="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          {{ comic.author || '未知作者' }}
        </p>
      </NuxtLink>
    </div>
  </div>
</template>
