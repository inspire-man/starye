<script setup lang="ts">
import type { Movie } from '@starye/db/schema'
import { MovieCard } from '@starye/ui'
import { useAuth } from '../composables/useAuth'
import { useApi } from '../lib/api'

interface HomeData {
  latestMovies: Movie[]
  topActors: Array<{ name: string, slug: string, avatar: string | null, count: number }>
}

const { isAdult } = useAuth()
const { t } = useI18n()

const { data: response, pending, error } = useApi<HomeData>('/movies/home/featured', {
  server: false,
  lazy: true,
})

const latestMovies = computed(() => response.value?.data?.latestMovies || [])
const topActors = computed(() => response.value?.data?.topActors || [])
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950">
    <!-- Hero Section -->
    <section class="relative overflow-hidden border-b border-white/5">
      <div class="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-900/20 via-transparent to-transparent" />
      <div class="container mx-auto px-4 py-20 relative">
        <div class="max-w-3xl">
          <h1 class="text-6xl font-black tracking-tight text-white mb-6 leading-tight">
            {{ t('movie.title') }}<br>
            <span class="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              {{ t('movie.subtitle') }}
            </span>
          </h1>
        </div>
      </div>
    </section>

    <div class="container mx-auto px-4 py-16">
      <!-- Loading State -->
      <div v-if="pending" class="space-y-16">
        <div class="space-y-6">
          <div class="h-8 w-48 bg-white/5 rounded-lg animate-pulse" />
          <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
            <div v-for="i in 12" :key="i" class="aspect-[2/3] bg-white/5 rounded-xl animate-pulse" />
          </div>
        </div>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="p-8 bg-red-500/10 text-red-400 rounded-2xl border border-red-500/20 backdrop-blur-sm">
        <p class="font-bold text-lg mb-2">
          {{ t('common.error') }}
        </p>
        <p class="text-sm opacity-80">
          {{ error.message }}
        </p>
      </div>

      <!-- Content -->
      <div v-else class="space-y-16">
        <!-- Latest Movies Section -->
        <section>
          <div class="flex items-center justify-between mb-8">
            <h2 class="text-3xl font-bold text-white">
              🔥 {{ t('movie.hot_movies') }}
            </h2>
            <NuxtLink
              to="/movies"
              class="text-sm font-medium text-purple-400 hover:text-purple-300 transition-colors flex items-center gap-2"
            >
              {{ t('movie.view_all') }}
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6" /></svg>
            </NuxtLink>
          </div>

          <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
            <MovieCard
              v-for="movie in latestMovies"
              :key="movie.slug"
              :title="movie.title"
              :code="movie.code"
              :cover="movie.coverImage"
              :release-date="movie.releaseDate"
              :is-r18="movie.isR18"
              :actors="(movie.actors as string[] | null)"
              :genres="(movie.genres as string[] | null)"
              :href="`/movies/${movie.slug}`"
              :label-adult-only="t('movie.adult_only')"
            />
          </div>
        </section>

        <!-- Top Actors Section -->
        <section v-if="isAdult && topActors.length > 0">
          <div class="flex items-center justify-between mb-8">
            <h2 class="text-3xl font-bold text-white">
              ⭐ {{ t('movie.top_actors') }}
            </h2>
            <NuxtLink
              to="/actors"
              class="text-sm font-medium text-purple-400 hover:text-purple-300 transition-colors flex items-center gap-2"
            >
              {{ t('movie.view_all') }}
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6" /></svg>
            </NuxtLink>
          </div>

          <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <NuxtLink
              v-for="(actor, index) in topActors"
              :key="actor.slug"
              :to="`/actors/${actor.slug}`"
              class="group relative p-6 rounded-xl bg-white/5 border border-white/10 hover:border-purple-500/50 hover:bg-white/10 transition-all duration-300"
            >
              <!-- Rank Badge -->
              <div class="absolute top-3 right-3 w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-sm">
                {{ index + 1 }}
              </div>

              <div class="space-y-3">
                <div v-if="actor.avatar" class="w-16 h-16 rounded-full overflow-hidden shadow-lg">
                  <img :src="actor.avatar" :alt="actor.name" class="w-full h-full object-cover">
                </div>
                <div v-else class="w-16 h-16 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white text-2xl font-bold">
                  {{ actor.name.charAt(0) }}
                </div>
                <div>
                  <h3 class="font-bold text-white group-hover:text-purple-400 transition-colors">
                    {{ actor.name }}
                  </h3>
                  <p class="text-sm text-slate-400 mt-1">
                    {{ actor.count }} {{ t('movie.works_count') }}
                  </p>
                </div>
              </div>
            </NuxtLink>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>
