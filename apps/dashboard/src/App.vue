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
  <div class="min-h-screen bg-background text-foreground p-8">
    <div class="max-w-4xl mx-auto space-y-6">
      <header class="flex items-center justify-between">
        <h1 class="text-3xl font-bold text-primary">Starye Dashboard</h1>
        <span class="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">API: {{ api.API_BASE }}</span>
      </header>

      <div v-if="loading" class="text-center py-10 text-muted-foreground">Loading comics...</div>
      
      <div v-else-if="error" class="p-4 bg-red-50 text-red-600 border border-red-200 rounded-lg">
        <p class="font-bold">Error loading data</p>
        <p class="text-sm">{{ error }}</p>
        <p class="text-xs mt-2 text-red-400">Make sure the API server is running (apps/api).</p>
      </div>

      <div v-else-if="comics.length === 0" class="text-center py-10 text-muted-foreground">
        No comics found. Run the crawler to populate data.
      </div>

      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div v-for="comic in comics" :key="comic.slug" class="border rounded-lg p-4 bg-card shadow-sm hover:shadow-md transition-shadow">
          <div class="aspect-[2/3] w-full bg-muted rounded-md mb-3 overflow-hidden relative">
             <img v-if="comic.coverImage" :src="comic.coverImage" class="w-full h-full object-cover" loading="lazy" />
             <div v-else class="absolute inset-0 flex items-center justify-center text-muted-foreground">No Cover</div>
          </div>
          
          <h2 class="font-semibold text-lg truncate" :title="comic.title">{{ comic.title }}</h2>
          <p class="text-sm text-muted-foreground truncate">{{ comic.author || 'Unknown Author' }}</p>
        </div>
      </div>
    </div>
  </div>
</template>