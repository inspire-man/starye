<script setup lang="ts">
/**
 * 漫画首页 - 展示所有可用漫画
 */
const config = useRuntimeConfig()
const { data: comics, pending, error } = useFetch(`${config.public.apiUrl}/api/comics`)
</script>

<template>
  <div class="container mx-auto py-8 px-4">
    <header class="mb-8">
      <h1 class="text-3xl font-bold tracking-tight">星夜漫画 (Starye Comic)</h1>
      <p class="text-muted-foreground mt-2">沉浸式阅读体验，全站 R18 保护已开启。</p>
    </header>

    <div v-if="pending" class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
      <div v-for="i in 12" :key="i" class="aspect-[3/4] bg-muted animate-pulse rounded-lg" />
    </div>

    <div v-else-if="error" class="p-4 bg-destructive/10 text-destructive rounded-lg">
      加载失败: {{ error.message }}
    </div>

    <div v-else class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
      <div v-for="comic in (comics as any)" :key="comic.slug" class="group cursor-pointer">
        <div class="aspect-[3/4] overflow-hidden rounded-lg bg-muted mb-2 border hover:ring-2 ring-primary transition-all">
          <img 
            v-if="comic.coverImage" 
            :src="comic.coverImage" 
            :alt="comic.title"
            class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
          <div v-else class="w-full h-full flex flex-col items-center justify-center p-4 text-center">
            <span class="text-2xl mb-2">🔞</span>
            <span class="text-xs text-muted-foreground">需成年验证可见封面</span>
          </div>
        </div>
        <h3 class="font-medium leading-snug line-clamp-2 text-sm">{{ comic.title }}</h3>
        <p class="text-xs text-muted-foreground mt-1">{{ comic.author || '未知作者' }}</p>
      </div>
    </div>
  </div>
</template>
