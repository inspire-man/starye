<script setup lang="ts">
/**
 * 章节阅读器
 */
const route = useRoute()
const config = useRuntimeConfig()
const { slug, chapterSlug } = route.params

const { data: chapter, pending, error } = useFetch<any>(`${config.public.apiUrl}/api/comics/${slug}/${chapterSlug}`, {
  credentials: 'include',
  headers: useRequestHeaders(['cookie']),
})

const isForbidden = computed(() => error.value?.statusCode === 403)
</script>

<template>
  <div class="min-h-screen bg-[#0a0a0a] text-neutral-100 flex flex-col">
    <header class="sticky top-0 z-50 bg-black/60 backdrop-blur-xl border-b border-white/5 px-6 py-4 flex items-center justify-between">
      <div class="flex items-center gap-5">
        <NuxtLink :to="`/${slug}`" class="p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full transition-all">
           <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </NuxtLink>
        <div>
          <h1 class="text-sm font-black tracking-tight truncate max-w-[240px]">{{ chapter?.title || 'Loading...' }}</h1>
          <p class="text-[9px] text-neutral-500 font-bold uppercase tracking-[0.2em] mt-0.5">{{ chapter?.comic?.title }}</p>
        </div>
      </div>
    </header>

    <div v-if="pending" class="flex-1 flex flex-col items-center justify-center animate-pulse">
      <div class="w-12 h-12 border-4 border-primary/30 border-t-primary animate-spin rounded-full mb-4"></div>
      <p class="text-[10px] font-bold uppercase tracking-widest text-neutral-500">Initializing Session...</p>
    </div>

    <div v-else-if="isForbidden" class="flex-1 flex flex-col items-center justify-center p-10 text-center">
      <div class="w-24 h-24 bg-destructive/10 text-destructive rounded-full flex items-center justify-center mb-8 text-5xl border border-destructive/20 animate-bounce">
        🔞
      </div>
      <h2 class="text-3xl font-black tracking-tighter">RESTRICTED CONTENT</h2>
      <p class="text-neutral-500 mt-6 max-w-sm mx-auto text-sm leading-relaxed">
        此章节包含成人内容。根据法律及社区准则，您必须登录并完成年龄验证。
      </p>
      <div class="mt-10 flex gap-4">
        <NuxtLink to="/" class="px-8 py-3 bg-neutral-900 border border-white/10 hover:bg-neutral-800 rounded-full transition-all text-xs font-bold uppercase">
          Back Home
        </NuxtLink>
        <button class="px-8 py-3 bg-primary text-primary-foreground rounded-full transition-all text-xs font-black uppercase shadow-[0_0_20px_rgba(var(--primary),0.3)]">
          Verify Age
        </button>
      </div>
    </div>

    <main v-else class="flex-1 w-full max-w-3xl mx-auto py-2 flex flex-col items-center bg-black">
      <div v-for="page in chapter?.pages" :key="page.id" class="w-full relative group">
        <img 
          :src="page.imageUrl" 
          :alt="`Page ${page.pageNumber}`"
          loading="lazy"
          class="w-full h-auto block"
          @contextmenu.prevent
        />
        <div class="absolute bottom-4 right-4 px-2.5 py-1 bg-black/40 backdrop-blur-md rounded text-[9px] font-bold text-white/50 opacity-0 group-hover:opacity-100 transition-opacity">
          PAGE {{ page.pageNumber }}
        </div>
      </div>
      
      <footer class="w-full py-20 px-8 flex flex-col items-center border-t border-white/5 mt-10">
        <div class="w-12 h-1 bg-primary/20 rounded-full mb-10"></div>
        <NuxtLink :to="`/${slug}`" class="px-10 py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl transition-all font-black italic tracking-widest uppercase text-xs">
          Return to Chapters
        </NuxtLink>
      </footer>
    </main>
  </div>
</template>

<style scoped>
main {
  user-select: none;
  -webkit-touch-callout: none;
}
img {
  pointer-events: none;
}
</style>
