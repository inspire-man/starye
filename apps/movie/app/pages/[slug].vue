<script setup lang="ts">
import type { Movie, Player } from '@starye/db/schema'
import { useApi } from '../lib/api'

const route = useRoute()
const slug = route.params.slug as string

const { data: response, pending, error } = useApi<Movie & { players: Player[] }>(`/api/movies/${slug}`)

const movie = computed(() => response.value?.data)

function formatDate(dateStr: any) {
  if (!dateStr)
    return '-'
  return new Date(dateStr).toLocaleDateString()
}
</script>

<template>
  <div class="container mx-auto py-12 px-4 max-w-6xl">
    <div v-if="pending" class="space-y-8 animate-pulse">
      <div class="aspect-video bg-muted rounded-2xl w-full max-w-3xl mx-auto" />
      <div class="h-8 bg-muted rounded w-1/3" />
      <div class="h-24 bg-muted rounded w-full" />
    </div>

    <div v-else-if="error || !movie" class="p-12 text-center border border-dashed rounded-3xl">
      <h2 class="text-2xl font-bold text-muted-foreground">
        {{ $t('common.error') }}
      </h2>
      <p class="mt-2 text-sm text-muted-foreground opacity-70">
        {{ error?.message || 'Movie not found' }}
      </p>
      <NuxtLink to="/" class="mt-6 inline-block text-primary font-bold hover:underline">
        Back to Library
      </NuxtLink>
    </div>

    <div v-else class="grid grid-cols-1 lg:grid-cols-12 gap-12">
      <!-- Left: Cover & Info Area -->
      <div class="lg:col-span-8 space-y-8">
        <div class="relative aspect-video rounded-3xl overflow-hidden shadow-2xl border border-border/40 bg-black flex items-center justify-center">
          <img
            v-if="movie.coverImage"
            :src="movie.coverImage"
            :alt="movie.title"
            class="w-full h-full object-contain"
          >
          <div v-else class="flex flex-col items-center justify-center text-center p-8">
            <div class="w-16 h-16 bg-destructive/10 text-destructive rounded-full flex items-center justify-center text-2xl mb-4">
              🔞
            </div>
            <p class="font-bold text-xl mb-2">
              {{ $t('movie.adult_only') }}
            </p>
            <p class="text-sm text-muted-foreground max-w-xs mx-auto">
              Age verification required. Please login to view sensitive content.
            </p>
            <NuxtLink to="/login" class="mt-6 px-6 py-2 bg-primary text-primary-foreground rounded-full text-sm font-bold">
              Login to Verify
            </NuxtLink>
          </div>
        </div>

        <div class="space-y-4">
          <h1 class="text-2xl md:text-3xl font-extrabold leading-tight">
            <span class="text-primary mr-2">[{{ movie.code }}]</span>
            {{ movie.title }}
          </h1>

          <div class="flex flex-wrap gap-2">
            <span
              v-for="genre in movie.genres"
              :key="genre"
              class="px-3 py-1 bg-secondary text-secondary-foreground rounded-full text-[11px] font-bold uppercase tracking-wider"
            >
              {{ genre }}
            </span>
          </div>
        </div>

        <section class="space-y-4">
          <h2 class="text-xl font-bold flex items-center gap-2">
            {{ $t('movie.player') }}
          </h2>
          <div class="grid gap-3">
            <a
              v-for="player in movie.players"
              :key="player.id"
              :href="player.sourceUrl"
              class="flex items-center justify-between p-4 bg-muted/30 hover:bg-muted/60 border border-border/40 rounded-xl transition-all group"
            >
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <svg v-if="player.sourceUrl.startsWith('magnet')" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" x2="12" y1="15" y2="3" /></svg>
                  <svg v-else xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                </div>
                <div>
                  <p class="font-bold text-sm">{{ player.sourceName }}</p>
                  <p class="text-[10px] text-muted-foreground uppercase font-mono">{{ player.quality }}</p>
                </div>
              </div>
              <span class="text-xs font-bold text-primary group-hover:translate-x-1 transition-transform">
                {{ player.sourceUrl.startsWith('magnet') ? 'DOWNLOAD' : 'WATCH' }} →
              </span>
            </a>
          </div>
        </section>
      </div>

      <!-- Right: Meta Area -->
      <div class="lg:col-span-4 space-y-8">
        <div class="p-8 bg-muted/20 border border-border/40 rounded-3xl space-y-8">
          <div v-if="movie.publisher" class="space-y-1.5">
            <p class="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
              {{ $t('movie.publisher') }}
            </p>
            <p class="font-extrabold text-sm">
              {{ movie.publisher }}
            </p>
          </div>

          <div v-if="movie.releaseDate" class="space-y-1.5">
            <p class="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
              {{ $t('movie.release_date') }}
            </p>
            <p class="font-extrabold text-sm">
              {{ formatDate(movie.releaseDate) }}
            </p>
          </div>

          <div v-if="movie.duration" class="space-y-1.5">
            <p class="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
              {{ $t('movie.duration') }}
            </p>
            <p class="font-extrabold text-sm">
              {{ movie.duration }} {{ $t('movie.minutes') }}
            </p>
          </div>

          <div v-if="movie.series" class="space-y-1.5">
            <p class="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
              {{ $t('movie.series') }}
            </p>
            <p class="font-extrabold text-sm">
              {{ movie.series }}
            </p>
          </div>

          <div v-if="movie.actors && movie.actors.length" class="space-y-3">
            <p class="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
              {{ $t('movie.actors') }}
            </p>
            <div class="flex flex-wrap gap-2">
              <span v-for="actor in movie.actors" :key="actor" class="text-xs font-bold text-primary bg-primary/5 px-2 py-1 rounded hover:bg-primary/10 cursor-pointer transition-colors">
                {{ actor }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
