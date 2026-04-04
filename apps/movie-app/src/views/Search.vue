<script setup lang="ts">
import type { SearchResult } from '../lib/api-client'
import { ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { searchApi } from '../lib/api-client'

const route = useRoute()
const router = useRouter()

const keyword = ref((route.query.q as string) || '')
const loading = ref(false)
const searched = ref(false)
const searchResult = ref<SearchResult | null>(null)

// URL 与关键词双向绑定
watch(keyword, (val) => {
  router.replace({ query: val ? { q: val } : {} })
})

// 从 URL 初始化后立即搜索
if (keyword.value) {
  doSearch()
}

// 监听路由 query 变化（如浏览器前进/后退）
watch(() => route.query.q, (val) => {
  const q = (val as string) || ''
  if (q !== keyword.value) {
    keyword.value = q
    if (q)
      doSearch()
  }
})

async function doSearch() {
  const q = keyword.value.trim()
  if (!q)
    return
  loading.value = true
  searched.value = true
  try {
    searchResult.value = await searchApi.search(q, { limit: 10 })
  }
  catch (err) {
    console.error('搜索失败:', err)
    searchResult.value = null
  }
  finally {
    loading.value = false
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter')
    doSearch()
}

function hasResults() {
  const r = searchResult.value?.results
  return r && (
    (r.movies && r.movies.length > 0)
    || (r.actors && r.actors.length > 0)
    || (r.publishers && r.publishers.length > 0)
  )
}
</script>

<template>
  <div class="max-w-4xl mx-auto">
    <h1 class="text-3xl font-bold text-white mb-6">
      搜索
    </h1>

    <!-- 搜索框 -->
    <div class="bg-gray-800 rounded-lg p-4 mb-8 flex gap-3">
      <input
        v-model="keyword"
        type="text"
        placeholder="输入番号、影片标题、演员名或厂商名..."
        class="flex-1 px-4 py-3 bg-gray-900 border border-gray-700 rounded-md text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-base"
        @keydown="handleKeydown"
      >
      <button
        class="bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-md font-medium transition-colors"
        :disabled="loading"
        @click="doSearch"
      >
        <span v-if="loading">搜索中...</span>
        <span v-else>搜索</span>
      </button>
    </div>

    <!-- 加载中 -->
    <div v-if="loading" class="text-center py-16 text-gray-400">
      <div class="inline-block w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mb-3" />
      <p>正在搜索...</p>
    </div>

    <!-- 无结果 -->
    <div v-else-if="searched && !hasResults()" class="text-center py-16">
      <p class="text-gray-400 text-lg">
        未找到与「<span class="text-white">{{ searchResult?.q }}</span>」相关的内容
      </p>
      <p class="text-gray-500 text-sm mt-2">
        请尝试更换关键词，或检查番号格式（如 ABP-001）
      </p>
    </div>

    <!-- 搜索结果 -->
    <div v-else-if="searchResult && hasResults()" class="space-y-10">
      <!-- 影片结果 -->
      <section v-if="searchResult.results.movies?.length">
        <h2 class="text-xl font-semibold text-white mb-4 flex items-center gap-2">
          <span>🎬</span>
          <span>影片</span>
          <span class="text-sm font-normal text-gray-400">（{{ searchResult.results.movies.length }} 条）</span>
        </h2>
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          <RouterLink
            v-for="movie in searchResult.results.movies"
            :key="movie.id"
            :to="`/movie/${movie.code}`"
            class="group"
          >
            <div class="relative overflow-hidden rounded-lg shadow-md group-hover:shadow-xl transition-shadow duration-300">
              <div class="aspect-3/4 bg-gray-800">
                <img
                  v-if="movie.coverImage"
                  :src="movie.coverImage"
                  :alt="movie.title"
                  class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                >
                <div v-else class="w-full h-full flex items-center justify-center text-gray-600 text-4xl">
                  🎬
                </div>
              </div>
              <div
                v-if="movie.isR18"
                class="absolute top-2 right-2 bg-red-600 text-white text-xs px-2 py-1 rounded"
              >
                R18
              </div>
            </div>
            <p class="mt-2 text-sm font-medium text-primary-400">
              {{ movie.code }}
            </p>
            <p class="text-sm text-gray-300 line-clamp-2 group-hover:text-white transition">
              {{ movie.title }}
            </p>
          </RouterLink>
        </div>
      </section>

      <!-- 演员结果 -->
      <section v-if="searchResult.results.actors?.length">
        <h2 class="text-xl font-semibold text-white mb-4 flex items-center gap-2">
          <span>👤</span>
          <span>演员</span>
          <span class="text-sm font-normal text-gray-400">（{{ searchResult.results.actors.length }} 条）</span>
        </h2>
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <RouterLink
            v-for="actor in searchResult.results.actors"
            :key="actor.id"
            :to="`/actors/${actor.slug}`"
            class="group flex flex-col items-center text-center p-4 bg-gray-800 rounded-lg hover:bg-gray-750 transition-colors"
          >
            <div class="w-16 h-16 rounded-full overflow-hidden bg-gray-700 mb-2 shrink-0">
              <img
                v-if="actor.avatar"
                :src="actor.avatar"
                :alt="actor.name"
                class="w-full h-full object-cover"
                loading="lazy"
              >
              <div v-else class="w-full h-full flex items-center justify-center text-2xl text-gray-500">
                👤
              </div>
            </div>
            <p class="text-sm font-medium text-white group-hover:text-primary-400 transition-colors line-clamp-2">
              {{ actor.name }}
            </p>
          </RouterLink>
        </div>
      </section>

      <!-- 厂商结果 -->
      <section v-if="searchResult.results.publishers?.length">
        <h2 class="text-xl font-semibold text-white mb-4 flex items-center gap-2">
          <span>🏢</span>
          <span>厂商</span>
          <span class="text-sm font-normal text-gray-400">（{{ searchResult.results.publishers.length }} 条）</span>
        </h2>
        <div class="flex flex-wrap gap-3">
          <RouterLink
            v-for="pub in searchResult.results.publishers"
            :key="pub.id"
            :to="`/publishers/${pub.slug}`"
            class="flex items-center gap-3 px-4 py-3 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
          >
            <div class="w-8 h-8 rounded bg-gray-700 flex items-center justify-center overflow-hidden shrink-0">
              <img
                v-if="pub.logo"
                :src="pub.logo"
                :alt="pub.name"
                class="w-full h-full object-contain"
                loading="lazy"
              >
              <span v-else class="text-lg">🏢</span>
            </div>
            <span class="text-white font-medium">{{ pub.name }}</span>
          </RouterLink>
        </div>
      </section>
    </div>

    <!-- 初始未搜索状态 -->
    <div v-else-if="!searched" class="text-center py-20 text-gray-500">
      <p class="text-5xl mb-4">
        🔍
      </p>
      <p class="text-lg">
        输入关键词开始搜索
      </p>
      <p class="text-sm mt-2">
        支持番号精确匹配（如 ABP-001）、影片标题、演员名、厂商名
      </p>
    </div>
  </div>
</template>
