<script setup lang="ts">
/**
 * 章节阅读器
 */
import type { ChapterWithPages } from '../../types/content'
import ChapterNav from '../../components/ChapterNav.vue'
import { useApi } from '../../lib/api'

const route = useRoute()
const { slug, chapterSlug } = route.params

const { data: response, pending, error } = useApi<ChapterWithPages>(`/api/comics/${slug}/${chapterSlug}`)
const chapter = computed(() => response.value?.data)

const isForbidden = computed(() => error.value?.statusCode === 403)
</script>

<template>
  <div class="min-h-screen bg-[#0a0a0a] text-neutral-100 flex flex-col">
    <header class="sticky top-0 z-50 bg-black/60 backdrop-blur-xl border-b border-white/5 px-6 py-4 flex items-center justify-between">
      <div class="flex items-center gap-5">
        <NuxtLink :to="`/${slug}`" replace class="p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full transition-all">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6" /></svg>
        </NuxtLink>
        <div>
          <h1 class="text-sm font-black tracking-tight truncate max-w-[240px]">
            {{ chapter?.title || $t('common.loading') }}
          </h1>
          <p class="text-[9px] text-neutral-500 font-bold uppercase tracking-[0.2em] mt-0.5">
            {{ chapter?.comic?.title }}
          </p>
        </div>
      </div>
    </header>

    <div v-if="pending" class="flex-1 flex flex-col items-center justify-center animate-pulse">
      <div class="w-12 h-12 border-4 border-primary/30 border-t-primary animate-spin rounded-full mb-4" />
      <p class="text-[10px] font-bold uppercase tracking-widest text-neutral-500">
        {{ $t('comic.initializing_session') }}
      </p>
    </div>

    <div v-else-if="isForbidden" class="flex-1 flex flex-col items-center justify-center p-10 text-center">
      <div class="w-24 h-24 bg-destructive/10 text-destructive rounded-full flex items-center justify-center mb-8 text-5xl border border-destructive/20 animate-bounce">
        🔞
      </div>
      <h2 class="text-3xl font-black tracking-tighter">
        {{ $t('comic.restricted_content') }}
      </h2>
      <p class="text-neutral-500 mt-6 max-w-sm mx-auto text-sm leading-relaxed">
        {{ $t('comic.r18_warning') }}
      </p>
      <div class="mt-10 flex gap-4">
        <NuxtLink to="/" class="px-8 py-3 bg-neutral-900 border border-white/10 hover:bg-neutral-800 rounded-full transition-all text-xs font-bold uppercase">
          {{ $t('comic.back_home') }}
        </NuxtLink>
        <button class="px-8 py-3 bg-primary text-primary-foreground rounded-full transition-all text-xs font-black uppercase shadow-[0_0_20px_rgba(var(--primary),0.3)]">
          {{ $t('comic.verify_age') }}
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
        >
        <div class="absolute bottom-4 right-4 px-2.5 py-1 bg-black/40 backdrop-blur-md rounded text-[9px] font-bold text-white/50 opacity-0 group-hover:opacity-100 transition-opacity">
          {{ $t('comic.page', { page: page.pageNumber }) }}
        </div>
      </div>

      <div class="h-32" />
    </main>

    <ChapterNav
      v-if="chapter"
      :slug="slug as string"
      :current-slug="chapterSlug as string"
      :chapters="chapter.allChapters || []"
      :prev="chapter.prevChapter"
      :next="chapter.nextChapter"
    />
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
