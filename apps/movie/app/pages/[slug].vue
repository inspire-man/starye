<script setup lang="ts">
import type { Movie, Player } from '@starye/db/schema'
import { useAuth } from '../composables/useAuth'
import { useApi } from '../lib/api'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const { isAdult } = useAuth()

const slug = route.params.slug as string

const { data: response, pending, error } = useApi<Movie & { players: Player[] }>(`/movies/${slug}`, {
  server: false,
  lazy: true,
})

const movie = computed(() => response.value?.data)

function formatDate(dateStr: any) {
  if (!dateStr)
    return '-'
  return new Date(dateStr).toLocaleDateString()
}

function goToActor(actorName: string) {
  router.push(`/actors/${encodeURIComponent(actorName)}`)
}

function goToPublisher(publisherName: string) {
  router.push(`/publishers/${encodeURIComponent(publisherName)}`)
}
</script>

<template>
  <div class="min-h-screen bg-linear-to-br from-slate-950 via-purple-950 to-slate-950">
    <!-- Loading State -->
    <div v-if="pending" class="container mx-auto px-4 py-12 max-w-7xl">
      <div class="space-y-8 animate-pulse">
        <div class="aspect-video bg-white/5 rounded-2xl w-full" />
        <div class="h-12 bg-white/5 rounded w-2/3" />
        <div class="h-32 bg-white/5 rounded w-full" />
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="error || !movie" class="container mx-auto px-4 py-20 text-center">
      <div class="max-w-md mx-auto p-12 bg-red-500/10 border border-red-500/20 rounded-2xl">
        <div class="text-6xl mb-4">
          😢
        </div>
        <h2 class="text-2xl font-bold text-white mb-2">
          影片未找到
        </h2>
        <p class="text-slate-400 mb-6">
          {{ error?.message || '该影片不存在或已被删除' }}
        </p>
        <NuxtLink to="/" class="inline-block px-6 py-3 bg-purple-500 hover:bg-purple-600 text-white font-bold rounded-lg transition-colors">
          返回首页
        </NuxtLink>
      </div>
    </div>

    <!-- Content -->
    <div v-else class="container mx-auto px-4 py-12 max-w-7xl">
      <!-- Back Button -->
      <button class="mb-8 flex items-center gap-2 text-slate-400 hover:text-white transition-colors" @click="router.back()">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6" /></svg>
        返回
      </button>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <!-- Left: Cover Image -->
        <div class="lg:col-span-1">
          <div class="sticky top-8">
            <div class="relative aspect-[2/3] rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-black">
              <img
                v-if="movie.coverImage"
                :src="movie.coverImage"
                :alt="movie.title"
                class="w-full h-full object-cover"
              >
              <div v-else class="flex flex-col items-center justify-center h-full text-center p-8">
                <div class="w-20 h-20 bg-red-500/20 text-red-400 rounded-full flex items-center justify-center text-3xl mb-4">
                  🔞
                </div>
                <p class="font-bold text-xl text-white mb-2">
                  成人内容
                </p>
                <p class="text-sm text-slate-400">
                  需要年龄验证才能查看
                </p>
              </div>

              <!-- Code Badge -->
              <div class="absolute top-4 left-4">
                <span class="px-3 py-1.5 bg-black/70 text-white text-xs font-bold rounded-lg backdrop-blur-sm uppercase tracking-wider">
                  {{ movie.code }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Right: Details -->
        <div class="lg:col-span-2 space-y-8">
          <!-- Title & Meta -->
          <div class="space-y-4">
            <h1 class="text-4xl md:text-5xl font-black text-white leading-tight">
              {{ movie.title }}
            </h1>

            <!-- Genres -->
            <div v-if="movie.genres && movie.genres.length" class="flex flex-wrap gap-2">
              <NuxtLink
                v-for="genre in movie.genres"
                :key="genre"
                :to="`/movies?genre=${encodeURIComponent(genre)}`"
                class="px-3 py-1.5 bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 border border-purple-500/30 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors"
              >
                {{ genre }}
              </NuxtLink>
            </div>

            <!-- Meta Info Grid -->
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
              <div v-if="movie.releaseDate" class="p-4 bg-white/5 border border-white/10 rounded-xl">
                <p class="text-xs text-slate-400 mb-1">
                  发布日期
                </p>
                <p class="font-bold text-white">
                  {{ formatDate(movie.releaseDate) }}
                </p>
              </div>

              <div v-if="movie.duration" class="p-4 bg-white/5 border border-white/10 rounded-xl">
                <p class="text-xs text-slate-400 mb-1">
                  时长
                </p>
                <p class="font-bold text-white">
                  {{ movie.duration }} 分钟
                </p>
              </div>

              <div v-if="movie.publisher" class="p-4 bg-white/5 border border-white/10 rounded-xl cursor-pointer hover:bg-white/10 transition-colors" @click="goToPublisher(movie.publisher)">
                <p class="text-xs text-slate-400 mb-1">
                  片商
                </p>
                <p class="font-bold text-purple-400 hover:text-purple-300">
                  {{ movie.publisher }}
                </p>
              </div>

              <div v-if="movie.series" class="p-4 bg-white/5 border border-white/10 rounded-xl">
                <p class="text-xs text-slate-400 mb-1">
                  系列
                </p>
                <p class="font-bold text-white">
                  {{ movie.series }}
                </p>
              </div>
            </div>
          </div>

          <!-- Description -->
          <div v-if="movie.description" class="p-6 bg-white/5 border border-white/10 rounded-xl">
            <h2 class="text-lg font-bold text-white mb-3">
              📝 简介
            </h2>
            <p class="text-slate-300 leading-relaxed">
              {{ movie.description }}
            </p>
          </div>

          <!-- Actors -->
          <div v-if="movie.actors && movie.actors.length" class="p-6 bg-white/5 border border-white/10 rounded-xl">
            <h2 class="text-lg font-bold text-white mb-4">
              ⭐ 出演女优
            </h2>
            <div class="flex flex-wrap gap-3">
              <button
                v-for="actor in movie.actors"
                :key="actor"
                class="px-4 py-2 bg-gradient-to-r from-purple-500/20 to-pink-500/20 hover:from-purple-500/30 hover:to-pink-500/30 text-white border border-purple-500/30 rounded-lg font-bold text-sm transition-all hover:scale-105"
                @click="goToActor(actor)"
              >
                {{ actor }}
              </button>
            </div>
          </div>

          <!-- Players -->
          <div v-if="movie.players && movie.players.length" class="p-6 bg-white/5 border border-white/10 rounded-xl">
            <h2 class="text-lg font-bold text-white mb-4">
              🎬 播放源
            </h2>
            <div class="grid gap-3">
              <a
                v-for="player in movie.players"
                :key="player.id"
                :href="player.sourceUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="flex items-center justify-between p-4 bg-white/5 hover:bg-purple-500/20 border border-white/10 hover:border-purple-500/50 rounded-xl transition-all group"
              >
                <div class="flex items-center gap-4">
                  <div class="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white">
                    <svg v-if="player.sourceUrl.startsWith('magnet')" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" x2="12" y1="15" y2="3" /></svg>
                    <svg v-else xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                  </div>
                  <div>
                    <p class="font-bold text-white">{{ player.sourceName }}</p>
                    <p class="text-xs text-slate-400 uppercase font-mono mt-0.5">{{ player.quality || 'HD' }}</p>
                  </div>
                </div>
                <div class="flex items-center gap-2 text-purple-400 group-hover:text-purple-300 font-bold text-sm">
                  {{ player.sourceUrl.startsWith('magnet') ? '下载' : '播放' }}
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="group-hover:translate-x-1 transition-transform"><path d="m9 18 6-6-6-6" /></svg>
                </div>
              </a>
            </div>
          </div>

          <!-- Source Link -->
          <div v-if="movie.sourceUrl" class="text-center">
            <a
              :href="movie.sourceUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-slate-300 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" x2="21" y1="14" y2="3" /></svg>
              查看原始来源
            </a>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
