<template>
  <div class="container mx-auto px-4 py-12 md:py-16">
    <div class="max-w-6xl mx-auto">
      <header class="mb-16 text-center max-w-2xl mx-auto">
        <h1 class="text-4xl md:text-5xl font-bold tracking-tight mb-6 bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60">
          {{ $t('welcome') }}
        </h1>
        <p class="text-muted-foreground text-lg md:text-xl leading-relaxed">
          Exploring the frontiers of technology, design, and digital life.
        </p>
      </header>

      <div v-if="pending" class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <div v-for="i in 6" :key="i" class="animate-pulse rounded-xl border bg-card p-0 overflow-hidden h-full">
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

      <div v-else-if="error" class="text-center py-24 bg-muted/30 rounded-3xl border border-dashed">
        <div class="mb-4 text-destructive text-4xl">⚠️</div>
        <p class="text-lg font-medium mb-2">Unable to load posts</p>
        <p class="text-muted-foreground text-sm mb-6">{{ error.message }}</p>
        <button class="px-6 py-2 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium text-sm" @click="refresh">
          Try Again
        </button>
      </div>

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

      <div v-if="!pending && !error && posts.length === 0" class="text-center py-24 text-muted-foreground">
        <p>No posts found.</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { PostCard } from '@starye/ui'
import type { ApiResponse, Post } from '~/types'

const config = useRuntimeConfig()
const { t } = useI18n()

useHead({
  title: 'Blog - Starye',
  meta: [
    { name: 'description', content: 'Personal blog of Starye' },
  ],
})

const { data, pending, error, refresh } = await useFetch<ApiResponse<Post[]>>('/api/posts', {
  baseURL: config.public.apiUrl,
  query: {
    limit: 10,
    published: true,
  },
})

const posts = computed(() => data.value?.data || [])

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}
</script>
