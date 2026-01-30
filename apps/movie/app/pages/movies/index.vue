<script setup lang="ts">
import type { Movie } from '@starye/db/schema'
import type { ApiMeta } from '../../lib/api'
import { MovieCard } from '@starye/ui'
import { useApi } from '../../lib/api'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()

// Query parameters
const page = computed(() => Number(route.query.page) || 1)
const genre = computed(() => route.query.genre as string || '')
const actor = computed(() => route.query.actor as string || '')

// Fetch movies
const { data: response, pending, error } = useApi<Movie[]>('/movies', {
  query: {
    page,
    limit: 24,
    genre,
    actor,
  },
  server: false,
  lazy: true,
  watch: [page, genre, actor],
})

const movies = computed(() => response.value?.data || [])
const meta = computed(() => response.value?.meta as ApiMeta | undefined)

// Pagination
function goToPage(newPage: number) {
  router.push({
    query: {
      ...route.query,
      page: newPage,
    },
  })
}

// Clear filters
function clearFilters() {
  router.push({ query: {} })
}
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950">
    <div class="container mx-auto px-4 py-12">
      <!-- Header -->
      <div class="mb-12">
        <h1 class="text-5xl font-black text-white mb-4">
          {{ t('movie.movies') }}
        </h1>
        <p class="text-xl text-slate-300">
          {{ t('movie.subtitle') }}
        </p>
      </div>

      <!-- Filters -->
      <div v-if="genre || actor" class="mb-8 flex items-center gap-3 flex-wrap">
        <span class="text-sm text-slate-400">{{ t('movie.filter_by_genre') }}:</span>
        <div v-if="genre" class="px-4 py-2 bg-purple-500/20 text-purple-300 rounded-lg border border-purple-500/30 text-sm flex items-center gap-2">
          {{ genre }}
          <button class="hover:text-white" @click="router.push({ query: { ...route.query, genre: undefined } })">
            ✕
          </button>
        </div>
        <div v-if="actor" class="px-4 py-2 bg-pink-500/20 text-pink-300 rounded-lg border border-pink-500/30 text-sm flex items-center gap-2">
          {{ actor }}
          <button class="hover:text-white" @click="router.push({ query: { ...route.query, actor: undefined } })">
            ✕
          </button>
        </div>
        <button
          class="px-4 py-2 bg-white/5 text-slate-300 hover:bg-white/10 rounded-lg border border-white/10 text-sm transition-colors"
          @click="clearFilters"
        >
          {{ t('movie.clear_filters') }}
        </button>
      </div>

      <!-- Loading State -->
      <div v-if="pending" class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
        <div v-for="i in 24" :key="i" class="aspect-[2/3] bg-white/5 rounded-xl animate-pulse" />
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="p-8 bg-red-500/10 text-red-400 rounded-2xl border border-red-500/20">
        <p class="font-bold text-lg mb-2">
          {{ t('common.error') }}
        </p>
        <p class="text-sm opacity-80">
          {{ error.message }}
        </p>
      </div>

      <!-- Movies Grid -->
      <div v-else-if="movies.length > 0" class="space-y-8">
        <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
          <MovieCard
            v-for="movie in movies"
            :key="movie.slug"
            :title="movie.title"
            :code="movie.code"
            :cover="movie.coverImage"
            :release-date="movie.releaseDate"
            :is-r18="movie.isR18"
            :actors="movie.actors"
            :genres="movie.genres"
            :href="`/movies/${movie.slug}`"
            :label-adult-only="t('movie.adult_only')"
          />
        </div>

        <!-- Pagination -->
        <div v-if="meta && meta.totalPages > 1" class="flex items-center justify-center gap-2">
          <button
            :disabled="page <= 1"
            class="px-4 py-2 bg-white/5 text-white rounded-lg border border-white/10 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            @click="goToPage(page - 1)"
          >
            {{ t('movie.prev_page') }}
          </button>

          <div class="flex items-center gap-2">
            <template v-for="p in meta.totalPages" :key="p">
              <button
                v-if="Math.abs(p - page) <= 2 || p === 1 || p === meta.totalPages"
                class="px-4 py-2 rounded-lg border transition-colors" :class="[
                  p === page
                    ? 'bg-purple-500 text-white border-purple-500'
                    : 'bg-white/5 text-white border-white/10 hover:bg-white/10',
                ]"
                @click="goToPage(p)"
              >
                {{ p }}
              </button>
              <span v-else-if="Math.abs(p - page) === 3" class="text-slate-500">...</span>
            </template>
          </div>

          <button
            :disabled="page >= meta.totalPages"
            class="px-4 py-2 bg-white/5 text-white rounded-lg border border-white/10 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            @click="goToPage(page + 1)"
          >
            {{ t('movie.next_page') }}
          </button>
        </div>

        <!-- Meta Info -->
        <div v-if="meta" class="text-center text-sm text-slate-400">
          {{ t('movie.total_items', { total: meta.total }) }} - {{ t('movie.page_info', { page: meta.page, total: meta.totalPages }) }}
        </div>
      </div>

      <!-- Empty State -->
      <div v-else class="text-center py-20">
        <div class="text-6xl mb-4">
          🎬
        </div>
        <h3 class="text-2xl font-bold text-white mb-2">
          {{ t('movie.no_movies') }}
        </h3>
      </div>
    </div>
  </div>
</template>
