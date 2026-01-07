<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { api, type Comic, getAdminToken } from '@/lib/api'

const comics = ref<Comic[]>([])
const loading = ref(true)
const error = ref('')
const isAdmin = ref(!!getAdminToken())

onMounted(async () => {
  try {
    if (isAdmin.value) {
      comics.value = await api.admin.getComics()
    } else {
      comics.value = await api.getComics()
    }
  } catch (e: any) {
    error.value = e.message
  } finally {
    loading.value = false
  }
})

const toggleR18 = async (comic: Comic) => {
  if (!isAdmin.value) return
  const newValue = !comic.isR18
  // Optimistic update
  comic.isR18 = newValue
  
  try {
    if (comic.id) { 
        await api.admin.updateComic(comic.id, { isR18: newValue })
    }
  } catch (e) {
    // Revert
    comic.isR18 = !newValue
    alert('Failed to update')
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold tracking-tight">漫画管理</h1>
      <div class="flex gap-2 items-center">
         <span v-if="isAdmin" class="text-xs bg-primary/10 text-primary px-2 py-1 rounded font-medium border border-primary/20">管理员模式</span>
         <span class="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">API: {{ api.API_BASE }}</span>
      </div>
    </div>

    <div v-if="loading" class="text-center py-20 text-muted-foreground italic">加载中...</div>
    
    <div v-else-if="error" class="p-4 bg-red-50 text-red-600 border border-red-200 rounded-lg">
      <p class="font-bold">无法加载数据</p>
      <p class="text-sm">{{ error }}</p>
      <div v-if="error.includes('401')" class="mt-2">
        <router-link to="/settings" class="text-sm underline hover:text-red-800">前往设置页配置 Admin Token</router-link>
      </div>
    </div>

    <div v-else-if="comics.length === 0" class="text-center py-20 border-2 border-dashed rounded-xl text-muted-foreground">
      暂无漫画数据。请运行爬虫程序抓取内容。
    </div>

    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      <div v-for="comic in comics" :key="comic.slug" class="group border rounded-xl overflow-hidden bg-card shadow-sm hover:shadow-md transition-all relative">
        <!-- Badges -->
        <div class="absolute top-2 right-2 z-10 flex gap-1">
           <button 
             v-if="isAdmin"
             @click.stop="toggleR18(comic)"
             class="text-xs px-2 py-0.5 rounded font-bold transition-colors cursor-pointer shadow-sm border"
             :class="comic.isR18 ? 'bg-red-500 text-white border-red-600 hover:bg-red-600' : 'bg-green-500 text-white border-green-600 hover:bg-green-600'"
           >
             {{ comic.isR18 ? 'R18' : 'SAFE' }}
           </button>
           <span v-else-if="comic.isR18" class="bg-red-500/80 text-white text-xs px-1.5 py-0.5 rounded font-bold">R18</span>
        </div>

        <div class="aspect-[3/4] w-full bg-muted relative overflow-hidden">
           <img v-if="comic.coverImage" :src="comic.coverImage" class="w-full h-full object-cover transition-transform group-hover:scale-105" loading="lazy" />
           <div v-else class="absolute inset-0 flex items-center justify-center text-muted-foreground text-xs text-center p-2 flex-col gap-2 bg-neutral-100 dark:bg-neutral-800">
             <span>🚫 封面隐藏</span>
             <span v-if="comic.isR18" class="text-red-400 text-[10px]">(R18 内容保护)</span>
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