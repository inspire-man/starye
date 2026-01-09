<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  slug: string
  currentSlug: string
  chapters: { title: string, slug: string }[]
  prev?: { title: string, slug: string } | null
  next?: { title: string, slug: string } | null
}>()

const isOpen = ref(false)
</script>

<template>
  <div class="relative z-50">
    <!-- Backdrop -->
    <div 
      v-if="isOpen" 
      class="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-300"
      @click="isOpen = false"
    />

    <!-- Navigation Container -->
    <div class="fixed bottom-0 inset-x-0 z-50 flex flex-col justify-end pointer-events-none">
      
      <!-- Drawer / Dropdown -->
      <div
        v-if="isOpen"
        class="bg-neutral-900 border-t border-white/10 max-h-[60vh] overflow-y-auto p-4 shadow-2xl pointer-events-auto animate-in slide-in-from-bottom-5 duration-300"
      >
        <div class="flex justify-between items-center mb-4 sticky top-0 bg-neutral-900 z-10 py-2 border-b border-white/5">
          <h3 class="text-sm font-bold uppercase tracking-widest text-neutral-400">
            {{ $t('comic.chapter_list') }}
          </h3>
          <button class="p-2 hover:bg-white/10 rounded-full transition-colors" @click="isOpen = false">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m18 15-6-6-6 6" /></svg>
          </button>
        </div>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-2">
          <NuxtLink
            v-for="ch in chapters"
            :key="ch.slug"
            :to="`/${slug}/${ch.slug}`"
            replace
            class="px-3 py-2 rounded text-xs font-medium truncate transition-colors text-center"
            :class="ch.slug === currentSlug ? 'bg-primary text-primary-foreground' : 'bg-white/5 hover:bg-white/10 hover:text-white text-neutral-400'"
            @click="isOpen = false"
          >
            {{ ch.title }}
          </NuxtLink>
        </div>
      </div>

      <!-- Toolbar -->
      <div class="bg-black/80 backdrop-blur-xl border-t border-white/10 px-4 py-3 flex items-center justify-between gap-4 safe-area-bottom pointer-events-auto">
        <NuxtLink
          v-if="prev"
          :to="`/${slug}/${prev.slug}`"
          replace
          class="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-white/5 hover:bg-white/10 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 18-6-6-6 6" /></svg>
          <span class="text-xs font-bold truncate max-w-[80px] md:max-w-xs">{{ prev.title }}</span>
        </NuxtLink>
        <button v-else class="flex-1 px-4 py-3 bg-transparent text-neutral-600 text-xs font-bold cursor-not-allowed text-center">
          {{ $t('comic.first_chapter') }}
        </button>

        <button
          class="px-4 py-3 bg-white/5 hover:bg-white/10 rounded-xl flex flex-col items-center justify-center min-w-[60px] transition-colors"
          :class="{ 'bg-white/10 text-white': isOpen }"
          @click="isOpen = !isOpen"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></svg>
        </button>

        <NuxtLink
          v-if="next"
          :to="`/${slug}/${next.slug}`"
          replace
          class="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl transition-colors"
        >
          <span class="text-xs font-bold truncate max-w-[80px] md:max-w-xs">{{ next.title }}</span>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6" /></svg>
        </NuxtLink>
        <button v-else class="flex-1 px-4 py-3 bg-transparent text-neutral-600 text-xs font-bold cursor-not-allowed text-center">
          {{ $t('comic.last_chapter') }}
        </button>
      </div>
    </div>
  </div>
</template>
<style scoped>
.safe-area-bottom {
  padding-bottom: env(safe-area-inset-bottom, 20px);
}
</style>
