<script setup lang="ts">
import type { ApiResponse, Post } from '~/types'
import { PostCard } from '@starye/ui'

const config = useRuntimeConfig()
const route = useRoute()
const router = useRouter()

useHead({
  title: 'Blog - Starye',
  meta: [
    { name: 'description', content: 'Personal blog of Starye' },
  ],
})

// 筛选状态（与 URL query 同步）
const activeSeries = computed(() => route.query.series as string | undefined)
const activeTag = computed(() => route.query.tag as string | undefined)
const currentPage = ref(1)
const allPosts = ref<Post[]>([])
const totalPages = ref(1)
const loadingMore = ref(false)

// 获取首屏文章（响应式：series/tag 变化时重置）
const { data, pending, error, refresh } = await useAsyncData<ApiResponse<Post[]>>(
  'posts-list',
  () => $fetch('/api/posts', {
    baseURL: config.public.apiUrl,
    query: {
      limit: 9,
      page: 1,
      ...(activeSeries.value ? { series: activeSeries.value } : {}),
      ...(activeTag.value ? { tag: activeTag.value } : {}),
    },
  }),
  { watch: [activeSeries, activeTag] },
)

// 当过滤条件变化时重置分页和列表
watch([activeSeries, activeTag], () => {
  currentPage.value = 1
  allPosts.value = []
})

// 合并首屏与 Load More 数据
watch(data, (val) => {
  if (!val)
    return
  if (currentPage.value === 1) {
    allPosts.value = val.data || []
  }
  totalPages.value = val.meta?.totalPages ?? 1
}, { immediate: true })

const posts = computed(() => allPosts.value)
const hasMore = computed(() => currentPage.value < totalPages.value)

async function loadMore() {
  loadingMore.value = true
  currentPage.value++
  try {
    const params = new URLSearchParams({
      limit: '9',
      page: String(currentPage.value),
    })
    if (activeSeries.value)
      params.set('series', activeSeries.value)
    if (activeTag.value)
      params.set('tag', activeTag.value)

    const res = await $fetch<ApiResponse<Post[]>>(`/api/posts?${params}`, {
      baseURL: config.public.apiUrl,
    })
    allPosts.value = [...allPosts.value, ...(res.data || [])]
    totalPages.value = res.meta?.totalPages ?? 1
  }
  catch {
    currentPage.value--
  }
  finally {
    loadingMore.value = false
  }
}

// 提取所有系列列表（从已加载文章中聚合，不额外请求）
const { data: allForFilter } = await useAsyncData<ApiResponse<Post[]>>(
  'posts-all-filter',
  () => $fetch('/api/posts', {
    baseURL: config.public.apiUrl,
    query: { limit: 100 },
  }),
  { lazy: true },
)

const seriesList = computed(() => {
  const all = allForFilter.value?.data || []
  const map = new Map<string, string>()
  for (const p of all) {
    if (p.series) {
      // 用系列名作为显示标签（将 kebab-case 转为可读形式）
      map.set(p.series, p.series)
    }
  }
  return Array.from(map.entries(), ([slug]) => slug)
})

const tagList = computed(() => {
  const all = allForFilter.value?.data || []
  const set = new Set<string>()
  for (const p of all) {
    for (const t of (p.tags || [])) set.add(t)
  }
  return [...set]
})

function setSeriesFilter(series: string) {
  if (activeSeries.value === series) {
    router.push({ query: { ...route.query, series: undefined } })
  }
  else {
    router.push({ query: { ...route.query, series, tag: undefined } })
  }
}

function setTagFilter(tag: string) {
  if (activeTag.value === tag) {
    router.push({ query: { ...route.query, tag: undefined } })
  }
  else {
    router.push({ query: { ...route.query, tag, series: undefined } })
  }
}

function formatSeriesLabel(slug: string) {
  return slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}
</script>

<template>
  <div class="container mx-auto px-4 py-12 md:py-16">
    <div class="max-w-6xl mx-auto">
      <!-- 页面标题 -->
      <header class="mb-12 text-center max-w-2xl mx-auto">
        <h1 class="text-4xl md:text-5xl font-bold tracking-tight mb-6 bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60">
          {{ $t('welcome') }}
        </h1>
        <p class="text-muted-foreground text-lg md:text-xl leading-relaxed">
          技术探索 · 全栈实践 · AI 辅助开发
        </p>
      </header>

      <!-- 筛选 chips -->
      <div v-if="seriesList.length > 0 || tagList.length > 0" class="mb-10 space-y-3">
        <!-- 系列筛选 -->
        <div v-if="seriesList.length > 0" class="flex flex-wrap gap-2 items-center">
          <span class="text-xs font-medium text-muted-foreground mr-1">系列：</span>
          <button
            v-for="s in seriesList"
            :key="s"
            class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border transition-colors"
            :class="activeSeries === s
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-background text-foreground border-border hover:border-primary/50 hover:text-primary'"
            @click="setSeriesFilter(s)"
          >
            {{ formatSeriesLabel(s) }}
          </button>
        </div>
        <!-- 标签筛选 -->
        <div v-if="tagList.length > 0" class="flex flex-wrap gap-2 items-center">
          <span class="text-xs font-medium text-muted-foreground mr-1">标签：</span>
          <button
            v-for="t in tagList"
            :key="t"
            class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border transition-colors"
            :class="activeTag === t
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-background text-foreground border-border hover:border-primary/50 hover:text-primary'"
            @click="setTagFilter(t)"
          >
            # {{ t }}
          </button>
        </div>
      </div>

      <!-- Skeleton 加载 -->
      <div v-if="pending && posts.length === 0" class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <div v-for="i in 9" :key="i" class="animate-pulse rounded-xl border bg-card p-0 overflow-hidden h-full">
          <div class="h-48 bg-muted w-full" />
          <div class="p-5 space-y-3">
            <div class="h-6 bg-muted rounded w-3/4" />
            <div class="h-4 bg-muted rounded w-full" />
            <div class="h-4 bg-muted rounded w-2/3" />
            <div class="pt-4 flex gap-2">
              <div class="h-4 bg-muted rounded w-20" />
            </div>
          </div>
        </div>
      </div>

      <!-- 错误状态 -->
      <div v-else-if="error" class="text-center py-24 bg-muted/30 rounded-3xl border border-dashed">
        <div class="mb-4 text-destructive text-4xl">
          ⚠️
        </div>
        <p class="text-lg font-medium mb-2">
          无法加载文章
        </p>
        <p class="text-muted-foreground text-sm mb-6">
          {{ error.message }}
        </p>
        <Button class="px-6 py-2 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium text-sm" @click="refresh">
          重试
        </button>
      </div>

      <!-- 文章网格 -->
      <div v-else class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <PostCard
          v-for="post in posts"
          :key="post.slug"
          :title="post.title"
          :href="`/${post.slug}`"
          :cover="post.coverImage"
          :excerpt="post.excerpt"
          :author="post.author?.name"
          :date="formatDate(post.createdAt)"
        />
      </div>

      <!-- 无结果 -->
      <div v-if="!pending && !error && posts.length === 0" class="text-center py-24 text-muted-foreground">
        <p>暂无文章。</p>
      </div>

      <!-- Load More 按钮 -->
      <div v-if="hasMore && !pending && posts.length > 0" class="mt-12 text-center">
        <button
          class="px-8 py-3 rounded-full border border-border hover:border-primary/50 hover:text-primary transition-colors font-medium text-sm disabled:opacity-50"
          :disabled="loadingMore"
          @click="loadMore"
        >
          {{ loadingMore ? '加载中...' : '加载更多' }}
        </button>
      </div>
    </div>
  </div>
</template>
