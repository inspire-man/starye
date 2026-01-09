<script setup lang="ts">
import type { Comic } from '@starye/db/schema'
import { reactive, computed, watch } from 'vue'
import { ComicCard } from '@starye/ui'
import { useApi } from '../lib/api'

definePageMeta({
  keepalive: true,
})

const route = useRoute()
const router = useRouter()

const page = computed({
  get: () => Number(route.query.page) || 1,
  set: val => router.push({ query: { ...route.query, page: val } }),
})

const filters = reactive({
  region: route.query.region || '',
  genre: route.query.genre || '',
  status: route.query.status || '',
})

// Sync filters back to URL
watch(filters, (newFilters) => {
  router.push({ query: { ...newFilters, page: 1 } }) // Reset to page 1 on filter change
})

const limit = 24

const { data: response, pending, error } = useApi<Comic[]>('/api/comics', {
  // Use a computed property for the query to ensure reactivity
  query: computed(() => ({
    page: page.value,
    limit,
    ...filters,
  })),
})

const comics = computed(() => response.value?.data || [])
const meta = computed(() => response.value?.meta)

const { t } = useI18n()

// Options with i18n
const regionOptions = computed(() => ['韩国', '日本', '台湾'].map(r => ({ label: t(`comic.regions.${r}`), value: r })))
const GENRES = ['青春', '性感', '长腿', '多人', '御姐', '巨乳', '新婚', '媳妇', '暧昧', '清纯', '调教', '少妇', '风骚', '同居', '淫乱', '好友', '女神', '诱惑', '偷情', '出轨', '正妹', '家教']
const statusOptions = computed(() => [
  { label: t('comic.serializing'), value: 'serializing' },
  { label: t('comic.completed'), value: 'completed' },
])

function changePage(newPage: number) {
  if (newPage < 1 || (meta.value && newPage > meta.value.totalPages))
    return
  page.value = newPage
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function clearFilters() {
  filters.region = ''
  filters.genre = ''
  filters.status = ''
}
</script>

<template>
  <div class="container mx-auto py-12 px-4">
    <header class="mb-12">
      <h1 class="text-3xl font-bold tracking-tight mb-2">
        {{ $t('comic.all_comics') }}
      </h1>
      <nav class="text-sm text-muted-foreground">
        <NuxtLink to="/" class="hover:text-primary">
          {{ $t('comic.home') }}
        </NuxtLink>
        <span class="mx-2">/</span>
        <span>{{ $t('comic.explore') }}</span>
      </nav>
    </header>

    <!-- Filters -->
    <div class="mb-8 p-4 bg-muted/50 rounded-2xl flex flex-wrap gap-4 items-center">
      <select v-model="filters.region" class="px-3 py-2 text-sm rounded-lg border bg-background">
        <option value="">
          {{ $t('comic.all_regions') }}
        </option>
        <option v-for="r in regionOptions" :key="r.value" :value="r.value">
          {{ r.label }}
        </option>
      </select>
      <select v-model="filters.genre" class="px-3 py-2 text-sm rounded-lg border bg-background">
        <option value="">
          {{ $t('comic.all_genres') }}
        </option>
        <option v-for="g in GENRES" :key="g" :value="g">
          {{ g }}
        </option>
      </select>
      <select v-model="filters.status" class="px-3 py-2 text-sm rounded-lg border bg-background">
        <option value="">
          {{ $t('comic.all_status') }}
        </option>
        <option v-for="s in statusOptions" :key="s.value" :value="s.value">
          {{ s.label }}
        </option>
      </select>
      <button class="px-3 py-2 text-sm text-muted-foreground hover:text-foreground" @click="clearFilters">
        {{ $t('common.clear') }}
      </button>
    </div>

    <div v-if="pending" class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
      <div v-for="i in 12" :key="i" class="aspect-[3/4] bg-muted animate-pulse rounded-xl" />
    </div>

    <div v-else-if="error" class="p-6 bg-destructive/10 text-destructive rounded-xl border border-destructive/20">
      <p class="font-bold">
        {{ $t('common.error') }}
      </p>
      <p class="text-sm opacity-80">
        {{ error.message }}
      </p>
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
          class="px-4 py-2 text-sm font-medium border rounded-md hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          @click="changePage(page - 1)"
        >
          {{ $t('common.prev') }}
        </button>

        <span class="text-sm font-medium">
          {{ page }} / {{ meta.totalPages }}
        </span>

        <button
          :disabled="page === meta.totalPages"
          class="px-4 py-2 text-sm font-medium border rounded-md hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          @click="changePage(page + 1)"
        >
          {{ $t('common.next') }}
        </button>
      </div>
    </div>
  </div>
</template>
