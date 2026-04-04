<script setup lang="ts">
import type { SearchResult } from '../lib/api-client'
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { searchApi } from '../lib/api-client'

const router = useRouter()

const keyword = ref('')
const inputRef = ref<HTMLInputElement | null>(null)
const dropdownRef = ref<HTMLDivElement | null>(null)
const showDropdown = ref(false)
const loading = ref(false)
const candidates = ref<SearchResult['results'] | null>(null)

let debounceTimer: ReturnType<typeof setTimeout> | null = null

// 候选条目总数（用于键盘导航）
const activeIndex = ref(-1)

function onInput() {
  const q = keyword.value.trim()
  activeIndex.value = -1

  // 少于 2 字符不触发请求
  if (q.length < 2) {
    showDropdown.value = false
    candidates.value = null
    if (debounceTimer)
      clearTimeout(debounceTimer)
    return
  }

  if (debounceTimer)
    clearTimeout(debounceTimer)

  debounceTimer = setTimeout(async () => {
    loading.value = true
    try {
      const result = await searchApi.search(q, { limit: 3 })
      candidates.value = result.results
      showDropdown.value = true
    }
    catch {
      candidates.value = null
      showDropdown.value = false
    }
    finally {
      loading.value = false
    }
  }, 300)
}

function closeDropdown() {
  showDropdown.value = false
  activeIndex.value = -1
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    closeDropdown()
    return
  }
  if (e.key === 'Enter') {
    if (activeIndex.value >= 0) {
      // 跳转到高亮条目
      navigateToItem(activeIndex.value)
    }
    else {
      goToSearchPage()
    }
    return
  }
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    const total = totalCandidates()
    activeIndex.value = (activeIndex.value + 1) % total
    return
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault()
    const total = totalCandidates()
    activeIndex.value = (activeIndex.value - 1 + total) % total
  }
}

function totalCandidates(): number {
  const r = candidates.value
  if (!r)
    return 0
  return (r.movies?.length || 0) + (r.actors?.length || 0) + (r.publishers?.length || 0)
}

/** 按全局 index 取对应条目并跳转 */
function navigateToItem(globalIdx: number) {
  const r = candidates.value
  if (!r)
    return
  const movies = r.movies || []
  const actors = r.actors || []
  const publishers = r.publishers || []

  if (globalIdx < movies.length) {
    router.push(`/movie/${movies[globalIdx].code}`)
  }
  else if (globalIdx < movies.length + actors.length) {
    router.push(`/actors/${actors[globalIdx - movies.length].slug}`)
  }
  else {
    router.push(`/publishers/${publishers[globalIdx - movies.length - actors.length].slug}`)
  }
  closeDropdown()
  keyword.value = ''
}

function goToSearchPage() {
  const q = keyword.value.trim()
  if (!q)
    return
  router.push({ path: '/search', query: { q } })
  closeDropdown()
  keyword.value = ''
}

function handleMovieClick(code: string) {
  router.push(`/movie/${code}`)
  closeDropdown()
  keyword.value = ''
}

function handleActorClick(slug: string) {
  router.push(`/actors/${slug}`)
  closeDropdown()
  keyword.value = ''
}

function handlePublisherClick(slug: string) {
  router.push(`/publishers/${slug}`)
  closeDropdown()
  keyword.value = ''
}

// 点击外部关闭下拉
function handleClickOutside(e: MouseEvent) {
  const target = e.target as Node
  if (
    inputRef.value && !inputRef.value.contains(target)
    && dropdownRef.value && !dropdownRef.value.contains(target)
  ) {
    closeDropdown()
  }
}

onMounted(() => {
  document.addEventListener('mousedown', handleClickOutside)
})
onBeforeUnmount(() => {
  document.removeEventListener('mousedown', handleClickOutside)
  if (debounceTimer)
    clearTimeout(debounceTimer)
})

// 提供给父组件聚焦
function focus() {
  nextTick(() => inputRef.value?.focus())
}

defineExpose({ focus })
</script>

<template>
  <div class="relative">
    <!-- 搜索输入框 -->
    <div class="relative flex items-center">
      <svg class="absolute left-3 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <input
        ref="inputRef"
        v-model="keyword"
        type="text"
        placeholder="搜索影片、演员、厂商..."
        class="w-full pl-9 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-sm transition-all"
        @input="onInput"
        @keydown="handleKeydown"
        @focus="keyword.trim().length >= 2 && (showDropdown = true)"
      >
      <!-- loading 指示器 -->
      <div v-if="loading" class="absolute right-3">
        <div class="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    </div>

    <!-- 下拉候选列表 -->
    <Transition name="dropdown">
      <div
        v-if="showDropdown && candidates && totalCandidates() > 0"
        ref="dropdownRef"
        class="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-xl z-50 overflow-hidden"
      >
        <!-- 影片候选 -->
        <div v-if="candidates.movies?.length">
          <div class="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider bg-gray-750">
            影片
          </div>
          <button
            v-for="(movie, idx) in candidates.movies"
            :key="movie.id"
            type="button"
            class="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-700 transition-colors"
            :class="{ 'bg-gray-700': activeIndex === idx }"
            @click="handleMovieClick(movie.code)"
          >
            <div class="w-8 h-8 rounded overflow-hidden bg-gray-700 shrink-0">
              <img
                v-if="movie.coverImage"
                :src="movie.coverImage"
                :alt="movie.title"
                class="w-full h-full object-cover"
                loading="lazy"
              >
              <span v-else class="flex h-full items-center justify-center text-lg">🎬</span>
            </div>
            <div class="min-w-0">
              <p class="text-primary-400 text-xs font-medium">
                {{ movie.code }}
              </p>
              <p class="text-white text-sm truncate">
                {{ movie.title }}
              </p>
            </div>
            <span v-if="movie.isR18" class="ml-auto shrink-0 text-xs bg-red-600 text-white px-1.5 py-0.5 rounded">
              R18
            </span>
          </button>
        </div>

        <!-- 演员候选 -->
        <div v-if="candidates.actors?.length">
          <div class="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider bg-gray-750 border-t border-gray-700">
            演员
          </div>
          <button
            v-for="(actor, idx) in candidates.actors"
            :key="actor.id"
            type="button"
            class="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-700 transition-colors"
            :class="{ 'bg-gray-700': activeIndex === (candidates.movies?.length || 0) + idx }"
            @click="handleActorClick(actor.slug)"
          >
            <div class="w-8 h-8 rounded-full overflow-hidden bg-gray-700 shrink-0">
              <img
                v-if="actor.avatar"
                :src="actor.avatar"
                :alt="actor.name"
                class="w-full h-full object-cover"
                loading="lazy"
              >
              <span v-else class="flex h-full items-center justify-center text-lg">👤</span>
            </div>
            <span class="text-white text-sm truncate">{{ actor.name }}</span>
          </button>
        </div>

        <!-- 厂商候选 -->
        <div v-if="candidates.publishers?.length">
          <div class="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider bg-gray-750 border-t border-gray-700">
            厂商
          </div>
          <button
            v-for="(pub, idx) in candidates.publishers"
            :key="pub.id"
            type="button"
            class="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-700 transition-colors"
            :class="{ 'bg-gray-700': activeIndex === (candidates.movies?.length || 0) + (candidates.actors?.length || 0) + idx }"
            @click="handlePublisherClick(pub.slug)"
          >
            <div class="w-8 h-8 rounded bg-gray-700 shrink-0 flex items-center justify-center overflow-hidden">
              <img
                v-if="pub.logo"
                :src="pub.logo"
                :alt="pub.name"
                class="w-full h-full object-contain"
                loading="lazy"
              >
              <span v-else class="text-lg">🏢</span>
            </div>
            <span class="text-white text-sm truncate">{{ pub.name }}</span>
          </button>
        </div>

        <!-- 查看全部结果入口 -->
        <div class="border-t border-gray-700">
          <button
            type="button"
            class="w-full px-3 py-2.5 text-sm text-primary-400 hover:bg-gray-700 text-left transition-colors flex items-center gap-2"
            @click="goToSearchPage"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            查看「{{ keyword.trim() }}」的全部结果
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.bg-gray-750 {
  background-color: rgb(38, 43, 51);
}

.dropdown-enter-active,
.dropdown-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
