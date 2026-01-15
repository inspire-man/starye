<script setup lang="ts">
import { authClient } from '@/lib/auth-client'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

interface Post {
  id: string
  title: string
  slug: string
  published: boolean
  createdAt: string
  updatedAt: string
  author?: {
    name: string
  }
}

const router = useRouter()
const posts = ref<Post[]>([])
const loading = ref(false)
const error = ref('')

const { data: session } = authClient.useSession()
const token = computed(() => session.value?.user ? 'authenticated' : '') // Just a trigger, actual auth is cookie

async function fetchPosts() {
  loading.value = true
  try {
    // Admin request to get all posts including drafts
    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/posts?draft=true&limit=50`, {
      headers: {
        // Ensure credentials are sent
      },
    })
    if (!response.ok)
      throw new Error('Failed to fetch posts')
    const data = await response.json()
    posts.value = data.data
  }
  catch (e: any) {
    error.value = e.message
  }
  finally {
    loading.value = false
  }
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString()
}

function editPost(id: string) {
  router.push(`/posts/${id}`)
}

async function createPost() {
  router.push('/posts/new')
}

async function deletePost(id: string) {
  if (!confirm('Are you sure you want to delete this post?'))
    return

  try {
    const response = await authClient.fetch(`${import.meta.env.VITE_API_URL}/api/posts/${id}`, {
      method: 'DELETE',
    })
    
    if (response.error) throw response.error

    posts.value = posts.value.filter(p => p.id !== id)
  }
  catch (e: any) {
    alert(e.message || 'Failed to delete post')
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
        <h1 class="text-3xl font-bold tracking-tight">Blog Posts</h1>
        <p class="text-muted-foreground">Manage your blog content.</p>
      </div>
      <button 
        @click="createPost"
        class="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
      >
        New Post
      </button>
    </div>

    <div v-if="loading" class="py-10 text-center">Loading...</div>
    <div v-else-if="error" class="text-destructive">{{ error }}</div>

    <div v-else class="rounded-md border bg-card">
      <div class="relative w-full overflow-auto">
        <table class="w-full caption-bottom text-sm">
          <thead class="[&_tr]:border-b">
            <tr class="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
              <th class="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Title</th>
              <th class="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Slug</th>
              <th class="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Status</th>
              <th class="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Date</th>
              <th class="h-12 px-4 text-right align-middle font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody class="[&_tr:last-child]:border-0">
            <tr v-for="post in posts" :key="post.id" class="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
              <td class="p-4 align-middle font-medium">{{ post.title }}</td>
              <td class="p-4 align-middle text-muted-foreground">{{ post.slug }}</td>
              <td class="p-4 align-middle">
                <span 
                  class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  :class="post.published ? 'border-transparent bg-primary text-primary-foreground hover:bg-primary/80' : 'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80'"
                >
                  {{ post.published ? 'Published' : 'Draft' }}
                </span>
              </td>
              <td class="p-4 align-middle text-muted-foreground">{{ formatDate(post.createdAt) }}</td>
              <td class="p-4 align-middle text-right">
                <div class="flex justify-end gap-2">
                  <button @click="editPost(post.id)" class="text-sm font-medium hover:underline">Edit</button>
                  <button @click="deletePost(post.id)" class="text-sm font-medium text-destructive hover:underline">Delete</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
