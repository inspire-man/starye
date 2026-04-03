<script setup lang="ts">
import type { ApiResponse, Post } from '~/types'

const config = useRuntimeConfig()
const route = useRoute()
const seriesName = route.params.name as string

const { data, pending, error } = await useFetch<ApiResponse<Post[]>>('/api/posts', {
  baseURL: config.public.apiUrl,
  query: { series: seriesName, limit: 50 },
})

const posts = computed(() => data.value?.data || [])
const total = computed(() => data.value?.meta?.total ?? 0)

// 将 kebab-case 转为可读标题
const seriesLabel = computed(() =>
  seriesName.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
)

useHead({
  title: computed(() => `${seriesLabel.value} - Starye Blog`),
  meta: [
    { name: 'description', content: computed(() => `系列文章：${seriesLabel.value}`) },
  ],
})

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
    <div class="max-w-5xl mx-auto">
      <!-- 系列标题 -->
      <header class="mb-12">
        <div class="text-sm text-muted-foreground mb-3 flex items-center gap-2">
          <NuxtLink to="/" class="hover:text-primary transition-colors">
            首页
          </NuxtLink>
          <span>/</span>
          <span>系列</span>
        </div>
        <h1 class="text-3xl md:text-4xl font-bold tracking-tight mb-3">
          {{ seriesLabel }}
        </h1>
        <p v-if="total > 0" class="text-muted-foreground">
          共 {{ total }} 篇文章
        </p>
      </header>

      <!-- 加载中 -->
      <div v-if="pending" class="space-y-4">
        <div v-for="i in 5" :key="i" class="animate-pulse flex gap-4 p-4 rounded-xl border bg-card">
          <div class="w-12 h-12 bg-muted rounded-lg shrink-0" />
          <div class="flex-1 space-y-2">
            <div class="h-5 bg-muted rounded w-2/3" />
            <div class="h-4 bg-muted rounded w-full" />
          </div>
        </div>
      </div>

      <!-- 错误 -->
      <div v-else-if="error" class="text-center py-20 text-muted-foreground">
        <p>加载失败，请稍后重试。</p>
      </div>

      <!-- 系列文章列表（带序号，按 seriesOrder 排列） -->
      <div v-else-if="posts.length > 0" class="space-y-4">
        <NuxtLink
          v-for="(post, idx) in posts"
          :key="post.slug"
          :to="`/${post.slug}`"
          class="group flex items-start gap-4 p-5 rounded-xl border bg-card hover:border-primary/50 hover:shadow-sm transition-all"
        >
          <!-- 序号 -->
          <div class="shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
            {{ post.seriesOrder ?? idx + 1 }}
          </div>
          <!-- 内容 -->
          <div class="flex-1 min-w-0">
            <h2 class="font-semibold text-lg group-hover:text-primary transition-colors line-clamp-2">
              {{ post.title }}
            </h2>
            <p v-if="post.excerpt" class="text-muted-foreground text-sm mt-1 line-clamp-2">
              {{ post.excerpt }}
            </p>
            <div class="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
              <time v-if="post.createdAt">{{ formatDate(post.createdAt) }}</time>
              <div v-if="post.tags?.length" class="flex gap-1">
                <span
                  v-for="t in post.tags.slice(0, 3)"
                  :key="t"
                  class="px-1.5 py-0.5 rounded bg-muted text-muted-foreground"
                >
                  #{{ t }}
                </span>
              </div>
            </div>
          </div>
          <svg class="shrink-0 w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="m9 18 6-6-6-6" />
          </svg>
        </NuxtLink>
      </div>

      <!-- 空状态 -->
      <div v-else class="text-center py-20 text-muted-foreground">
        <p>该系列暂无文章。</p>
      </div>
    </div>
  </div>
</template>
