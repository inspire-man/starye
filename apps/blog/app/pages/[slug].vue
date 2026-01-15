<template>
  <div class="container mx-auto px-4 py-8">
    <div v-if="pending" class="max-w-3xl mx-auto space-y-4 animate-pulse">
      <div class="h-12 bg-muted rounded w-3/4" />
      <div class="h-6 bg-muted rounded w-1/4" />
      <div class="h-96 bg-muted rounded mt-8" />
    </div>

    <div v-else-if="error" class="max-w-3xl mx-auto text-center py-20">
      <h1 class="text-4xl font-bold mb-4">404</h1>
      <p class="text-muted-foreground mb-8">Post not found.</p>
      <NuxtLink to="/" class="text-primary hover:underline">
        &larr; Back to Blog
      </NuxtLink>
    </div>

    <article v-else-if="post" class="max-w-3xl mx-auto">
      <header class="mb-10 text-center">
        <div class="flex items-center justify-center gap-2 text-sm text-muted-foreground mb-4">
          <time :datetime="post.createdAt">{{ formatDate(post.createdAt) }}</time>
          <span v-if="post.author?.name">• {{ post.author.name }}</span>
        </div>
        <h1 class="text-4xl md:text-5xl font-bold tracking-tight mb-6">
          {{ post.title }}
        </h1>
        <div v-if="post.coverImage" class="rounded-xl overflow-hidden shadow-lg mb-8">
          <img :src="post.coverImage" :alt="post.title" class="w-full h-auto">
        </div>
      </header>

      <div class="prose prose-lg dark:prose-invert max-w-none mx-auto" v-html="renderedContent" />

      <hr class="my-12 border-border">

      <div class="flex justify-between items-center">
        <NuxtLink to="/" class="text-muted-foreground hover:text-primary transition-colors flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          Back to list
        </NuxtLink>
      </div>
    </article>
  </div>
</template>

<script setup lang="ts">
import MarkdownIt from 'markdown-it'
import type { ApiResponse, Post } from '~/types'

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

const renderedContent = computed(() => {
  if (!post.value?.content)
    return ''
  return md.render(post.value.content)
})

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
</script>

<style>
/* Custom Prose Styles if needed, though Tailwind Typography should handle most */
.prose img {
  border-radius: 0.5rem;
  margin-left: auto;
  margin-right: auto;
}
</style>
