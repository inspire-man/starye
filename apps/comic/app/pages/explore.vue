<script setup lang="ts">
import type { Comic } from '@starye/db/schema'
import { ComicCard } from '@starye/ui'
import { useApi } from '../lib/api'

const route = useRoute()
const router = useRouter()

const page = computed({
  get: () => Number(route.query.page) || 1,
  set: (val) => router.push({ query: { ...route.query, page: val } })
})

const limit = 24

const { data: response, pending, error } = useApi<Comic[]>('/api/comics', {
  query: {
    page,
    limit,
  },
  watch: [page]
})

const comics = computed(() => response.value?.data || [])
const meta = computed(() => response.value?.meta)

function changePage(newPage: number) {
  if (newPage < 1 || (meta.value && newPage > meta.value.totalPages)) return
  page.value = newPage
  window.scrollTo({ top: 0, behavior: 'smooth' })
}
</script>

<template>
  <div class="container mx-auto py-12 px-4">
    <header class="mb-12">
      <h1 class="text-3xl font-bold tracking-tight mb-2">{{ $t('comic.all_comics') }}</h1>
       <nav class="text-sm text-muted-foreground">
        <NuxtLink to="/" class="hover:text-primary">{{ $t('comic.home') }}</NuxtLink>
        <span class="mx-2">/</span>
        <span>{{ $t('comic.explore') }}</span>
      </nav>
    </header>

    <div v-if="pending" class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
      <div v-for="i in 12" :key="i" class="aspect-[3/4] bg-muted animate-pulse rounded-xl" />
    </div>

    <div v-else-if="error" class="p-6 bg-destructive/10 text-destructive rounded-xl border border-destructive/20">
      <p class="font-bold">{{ $t('common.error') }}</p>
      <p class="text-sm opacity-80">{{ error.message }}</p>
    </div>

    <div v-else class="flex flex-col gap-8">
      <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-8">
        <ComicCard
          v-for="comic in comics"
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

      <!-- Pagination -->
      <div v-if="meta && meta.totalPages > 1" class="flex justify-center items-center gap-4 mt-8">
        <button
          :disabled="page === 1"
          @click="changePage(page - 1)"
          class="px-4 py-2 text-sm font-medium border rounded-md hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {{ $t('common.prev') }}
        </button>
        
        <span class="text-sm font-medium">
          {{ page }} / {{ meta.totalPages }}
        </span>
        
        <button
          :disabled="page === meta.totalPages"
          @click="changePage(page + 1)"
          class="px-4 py-2 text-sm font-medium border rounded-md hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {{ $t('common.next') }}
        </button>
      </div>
    </div>
  </div>
</template>