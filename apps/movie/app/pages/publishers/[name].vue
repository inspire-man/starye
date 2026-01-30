<script setup lang="ts">
import type { Movie } from '@starye/db/schema'
import type { ApiMeta } from '../../lib/api'
import { MovieCard } from '@starye/ui'
import { useApi } from '../../lib/api'

definePageMeta({
  middleware: 'adult',
})

const route = useRoute()
const router = useRouter()
const { t } = useI18n()

const publisherSlug = computed(() => route.params.name as string)
const page = computed(() => Number(route.query.page) || 1)

interface PublisherData {
  id: string
  name: string
  slug: string
  logo?: string | null
  website?: string | null
  description?: string | null
  foundedYear?: number | null
  country?: string | null
  movieCount: number
  movies: Movie[]
}

const { data: response, pending, error } = useApi<PublisherData>(`/movies/publishers/${publisherSlug.value}`, {
  query: {
    page,
    limit: 24,
  },
  server: false,
  lazy: true,
  watch: [page],
})

const publisherData = computed(() => response.value?.data)
const movies = computed(() => publisherData.value?.movies || [])
const meta = computed(() => response.value?.meta as ApiMeta | undefined)

function goToPage(newPage: number) {
  router.push({
    query: { page: newPage },
  })
}
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950">
    <div class="container mx-auto px-4 py-12">
      <!-- Back Button -->
      <button class="mb-8 flex items-center gap-2 text-slate-400 hover:text-white transition-colors" @click="router.back()">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6" /></svg>
        {{ t('movie.back') }}
      </button>

      <!-- Loading State -->
      <div v-if="pending" class="space-y-8">
        <div class="h-32 bg-white/5 rounded-2xl animate-pulse" />
        <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
          <div v-for="i in 24" :key="i" class="aspect-[2/3] bg-white/5 rounded-xl animate-pulse" />
        </div>
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

      <!-- Content -->
      <div v-else-if="publisherData" class="space-y-8">
        <!-- Publisher Header -->
        <div class="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border border-blue-500/30 p-8 md:p-12">
          <div class="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-500/20 via-transparent to-transparent" />

          <div class="relative flex flex-col md:flex-row items-center md:items-start gap-6">
            <!-- Icon -->
            <div class="w-32 h-32 rounded-2xl bg-gradient-to-br from-blue-400 to-cyan-400 flex items-center justify-center text-white text-5xl font-bold shadow-2xl">
              {{ publisherData.name.charAt(0) }}
            </div>

            <!-- Info -->
            <div class="flex-1 text-center md:text-left">
              <h1 class="text-4xl md:text-5xl font-black text-white mb-3">
                {{ publisherData.name }}
              </h1>
              <div class="flex flex-wrap items-center justify-center md:justify-start gap-4 text-slate-300">
                <div class="flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="7" height="7" x="3" y="3" rx="1" /><rect width="7" height="7" x="14" y="3" rx="1" /><rect width="7" height="7" x="14" y="14" rx="1" /><rect width="7" height="7" x="3" y="14" rx="1" /></svg>
                  <span class="font-bold">{{ publisherData.movieCount }} {{ t('movie.works_count') }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Movies Section -->
        <div>
          <h2 class="text-2xl font-bold text-white mb-6">
            📽️ {{ t('movie.works') }}
          </h2>

          <div v-if="movies.length > 0" class="space-y-8">
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
    </div>
  </div>
</template>
