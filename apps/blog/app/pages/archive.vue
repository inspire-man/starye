<script setup lang="ts">
import type { ApiResponse, Post } from '~/types'

const config = useRuntimeConfig()

useSeoMeta({
  title: '归档 - Starye Blog',
  description: '按时间线浏览所有文章',
})

const { data, pending, error } = await useAsyncData<ApiResponse<Post[]>>(
  'archive-all',
  () => $fetch('/api/posts', {
    baseURL: config.public.apiUrl,
    query: { limit: 200 },
  }),
)

// 按年月分组
const grouped = computed(() => {
  const posts = data.value?.data || []
  const map = new Map<string, Map<string, Post[]>>()

  for (const post of posts) {
    const d = new Date(post.createdAt)
    const year = String(d.getFullYear())
    const month = String(d.getMonth() + 1).padStart(2, '0')
    if (!map.has(year))
      map.set(year, new Map())
    const yearMap = map.get(year)!
    if (!yearMap.has(month))
      yearMap.set(month, [])
    yearMap.get(month)!.push(post)
  }

  // 排序（年降序，月降序）
  return [...map.entries()]
    .sort(([a], [b]) => Number(b) - Number(a))
    .map(([year, months]) => ({
      year,
      months: [...months.entries()]
        .sort(([a], [b]) => Number(b) - Number(a))
        .map(([month, posts]) => ({
          month,
          label: `${Number(month)} 月`,
          posts: posts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
        })),
    }))
})

const total = computed(() => data.value?.data?.length || 0)

function formatDay(dateString: string) {
  return new Date(dateString).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' }).replace(/[年月]/g, '/').replace('日', '')
}
</script>

<template>
  <div class="container mx-auto px-4 py-12">
    <div class="max-w-2xl mx-auto">
      <!-- 标题 -->
      <header class="mb-10">
        <h1 class="text-3xl font-bold tracking-tight mb-2">
          文章归档
        </h1>
        <p class="text-muted-foreground text-sm">
          共 {{ total }} 篇文章
        </p>
      </header>

      <!-- 加载中 -->
      <div v-if="pending" class="space-y-6">
        <div v-for="i in 3" :key="i" class="animate-pulse">
          <div class="h-8 bg-muted rounded w-24 mb-4" />
          <div v-for="j in 4" :key="j" class="h-5 bg-muted rounded mb-3" />
        </div>
      </div>

      <!-- 错误 -->
      <div v-else-if="error" class="text-center py-20 text-destructive">
        加载失败：{{ error.message }}
      </div>

      <!-- 时间线 -->
      <div v-else class="relative">
        <!-- 时间线竖线 -->
        <div class="absolute left-[5.5rem] top-0 bottom-0 w-px bg-border" />

        <div v-for="group in grouped" :key="group.year" class="mb-10">
          <!-- 年份标签 -->
          <div class="flex items-center gap-4 mb-6">
            <span class="text-2xl font-bold text-primary w-20 text-right shrink-0">{{ group.year }}</span>
            <div class="w-3 h-3 rounded-full bg-primary border-2 border-background ring-2 ring-primary/30 shrink-0 ml-1.5" />
          </div>

          <div v-for="monthGroup in group.months" :key="monthGroup.month" class="mb-6 ml-24 pl-6">
            <!-- 月份 -->
            <h3 class="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
              {{ monthGroup.label }}
            </h3>
            <ul class="space-y-2">
              <li v-for="post in monthGroup.posts" :key="post.slug" class="flex items-start gap-3">
                <span class="text-xs text-muted-foreground shrink-0 mt-1 tabular-nums w-12">
                  {{ formatDay(post.createdAt) }}
                </span>
                <NuxtLink
                  :to="`/${post.slug}`"
                  class="text-sm hover:text-primary transition-colors line-clamp-1 flex-1"
                >
                  {{ post.title }}
                </NuxtLink>
              </li>
            </ul>
          </div>
        </div>

        <!-- 空状态 -->
        <div v-if="!pending && grouped.length === 0" class="text-center py-20 text-muted-foreground">
          暂无文章
        </div>
      </div>
    </div>
  </div>
</template>
