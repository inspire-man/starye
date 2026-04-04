<script setup lang="ts">
import type { ApiResponse, Post } from '~/types'
import { PostCard } from '@starye/ui'

const config = useRuntimeConfig()
const route = useRoute()
const tagName = route.params.tag as string

const { data, pending, error } = await useAsyncData<ApiResponse<Post[]>>(
  `tag-${tagName}`,
  () => $fetch('/api/posts', {
    baseURL: config.public.apiUrl,
    query: { tag: tagName, limit: 50 },
  }),
)

const posts = computed(() => data.value?.data || [])
const total = computed(() => data.value?.meta?.total ?? 0)

useHead({
  title: computed(() => `#${tagName} - Starye Blog`),
  meta: [
    { name: 'description', content: computed(() => `标签：${tagName}`) },
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
    <div class="max-w-6xl mx-auto">
      <!-- 标签标题 -->
      <header class="mb-12">
        <div class="text-sm text-muted-foreground mb-3 flex items-center gap-2">
          <NuxtLink to="/" class="hover:text-primary transition-colors">
            首页
          </NuxtLink>
          <span>/</span>
          <span>标签</span>
        </div>
        <div class="flex items-center gap-3">
          <span class="text-4xl md:text-5xl font-bold tracking-tight text-primary">#</span>
          <h1 class="text-4xl md:text-5xl font-bold tracking-tight">
            {{ tagName }}
          </h1>
        </div>
        <p v-if="total > 0" class="text-muted-foreground mt-3">
          共 {{ total }} 篇文章
        </p>
      </header>

      <!-- 加载中 -->
      <div v-if="pending" class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <div v-for="i in 6" :key="i" class="animate-pulse rounded-xl border bg-card overflow-hidden">
          <div class="h-48 bg-muted" />
          <div class="p-5 space-y-3">
            <div class="h-5 bg-muted rounded w-3/4" />
            <div class="h-4 bg-muted rounded w-full" />
          </div>
        </div>
      </div>

      <!-- 错误 -->
      <div v-else-if="error" class="text-center py-20 text-muted-foreground">
        <p>加载失败，请稍后重试。</p>
      </div>

      <!-- 文章网格 -->
      <div v-else-if="posts.length > 0" class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
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

      <!-- 空状态 -->
      <div v-else class="text-center py-20 text-muted-foreground">
        <p>该标签下暂无文章。</p>
      </div>
    </div>
  </div>
</template>
