<script setup lang="ts">
/**
 * 漫画详情页
 */
import type { ComicWithChapters } from '../../types/content'
import { useApi } from '../../lib/api'

const route = useRoute()
const slug = route.params.slug as string

const { data: comic, pending, error } = useApi<ComicWithChapters>(`/api/comics/${slug}`)

const sortedChapters = computed(() => {
  if (!comic.value?.chapters) return []
  return [...comic.value.chapters].sort((a, b) => {
    const numA = a.chapterNumber ?? 0
    const numB = b.chapterNumber ?? 0
    return numA - numB
  })
})
</script>

<template>
  <div class="container mx-auto py-10 px-4 max-w-5xl">
    <div v-if="pending" class="animate-pulse flex flex-col md:flex-row gap-8">
      <div class="w-full md:w-64 aspect-[3/4] bg-muted rounded-xl"></div>
      <div class="flex-1 space-y-4">
        <div class="h-10 w-2/3 bg-muted rounded"></div>
        <div class="h-4 w-1/4 bg-muted rounded"></div>
        <div class="h-32 w-full bg-muted rounded mt-8"></div>
      </div>
    </div>

    <div v-else-if="error" class="text-center py-24 bg-muted/30 rounded-3xl border border-dashed">
      <h2 class="text-2xl font-black">{{ $t('comic.not_found') }}</h2>
      <p class="text-muted-foreground mt-2">{{ $t('comic.not_found_desc') }}</p>
      <NuxtLink to="/" class="mt-8 inline-flex items-center px-6 py-2 bg-primary text-primary-foreground rounded-full font-bold text-sm">
        {{ $t('comic.back_home') }}
      </NuxtLink>
    </div>

    <div v-else-if="comic" class="flex flex-col md:flex-row gap-10">
      <div class="w-full md:w-72 shrink-0">
        <div class="aspect-[3/4] rounded-2xl overflow-hidden border shadow-2xl bg-muted sticky top-24">
          <img 
            v-if="comic.coverImage" 
            :src="comic.coverImage" 
            :alt="comic.title"
            class="w-full h-full object-cover"
          />
          <div v-else class="w-full h-full flex flex-col items-center justify-center p-8 text-center bg-neutral-900 text-white">
             <span class="text-5xl mb-6">🔞</span>
             <p class="font-black text-xl tracking-tighter">{{ $t('comic.restricted_content') }}</p>
             <p class="text-xs text-neutral-500 mt-2">{{ $t('comic.login_required') }}</p>
          </div>
        </div>
      </div>

      <div class="flex-1">
        <nav class="flex items-center gap-2 text-xs text-muted-foreground mb-6">
          <NuxtLink to="/" class="hover:text-primary transition-colors">{{ $t('comic.home') }}</NuxtLink>
          <span>/</span>
          <span class="text-foreground font-medium truncate">{{ comic.title }}</span>
        </nav>

        <h1 class="text-4xl font-black tracking-tight leading-tight">{{ comic.title }}</h1>
        
        <div class="flex flex-wrap gap-3 mt-6">
          <div class="px-3 py-1 bg-primary/5 border border-primary/10 text-primary text-xs font-bold rounded-lg flex items-center gap-2">
             <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
             {{ comic.author || $t('comic.unknown_author') }}
          </div>
          <div v-if="comic.isR18" class="px-3 py-1 bg-destructive text-destructive-foreground text-[10px] font-black uppercase tracking-widest rounded-lg">
             {{ $t('comic.restricted_tag') }}
          </div>
        </div>
        
        <div class="mt-10">
          <h2 class="text-sm font-black uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
             <span class="w-4 h-[2px] bg-primary"></span>
             {{ $t('comic.description') }}
          </h2>
          <p class="text-neutral-700 dark:text-neutral-300 leading-relaxed">
            {{ comic.description || $t('comic.no_description') }}
          </p>
        </div>

        <div class="mt-12">
          <div class="flex items-center justify-between mb-6 pb-2 border-b">
            <h2 class="text-xl font-black italic uppercase">{{ $t('comic.chapter_list') }}</h2>
            <span class="text-xs font-bold px-2 py-1 bg-muted rounded">{{ $t('comic.chapters_count', { count: comic.chapters?.length || 0 }) }}</span>
          </div>
          
          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            <NuxtLink 
              v-for="chapter in sortedChapters" 
              :key="chapter.slug"
              :to="`/${slug}/${chapter.slug}`"
              class="group px-4 py-3 rounded-xl border bg-card hover:border-primary hover:bg-primary/5 transition-all text-center"
            >
              <span class="text-sm font-bold group-hover:text-primary">{{ chapter.title }}</span>
            </NuxtLink>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
