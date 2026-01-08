<script setup lang="ts">
import type { Comic } from '@starye/db/schema'
import { ComicCard } from '@starye/ui'
import { useApi } from '../lib/api'

const { data: response, pending, error } = useApi<Comic[]>('/api/comics', {
  query: { limit: 12 },
})

// Client-side slice for now (limit 12)
const featuredComics = computed(() => response.value?.data || [])
</script>

<template>
  <div class="container mx-auto py-12 px-4">
    <header class="mb-12 flex items-end justify-between">
      <div>
        <h1 class="text-4xl font-extrabold tracking-tight">
          {{ $t('comic.title') }}
        </h1>
        <p class="text-muted-foreground mt-3 text-lg">
          {{ $t('comic.subtitle') }}
        </p>
      </div>
      <NuxtLink to="/explore" class="hidden md:inline-flex items-center gap-1 font-bold text-primary hover:text-primary/80 transition-colors">
        {{ $t('comic.view_all') }}
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
      </NuxtLink>
    </header>

    <div v-if="pending" class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
      <div v-for="i in 6" :key="i" class="aspect-[3/4] bg-muted animate-pulse rounded-xl" />
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
      <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-8 mb-8">
        <ComicCard
          v-for="comic in featuredComics"
          :key="comic.slug"
          :title="comic.title"
          :cover="comic.coverImage"
          :author="comic.author"
          :href="`/${comic.slug}`"
          :is-r18="comic.isR18"
          :label-adult-only="$t('comic.adult_only')"
          :label-unknown-author="$t('comic.unknown_author')"
        />
      </div>

      <div class="text-center md:hidden">
        <NuxtLink to="/explore" class="inline-flex items-center justify-center w-full py-3 bg-muted rounded-xl font-bold">
          {{ $t('comic.view_all') }}
        </NuxtLink>
      </div>
    </div>
  </div>
</template>
