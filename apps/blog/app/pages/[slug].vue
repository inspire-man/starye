<script setup lang="ts">
import type { AdjacentPosts, ApiResponse, Post } from '~/types'
import MarkdownIt from 'markdown-it'

const route = useRoute()
const config = useRuntimeConfig()
const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
})

const slug = route.params.slug as string

const { data, pending, error } = await useFetch<ApiResponse<Post>>(`/api/posts/${slug}`, {
  baseURL: config.public.apiUrl,
})

const post = computed(() => data.value?.data)

// 根据 contentFormat 决定渲染方式
// 'html' 或默认新格式（wangEditor 输出）直接 v-html
// 'markdown' 或 null（存量数据）经 markdown-it 处理
const renderedContent = computed(() => {
  if (!post.value?.content)
    return ''
  const fmt = post.value.contentFormat
  if (!fmt || fmt === 'markdown') {
    return md.render(post.value.content)
  }
  return post.value.content
})

// 客户端计算字数与阅读时间
const wordCount = computed(() => {
  if (!post.value?.content)
    return 0
  return post.value.content.replace(/<[^>]*>/g, '').replace(/\s+/g, '').length
})

const readingTime = computed(() => Math.max(1, Math.ceil(wordCount.value / 400)))

// 上/下篇
const { data: adjacentData } = await useFetch<ApiResponse<AdjacentPosts>>(`/api/posts/${slug}/adjacent`, {
  baseURL: config.public.apiUrl,
})
const adjacent = computed(() => adjacentData.value?.data)

useHead({
  title: computed(() => post.value?.title ? `${post.value.title} - Starye Blog` : 'Loading...'),
  meta: [
    { name: 'description', content: computed(() => post.value?.excerpt || '') },
  ],
})

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function formatSeriesLabel(slug: string) {
  return slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function scrollToHeading(id: string) {
  if (import.meta.client) {
    const el = document.getElementById(id)
    if (el)
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}
</script>

<template>
  <div class="container mx-auto px-4 py-8">
    <!-- 加载中 -->
    <div v-if="pending" class="max-w-3xl mx-auto space-y-4 animate-pulse">
      <div class="h-12 bg-muted rounded w-3/4" />
      <div class="h-6 bg-muted rounded w-1/4" />
      <div class="h-96 bg-muted rounded mt-8" />
    </div>

    <!-- 404 -->
    <div v-else-if="error" class="max-w-3xl mx-auto text-center py-20">
      <h1 class="text-4xl font-bold mb-4">
        404
      </h1>
      <p class="text-muted-foreground mb-8">
        文章未找到。
      </p>
      <NuxtLink to="/" class="text-primary hover:underline">
        &larr; 返回首页
      </NuxtLink>
    </div>

    <!-- 文章内容 + TOC -->
    <div v-else-if="post" class="max-w-7xl mx-auto">
      <div class="flex gap-10 items-start">
        <!-- 主内容 -->
        <article class="flex-1 min-w-0 max-w-3xl mx-auto">
          <header class="mb-10">
            <!-- 系列标签 -->
            <div v-if="post.series" class="mb-4">
              <NuxtLink
                :to="`/series/${post.series}`"
                class="inline-flex items-center gap-1.5 text-xs font-medium text-primary bg-primary/10 px-3 py-1 rounded-full hover:bg-primary/20 transition-colors"
              >
                <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M19 11H5m14 0-4-4m4 4-4 4" />
                </svg>
                {{ formatSeriesLabel(post.series) }}
                <span v-if="post.seriesOrder" class="text-primary/60">· 第 {{ post.seriesOrder }} 篇</span>
              </NuxtLink>
            </div>

            <!-- 元信息 -->
            <div class="flex items-center flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground mb-4">
              <time :datetime="post.createdAt">{{ formatDate(post.createdAt) }}</time>
              <span v-if="post.author?.name">{{ post.author.name }}</span>
              <span class="flex items-center gap-1">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                约 {{ readingTime }} 分钟 · {{ wordCount.toLocaleString() }} 字
              </span>
            </div>

            <!-- 标题 -->
            <h1 class="text-3xl md:text-4xl font-bold tracking-tight mb-6">
              {{ post.title }}
            </h1>

            <!-- 标签 -->
            <div v-if="post.tags?.length" class="flex flex-wrap gap-2 mb-6">
              <NuxtLink
                v-for="t in post.tags"
                :key="t"
                :to="`/tags/${t}`"
                class="text-xs px-2.5 py-1 rounded-full bg-muted hover:bg-primary/10 hover:text-primary transition-colors"
              >
                #{{ t }}
              </NuxtLink>
            </div>

            <!-- 封面图 -->
            <div v-if="post.coverImage" class="rounded-xl overflow-hidden shadow-lg">
              <img :src="post.coverImage" :alt="post.title" class="w-full h-auto">
            </div>
          </header>

          <!-- 正文 -->
          <div class="prose prose-lg dark:prose-invert max-w-none" v-html="renderedContent" />

          <hr class="my-12 border-border">

          <!-- 上/下篇导航 -->
          <nav v-if="adjacent" class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <NuxtLink
              v-if="adjacent.prev"
              :to="`/${adjacent.prev.slug}`"
              class="group flex items-start gap-3 p-4 rounded-xl border bg-card hover:border-primary/50 hover:shadow-sm transition-all"
            >
              <svg class="shrink-0 w-5 h-5 text-muted-foreground group-hover:text-primary mt-0.5 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="m15 18-6-6 6-6" />
              </svg>
              <div>
                <div class="text-xs text-muted-foreground mb-1">
                  上一篇
                </div>
                <div class="text-sm font-medium group-hover:text-primary transition-colors line-clamp-2">
                  {{ adjacent.prev.title }}
                </div>
              </div>
            </NuxtLink>
            <div v-else />

            <NuxtLink
              v-if="adjacent.next"
              :to="`/${adjacent.next.slug}`"
              class="group flex items-start gap-3 p-4 rounded-xl border bg-card hover:border-primary/50 hover:shadow-sm transition-all text-right sm:flex-row-reverse"
            >
              <svg class="shrink-0 w-5 h-5 text-muted-foreground group-hover:text-primary mt-0.5 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="m9 18 6-6-6-6" />
              </svg>
              <div>
                <div class="text-xs text-muted-foreground mb-1">
                  下一篇
                </div>
                <div class="text-sm font-medium group-hover:text-primary transition-colors line-clamp-2">
                  {{ adjacent.next.title }}
                </div>
              </div>
            </NuxtLink>
          </nav>

          <!-- 返回首页 -->
          <div class="mt-10">
            <NuxtLink to="/" class="text-muted-foreground hover:text-primary transition-colors flex items-center gap-2 text-sm">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="m15 18-6-6 6-6" />
              </svg>
              返回文章列表
            </NuxtLink>
          </div>
        </article>

        <!-- 右侧 TOC（宽屏显示） -->
        <aside
          v-if="post.toc && post.toc.length > 0"
          class="hidden lg:block w-56 xl:w-64 shrink-0 sticky top-8 self-start"
        >
          <div class="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            目录
          </div>
          <nav class="space-y-1">
            <a
              v-for="item in post.toc"
              :key="item.id"
              :href="`#${item.id}`"
              class="block text-sm text-muted-foreground hover:text-primary transition-colors leading-relaxed"
              :class="item.level === 3 ? 'pl-3 text-xs' : ''"
              @click.prevent="scrollToHeading(item.id)"
            >
              {{ item.text }}
            </a>
          </nav>
        </aside>
      </div>
    </div>
  </div>
</template>

<style>
.prose img {
  border-radius: 0.5rem;
  margin-left: auto;
  margin-right: auto;
}

/* wangEditor 输出的代码块样式补丁 */
.prose pre {
  background-color: hsl(var(--muted));
  border-radius: 0.5rem;
  overflow-x: auto;
}

.prose code:not(pre code) {
  background-color: hsl(var(--muted));
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  font-size: 0.875em;
}
</style>
