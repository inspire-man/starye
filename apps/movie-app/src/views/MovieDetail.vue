<script setup lang="ts">
import type { MovieDetail } from '../types'
import { onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { movieApi } from '../api'

const route = useRoute()
const loading = ref(true)
const error = ref('')
const movie = ref<MovieDetail | null>(null)

function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString('zh-CN')
}

async function fetchMovieDetail() {
  loading.value = true
  error.value = ''

  try {
    const code = route.params.code as string
    const response = await movieApi.getMovieDetail(code)

    if (response.success && response.data) {
      movie.value = response.data
    }
    else {
      error.value = response.error || '加载失败'
    }
  }
  catch (err: any) {
    error.value = err.response?.data?.error || '加载影片详情失败'
  }
  finally {
    loading.value = false
  }
}

// 监听路由变化，自动刷新影片详情
watch(() => route.params.code, (newCode, oldCode) => {
  if (newCode && newCode !== oldCode) {
    fetchMovieDetail()
  }
})

onMounted(() => {
  fetchMovieDetail()
})
</script>

<template>
  <div v-if="loading" class="animate-pulse">
    <div class="bg-gray-800 h-64 rounded-lg mb-4" />
    <div class="bg-gray-800 h-8 rounded w-1/2 mb-2" />
    <div class="bg-gray-800 h-4 rounded w-1/3" />
  </div>

  <div v-else-if="error" class="text-center py-12">
    <p class="text-red-500 mb-4">
      {{ error }}
    </p>
    <RouterLink to="/" class="text-primary-400 hover:underline">
      返回首页
    </RouterLink>
  </div>

  <div v-else-if="movie" class="space-y-6">
    <div class="bg-gray-800 rounded-lg shadow-lg p-6">
      <div class="flex flex-col md:flex-row gap-6">
        <div class="flex-shrink-0">
          <img
            v-if="movie.coverImage"
            :src="movie.coverImage"
            :alt="movie.title"
            class="w-48 h-64 object-cover rounded-lg shadow-md"
          >
          <div v-else class="w-48 h-64 bg-gray-700 rounded-lg flex items-center justify-center">
            <span class="text-gray-500">暂无封面</span>
          </div>
        </div>

        <div class="flex-1">
          <div class="flex items-start justify-between mb-4">
            <div>
              <h1 class="text-3xl font-bold text-white mb-3">
                {{ movie.title }}
              </h1>
              <div class="flex flex-wrap items-center gap-2">
                <span class="bg-gray-700/80 text-primary-400 font-mono text-sm px-3 py-1.5 rounded-md border border-gray-600">
                  {{ movie.code }}
                </span>
                <RouterLink
                  v-if="movie.series"
                  :to="`/series/${encodeURIComponent(movie.series)}`"
                  class="bg-purple-600/20 border border-purple-500/30 text-purple-300 hover:bg-purple-600/30 px-3 py-1.5 rounded-md text-sm font-medium transition-colors duration-200"
                >
                  <span class="mr-1">📂</span>
                  {{ movie.series }}
                </RouterLink>
              </div>
            </div>
            <span
              v-if="movie.isR18"
              class="bg-red-600 text-white text-sm px-3 py-1 rounded"
            >
              R18
            </span>
          </div>

          <div class="space-y-3">
            <div v-if="movie.releaseDate" class="flex items-center text-sm">
              <span class="text-gray-300 w-24 font-medium">发行日期：</span>
              <span class="text-white">{{ formatDate(movie.releaseDate) }}</span>
            </div>

            <div v-if="movie.duration" class="flex items-center text-sm">
              <span class="text-gray-300 w-24 font-medium">时长：</span>
              <span class="text-white">{{ Math.floor(movie.duration / 60) }} 分钟</span>
            </div>

            <div v-if="movie.actors && movie.actors.length > 0" class="flex items-start text-sm">
              <span class="text-gray-300 w-24 flex-shrink-0 font-medium">演员：</span>
              <div class="flex flex-wrap gap-2">
                <RouterLink
                  v-for="actor in movie.actors"
                  :key="actor.id || actor.slug"
                  :to="`/actors/${actor.slug}`"
                  class="bg-primary-600 hover:bg-primary-500 text-white px-3 py-1 rounded-full text-xs font-medium transition-colors duration-200"
                >
                  {{ actor.name }}
                </RouterLink>
              </div>
            </div>

            <div v-if="movie.genres && movie.genres.length > 0" class="flex items-start text-sm">
              <span class="text-gray-300 w-24 flex-shrink-0 font-medium">标签：</span>
              <div class="flex flex-wrap gap-2">
                <span
                  v-for="genre in movie.genres"
                  :key="genre"
                  class="bg-purple-600/20 border border-purple-500/30 text-purple-300 px-2 py-1 rounded text-xs"
                >
                  {{ genre }}
                </span>
              </div>
            </div>

            <div v-if="movie.publishers && movie.publishers.length > 0" class="flex items-start text-sm">
              <span class="text-gray-300 w-24 flex-shrink-0 font-medium">制作商：</span>
              <div class="flex flex-wrap gap-2">
                <RouterLink
                  v-for="publisher in movie.publishers"
                  :key="publisher.id || publisher.slug"
                  :to="`/publishers/${publisher.slug}`"
                  class="bg-green-600 hover:bg-green-500 text-white px-3 py-1 rounded-full text-xs font-medium transition-colors duration-200"
                >
                  {{ publisher.name }}
                </RouterLink>
              </div>
            </div>

            <div v-if="movie.description" class="flex items-start text-sm pt-2">
              <span class="text-gray-300 w-24 flex-shrink-0 font-medium">简介：</span>
              <p class="text-gray-200 flex-1 leading-relaxed">
                {{ movie.description }}
              </p>
            </div>
          </div>

          <div class="mt-6">
            <RouterLink
              :to="`/movie/${movie.code}/play`"
              class="inline-block bg-primary-600 hover:bg-primary-700 text-white px-8 py-3 rounded-md font-medium transition"
            >
              立即播放
            </RouterLink>
          </div>
        </div>
      </div>
    </div>

    <div v-if="movie.players && movie.players.length > 0" class="bg-gray-800 rounded-lg shadow-lg p-6">
      <h2 class="text-xl font-bold text-white mb-4">
        播放源
      </h2>
      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        <RouterLink
          v-for="player in movie.players"
          :key="player.id"
          :to="`/movie/${movie.code}/play?player=${player.id}`"
          class="border border-gray-700 hover:border-primary-500 hover:bg-gray-700 rounded-md p-3 transition"
        >
          <p class="text-white font-medium">
            {{ player.sourceName }}
          </p>
          <p v-if="player.quality" class="text-sm text-gray-400">
            {{ player.quality }}
          </p>
        </RouterLink>
      </div>
    </div>

    <div v-if="movie.relatedMovies && movie.relatedMovies.length > 0" class="bg-gray-800 rounded-lg shadow-lg p-6">
      <h2 class="text-xl font-bold text-white mb-4">
        相关影片
      </h2>
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <RouterLink
          v-for="related in movie.relatedMovies"
          :key="related.id"
          :to="`/movie/${related.code}`"
          class="group cursor-pointer"
        >
          <div class="relative overflow-hidden rounded-lg shadow-md group-hover:shadow-xl transition-shadow duration-300">
            <div class="aspect-[3/4] bg-gray-700">
              <img
                v-if="related.coverImage"
                :src="related.coverImage"
                :alt="related.title"
                class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                loading="lazy"
              >
            </div>
          </div>
          <p class="mt-2 text-sm text-white line-clamp-2 group-hover:text-primary-400 transition">
            {{ related.title }}
          </p>
        </RouterLink>
      </div>
    </div>
  </div>
</template>
