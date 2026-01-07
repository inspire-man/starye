<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { api, type Comic } from '@/lib/api'

const comics = ref<Comic[]>([])
const loading = ref(true)
const error = ref('')

onMounted(async () => {
  try {
    comics.value = await api.getComics()
  } catch (e: any) {
    error.value = e.message
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold tracking-tight">漫画管理</h1>
      <span class="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">API: {{ api.API_BASE }}</span>
    </div>

    <div v-if="loading" class="text-center py-20 text-muted-foreground italic">加载中...</div>
    
    <div v-else-if="error" class="p-4 bg-red-50 text-red-600 border border-red-200 rounded-lg">
      <p class="font-bold">无法加载数据</p>
      <p class="text-sm">{{ error }}</p>
    </div>

    <div v-else-if="comics.length === 0" class="text-center py-20 border-2 border-dashed rounded-xl text-muted-foreground">
      暂无漫画数据。请运行爬虫程序抓取内容。
    </div>

    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      <div v-for="comic in comics" :key="comic.slug" class="group border rounded-xl overflow-hidden bg-card shadow-sm hover:shadow-md transition-all">
        <div class="aspect-[3/4] w-full bg-muted relative">
           <img v-if="comic.coverImage" :src="comic.coverImage" class="w-full h-full object-cover transition-transform group-hover:scale-105" loading="lazy" />
           <div v-else class="absolute inset-0 flex items-center justify-center text-muted-foreground text-xs text-center p-2">
             无封面图
           </div>
        </div>
        <div class="p-3">
          <h2 class="font-semibold text-sm truncate" :title="comic.title">{{ comic.title }}</h2>
          <p class="text-xs text-muted-foreground mt-1 truncate">{{ comic.author || '未知作者' }}</p>
        </div>
      </div>
    </div>
  </div>
</template>
