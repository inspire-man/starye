<template>
  <div class="container mx-auto px-4 py-8">
    <div class="max-w-4xl mx-auto">
      <header class="mb-12 text-center">
        <h1 class="text-4xl font-bold tracking-tight mb-4">{{ $t('welcome') }}</h1>
        <p class="text-muted-foreground text-lg">Exploring technology, design, and life.</p>
      </header>

      <div v-if="pending" class="space-y-8">
        <div v-for="i in 3" :key="i" class="animate-pulse">
          <div class="h-64 bg-muted rounded-xl mb-4" />
          <div class="h-8 bg-muted rounded w-3/4 mb-2" />
          <div class="h-4 bg-muted rounded w-1/2" />
        </div>
      </div>

      <div v-else-if="error" class="text-center py-12 text-destructive">
        <p>Failed to load posts.</p>
        <button class="mt-4 btn btn-outline" @click="refresh">Try Again</button>
      </div>

      <div v-else class="grid gap-8 md:grid-cols-2 lg:grid-cols-2">
        <article
          v-for="post in posts"
          :key="post.slug"
          class="group relative flex flex-col space-y-3"
        >
          <NuxtLink :to="`/${post.slug}`" class="block overflow-hidden rounded-xl border bg-card text-card-foreground shadow transition-colors hover:bg-muted/50">
            <div v-if="post.coverImage" class="aspect-video w-full overflow-hidden">
              <img
                :src="post.coverImage"
                :alt="post.title"
                class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                loading="lazy"
              >
            </div>
            <div v-else class="aspect-video w-full bg-muted flex items-center justify-center text-muted-foreground">
              <span class="text-4xl opacity-20">#</span>
            </div>

            <div class="p-6">
              <h2 class="text-2xl font-bold tracking-tight mb-2 group-hover:underline decoration-primary decoration-2 underline-offset-4">
                {{ post.title }}
              </h2>
              <p v-if="post.excerpt" class="text-muted-foreground line-clamp-3">
                {{ post.excerpt }}
              </p>
              <div class="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                <span v-if="post.author?.name">{{ post.author.name }}</span>
                <span>•</span>
                <time :datetime="post.createdAt">{{ formatDate(post.createdAt) }}</time>
              </div>
            </div>
          </NuxtLink>
        </article>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
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