<script setup lang="ts">
import type { ApiMeta } from '../../lib/api'
import { useApi } from '../../lib/api'

definePageMeta({
  middleware: 'adult',
})

const route = useRoute()
const router = useRouter()
const { t } = useI18n()

const page = computed(() => Number(route.query.page) || 1)

interface Publisher {
  id: string
  name: string
  slug: string
  logo?: string | null
  movieCount: number
}

const { data: response, pending, error } = useApi<Publisher[]>('/movies/publishers/list', {
  query: {
    page,
    limit: 50,
  },
  server: false,
  lazy: true,
  watch: [page],
})

const publishers = computed(() => response.value?.data || [])
const meta = computed(() => response.value?.meta as ApiMeta | undefined)

function goToPage(newPage: number) {
  router.push({
    query: { page: newPage },
  })
}

function goToPublisher(publisherSlug: string) {
  router.push(`/publishers/${publisherSlug}`)
}
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950">
    <div class="container mx-auto px-4 py-12">
      <!-- Header -->
      <div class="mb-12">
        <h1 class="text-5xl font-black text-white mb-4">
          🏢 {{ t('movie.publisher_list') }}
        </h1>
        <p class="text-xl text-slate-300">
          {{ t('movie.subtitle') }}
        </p>
      </div>

      <!-- Loading State -->
      <div v-if="pending" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <div v-for="i in 50" :key="i" class="h-24 bg-white/5 rounded-xl animate-pulse" />
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

      <!-- Publishers Grid -->
      <div v-else-if="publishers.length > 0" class="space-y-8">
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <button
            v-for="(publisher, index) in publishers"
            :key="publisher.id"
            class="group relative p-6 rounded-xl bg-white/5 border border-white/10 hover:border-purple-500/50 hover:bg-white/10 transition-all duration-300 text-left"
            @click="goToPublisher(publisher.slug)"
          >
            <!-- Rank Badge (for top 10) -->
            <div v-if="page === 1 && index < 10" class="absolute top-3 right-3 w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white font-bold text-sm shadow-lg">
              {{ index + 1 }}
            </div>

            <div class="flex items-center gap-4">
              <!-- Icon/Logo -->
              <div v-if="publisher.logo" class="w-14 h-14 rounded-lg overflow-hidden shadow-lg flex-shrink-0">
                <img :src="publisher.logo" :alt="publisher.name" class="w-full h-full object-cover">
              </div>
              <div v-else class="w-14 h-14 rounded-lg bg-gradient-to-br from-blue-400 to-cyan-400 flex items-center justify-center text-white text-xl font-bold shadow-lg flex-shrink-0">
                {{ publisher.name.charAt(0) }}
              </div>

              <!-- Info -->
              <div class="flex-1 min-w-0">
                <h3 class="font-bold text-white group-hover:text-purple-400 transition-colors line-clamp-1">
                  {{ publisher.name }}
                </h3>
                <p class="text-sm text-slate-400 mt-1">
                  {{ publisher.movieCount }} {{ t('movie.works_count') }}
                </p>
              </div>

              <!-- Hover Arrow -->
              <div class="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-purple-400"><path d="m9 18 6-6-6-6" /></svg>
              </div>
            </div>
          </button>
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
          🏢
        </div>
        <h3 class="text-2xl font-bold text-white mb-2">
          {{ t('movie.no_publishers') }}
        </h3>
      </div>
    </div>
  </div>
</template>
