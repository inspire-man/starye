<script setup lang="ts">
import type { Post } from '@starye/db/schema'
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { authClient } from '@/lib/auth-client'

// API 返回的 Post 类型（包含 author 关系）
interface PostWithAuthor extends Pick<Post, 'id' | 'title' | 'slug' | 'published' | 'createdAt' | 'updatedAt'> {
  author?: {
    name: string
    image?: string | null
  } | null
}

// API 响应类型
interface PostsListResponse {
  data: {
    data: PostWithAuthor[]
    meta: {
      total: number
      page: number
      limit: number
      totalPages: number
    }
  }
  error?: never
}

interface ApiSuccessResponse {
  data: {
    success: true
  }
  error?: never
}

const router = useRouter()
const { t } = useI18n()
const posts = ref<PostWithAuthor[]>([])
const loading = ref(false)
const error = ref('')
const deleteError = ref('')
const deleteConfirmId = ref<string | null>(null)

async function fetchPosts() {
  loading.value = true
  try {
    // Admin request to get all posts including drafts
    const response = await authClient.$fetch<PostsListResponse>(`${import.meta.env.VITE_API_URL}/api/posts?draft=true&limit=50`)
    if (response.error)
      throw response.error

    // 类型守卫：确保响应格式正确
    if (!response.data || typeof response.data !== 'object' || !('data' in response.data))
      throw new Error('Invalid response format')

    const apiData = response.data as unknown as { data: PostWithAuthor[], meta: unknown }
    posts.value = apiData.data
  }
  catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to fetch posts'
    error.value = message
  }
  finally {
    loading.value = false
  }
}

function formatDate(date: Date | string | null) {
  if (!date)
    return ''
  return new Date(date).toLocaleDateString()
}

function editPost(id: string) {
  router.push(`/posts/${id}`)
}

async function createPost() {
  router.push('/posts/new')
}

function requestDelete(id: string) {
  deleteConfirmId.value = id
  deleteError.value = ''
}

function cancelDelete() {
  deleteConfirmId.value = null
  deleteError.value = ''
}

async function confirmDelete() {
  if (!deleteConfirmId.value)
    return

  const id = deleteConfirmId.value
  deleteConfirmId.value = null

  try {
    const response = await authClient.$fetch<ApiSuccessResponse>(`${import.meta.env.VITE_API_URL}/api/posts/${id}`, {
      method: 'DELETE',
    })

    if (response.error)
      throw response.error

    posts.value = posts.value.filter(p => p.id !== id)
  }
  catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to delete post'
    deleteError.value = message
  }
}

onMounted(() => {
  fetchPosts()
})
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-3xl font-bold tracking-tight">
          {{ t('dashboard.blog_posts') }}
        </h1>
        <p class="text-muted-foreground">
          {{ t('dashboard.manage_blog') }}
        </p>
      </div>
      <button
        class="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
        @click="createPost"
      >
        {{ t('dashboard.new_post') }}
      </button>
    </div>

    <div v-if="loading" class="py-10 text-center">
      {{ t('dashboard.saving') }}
    </div>
    <div v-else-if="error" class="rounded-md border border-destructive bg-destructive/10 p-4 text-destructive">
      {{ error }}
    </div>

    <div v-if="deleteError" class="rounded-md border border-destructive bg-destructive/10 p-4 text-destructive">
      {{ deleteError }}
      <button class="ml-2 text-sm underline" @click="deleteError = ''">
        {{ t('dashboard.dismiss') || 'Dismiss' }}
      </button>
    </div>

    <div v-if="deleteConfirmId" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div class="rounded-md border bg-card p-6 shadow-lg max-w-md w-full mx-4">
        <h3 class="text-lg font-semibold mb-2">
          {{ t('dashboard.confirm_delete') || 'Confirm Delete' }}
        </h3>
        <p class="text-muted-foreground mb-4">
          {{ t('dashboard.delete_confirm') }}
        </p>
        <div class="flex justify-end gap-2">
          <button
            class="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
            @click="cancelDelete"
          >
            {{ t('dashboard.cancel') || 'Cancel' }}
          </button>
          <button
            class="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-destructive text-destructive-foreground hover:bg-destructive/90 h-10 px-4 py-2"
            @click="confirmDelete"
          >
            {{ t('dashboard.delete') }}
          </button>
        </div>
      </div>
    </div>

    <div v-else-if="!error" class="rounded-md border bg-card">
      <div class="relative w-full overflow-auto">
        <table class="w-full caption-bottom text-sm">
          <thead class="[&_tr]:border-b">
            <tr class="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
              <th class="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                {{ t('dashboard.title') }}
              </th>
              <th class="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                {{ t('dashboard.slug') }}
              </th>
              <th class="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                {{ t('dashboard.status') }}
              </th>
              <th class="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                {{ t('dashboard.date') }}
              </th>
              <th class="h-12 px-4 text-right align-middle font-medium text-muted-foreground">
                {{ t('dashboard.actions') }}
              </th>
            </tr>
          </thead>
          <tbody class="[&_tr:last-child]:border-0">
            <tr v-for="post in posts" :key="post.id" class="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
              <td class="p-4 align-middle font-medium">
                {{ post.title }}
              </td>
              <td class="p-4 align-middle text-muted-foreground">
                {{ post.slug }}
              </td>
              <td class="p-4 align-middle">
                <span
                  class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  :class="post.published ? 'border-transparent bg-primary text-primary-foreground hover:bg-primary/80' : 'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80'"
                >
                  {{ post.published ? t('dashboard.published') : t('dashboard.draft') }}
                </span>
              </td>
              <td class="p-4 align-middle text-muted-foreground">
                {{ formatDate(post.createdAt) }}
              </td>
              <td class="p-4 align-middle text-right">
                <div class="flex justify-end gap-2">
                  <button class="text-sm font-medium hover:underline" @click="editPost(post.id)">
                    {{ t('dashboard.edit') }}
                  </button>
                  <button class="text-sm font-medium text-destructive hover:underline" @click="requestDelete(post.id)">
                    {{ t('dashboard.delete') }}
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
