<script setup lang="ts">
import type { ApiResponse, Post } from '~/types'
import { PostCard } from '@starye/ui'

const config = useRuntimeConfig()
const route = useRoute()
const router = useRouter()

useSeoMeta({
  title: '搜索 - Starye Blog',
  description: '搜索 Starye Blog 中的文章',
})

// 搜索关键词（与 URL query 同步）
const keyword = ref((route.query.q as string) || '')
const debouncedKeyword = ref(keyword.value)
let debounceTimer: ReturnType<typeof setTimeout>

watch(keyword, (val) => {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    debouncedKeyword.value = val
    router.replace({ query: val ? { q: val } : {} })
  }, 400)
})

const { data, pending } = await useAsyncData<ApiResponse<Post[]>>(
  'search-results',
  () => {
    const q = debouncedKeyword.value.trim()
    if (!q)
      return Promise.resolve({ data: [], meta: null } as any)
    return $fetch('/api/posts', {
      baseURL: config.public.apiUrl,
      query: { search: q, limit: 30 },
    })
  },
  { watch: [debouncedKeyword] },
)

const results = computed(() => data.value?.data || [])
const hasQuery = computed(() => debouncedKeyword.value.trim().length > 0)

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}
</script>

<template>
  <div class="container mx-auto px-4 py-12">
    <div class="max-w-3xl mx-auto">
      <!-- 标题 -->
      <header class="mb-8">
        <h1 class="text-3xl font-bold tracking-tight mb-2">
          搜索文章
        </h1>
        <p class="text-muted-foreground text-sm">
          在所有文章中搜索标题、摘要或内容
        </p>
      </header>

      <!-- 搜索框 -->
      <div class="relative mb-10">
        <svg
          class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none"
          fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-4.35-4.35m0 0A7 7 0 1 0 4.65 4.65a7 7 0 0 0 12 12Z" />
        </svg>
        <input
          v-model="keyword"
          type="search"
          placeholder="输入关键词搜索…"
          autofocus
          class="w-full pl-12 pr-4 py-3 rounded-xl border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors text-base"
        >
        <button
          v-if="keyword"
          class="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          @click="keyword = ''"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- 加载中 -->
      <div v-if="pending && hasQuery" class="space-y-4">
        <div v-for="i in 4" :key="i" class="animate-pulse rounded-xl border bg-card p-5">
          <div class="h-5 bg-muted rounded w-3/4 mb-3" />
          <div class="h-4 bg-muted rounded w-full mb-2" />
          <div class="h-4 bg-muted rounded w-2/3" />
        </div>
      </div>

      <!-- 空状态：无关键词 -->
      <div v-else-if="!hasQuery" class="text-center py-24 text-muted-foreground">
        <svg class="w-12 h-12 mx-auto mb-4 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-4.35-4.35m0 0A7 7 0 1 0 4.65 4.65a7 7 0 0 0 12 12Z" />
        </svg>
        <p>请输入关键词开始搜索</p>
      </div>

      <!-- 无结果 -->
      <div v-else-if="!pending && hasQuery && results.length === 0" class="text-center py-24 text-muted-foreground">
        <svg class="w-12 h-12 mx-auto mb-4 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9.172 16.172a4 4 0 0 1 5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
        <p>未找到与 "<span class="font-medium text-foreground">{{ debouncedKeyword }}</span>" 相关的文章</p>
      </div>

      <!-- 搜索结果 -->
      <div v-else class="space-y-3">
        <p class="text-sm text-muted-foreground mb-4">
          找到 <span class="font-medium text-foreground">{{ results.length }}</span> 篇文章
        </p>
        <PostCard
          v-for="post in results"
          :key="post.slug"
          :title="post.title"
          :href="`/${post.slug}`"
          :cover="post.coverImage"
          :excerpt="post.excerpt"
          :author="post.author?.name"
          :date="formatDate(post.createdAt)"
          layout="horizontal"
        />
      </div>
    </div>
  </div>
</template>
