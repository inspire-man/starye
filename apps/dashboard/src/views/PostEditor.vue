<script setup lang="ts">
import type { Post } from '@starye/db/schema'
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { authClient } from '@/lib/auth-client'

// API 响应类型定义
interface ApiSuccessResponse {
  data: {
    success: true
    id?: string
    slug?: string
  }
  error?: never
}

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const isNew = route.params.id === 'new'
const loading = ref(false)
const saving = ref(false)
const error = ref('')

const form = ref({
  title: '',
  slug: '',
  excerpt: '',
  content: '',
  coverImage: '',
  published: false,
})

// Auto-generate slug from title
function generateSlug() {
  if (!form.value.title)
    return
  // Only generate if slug is empty or was auto-generated
  // Simple slugify
  const slug = form.value.title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')

  if (!form.value.slug) {
    form.value.slug = slug
  }
}

async function fetchPost() {
  if (isNew)
    return

  loading.value = true
  try {
    const response = await authClient.$fetch(`${import.meta.env.VITE_API_URL}/api/posts/admin/${route.params.id}`)
    if (response.error)
      throw response.error

    // 类型守卫：确保响应格式正确
    if (!response.data || typeof response.data !== 'object' || !('data' in response.data))
      throw new Error('Invalid response format')

    const apiData = response.data as { data: Post }
    const post = apiData.data

    form.value = {
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt || '',
      content: post.content || '',
      coverImage: post.coverImage || '',
      published: post.published ?? false,
    }
  }
  catch (e) {
    console.error(e)
    error.value = 'Failed to load post'
    setTimeout(() => {
      router.push('/posts')
    }, 2000)
  }
  finally {
    loading.value = false
  }
}

async function save() {
  saving.value = true
  try {
    const url = isNew
      ? `${import.meta.env.VITE_API_URL}/api/posts`
      : `${import.meta.env.VITE_API_URL}/api/posts/${route.params.id}`

    const method = isNew ? 'POST' : 'PUT'

    const response = await authClient.$fetch<ApiSuccessResponse>(url, {
      method,
      body: JSON.stringify(form.value),
    })

    if (response.error)
      throw response.error

    router.push('/posts')
  }
  catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to save'
    error.value = message
  }
  finally {
    saving.value = false
  }
}

onMounted(() => {
  fetchPost()
})
</script>

<template>
  <div class="max-w-4xl mx-auto space-y-6">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-4">
        <button class="p-2 hover:bg-muted rounded-full" @click="router.back()">
          <span class="sr-only">{{ t('dashboard.back') }}</span>
          ←
        </button>
        <h1 class="text-3xl font-bold tracking-tight">
          {{ isNew ? t('dashboard.new_post') : t('dashboard.edit_post') }}
        </h1>
      </div>
      <div class="flex gap-2">
        <button
          :disabled="saving"
          class="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
          @click="save"
        >
          {{ saving ? t('dashboard.saving') : t('dashboard.save') }}
        </button>
      </div>
    </div>

    <div v-if="loading" class="py-10 text-center">
      {{ t('dashboard.saving') }}
    </div>

    <div v-if="error" class="rounded-md border border-destructive bg-destructive/10 p-4 text-destructive">
      {{ error }}
      <button class="ml-2 text-sm underline" @click="error = ''">
        {{ t('dashboard.dismiss') || 'Dismiss' }}
      </button>
    </div>

    <div v-else-if="!loading" class="grid gap-6">
      <div class="grid gap-4 md:grid-cols-2">
        <div class="space-y-2">
          <label class="text-sm font-medium leading-none">{{ t('dashboard.title') }}</label>
          <input
            v-model="form.title"
            class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            @blur="generateSlug"
          >
        </div>

        <div class="space-y-2">
          <label class="text-sm font-medium leading-none">{{ t('dashboard.slug') }}</label>
          <input
            v-model="form.slug"
            class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
        </div>
      </div>

      <div class="space-y-2">
        <label class="text-sm font-medium leading-none">{{ t('dashboard.excerpt') }}</label>
        <textarea
          v-model="form.excerpt"
          class="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>

      <div class="space-y-2">
        <label class="text-sm font-medium leading-none">{{ t('dashboard.cover_image') }}</label>
        <input
          v-model="form.coverImage"
          class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
      </div>

      <div class="flex items-center space-x-2">
        <input
          id="published"
          v-model="form.published"
          type="checkbox"
          class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
        >
        <label for="published" class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
          {{ t('dashboard.published') }}
        </label>
      </div>

      <div class="space-y-2">
        <label class="text-sm font-medium leading-none">{{ t('dashboard.content_markdown') }}</label>
        <textarea
          v-model="form.content"
          class="flex min-h-[400px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 font-mono"
        />
      </div>
    </div>
  </div>
</template>
