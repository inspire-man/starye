<script setup lang="ts">
import { authClient } from '@/lib/auth-client'
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()
const isNew = route.params.id === 'new'
const loading = ref(false)
const saving = ref(false)

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
  if (!form.value.title) return
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
  if (isNew) return
  
  loading.value = true
  try {
    // Use public endpoint to get data by slug? No, we have ID.
    // Actually the API for details uses slug.
    // But list returns ID.
    // Wait, the API I wrote:
    // GET /:slug -> returns by slug.
    // PUT /:id -> updates by ID.
    // This creates a mismatch if I only have ID.
    // I need an endpoint to get by ID or I need to store slug in the list view (I do).
    // BUT, the editor URL is /posts/:id. 
    // If I use ID to fetch, I need a GET /:id endpoint or search logic.
    // The current GET /:slug might collide if slug looks like ID (UUID).
    // Let's assume for now I can fetch by ID using the list data or I need to add GET /:id support.
    
    // Quick fix: Since I can't easily fetch by ID with current API (it expects slug),
    // I should probably update the API to support GET /:id as well or just /id/:id?
    // Or I can iterate the list if I have it cached? No.
    
    // Let's modify the API logic slightly in my head:
    // Ideally GET /api/posts/:id_or_slug.
    // For now, let's assume the user navigates from list, I could pass the object? No.
    
    // WORKAROUND: For this version, I'll trust that I can fetch the post via a new endpoint or
    // I will fetch the list and find it (inefficient but works for small blog).
    // BETTER: I will add GET /api/posts/id/:id to API or similar.
    // Actually, looking at my API code: `posts.get('/:slug'...)`.
    // I should check if the param is a UUID.
    
    // Let's just implement GET /api/posts/admin/:id in API? 
    // Or just `GET /:id` and check if it matches UUID format?
    // Or just fetch all and find (lazy).
    
    // Let's just fetch the specific post by ID for editing. I'll need to add that endpoint or modify existing.
    // I'll modify the API in the next step to support fetching by ID for admin.
    
    // Assuming endpoint exists:
    const response = await authClient.fetch(`${import.meta.env.VITE_API_URL}/api/posts/admin/${route.params.id}`)
    if (response.error) throw response.error
    
    const post = response.data.data // Wrapper?
    // API returns { data: post }
    
    form.value = {
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt || '',
      content: post.content || '',
      coverImage: post.coverImage || '',
      published: post.published,
    }
  } catch (e) {
    console.error(e)
    alert('Failed to load post')
    router.push('/posts')
  } finally {
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
    
    const response = await authClient.fetch(url, {
      method,
      body: JSON.stringify(form.value),
    })

    if (response.error) throw response.error

    router.push('/posts')
  } catch (e: any) {
    alert(e.message || 'Failed to save')
  } finally {
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
        <button @click="router.back()" class="p-2 hover:bg-muted rounded-full">
          <span class="sr-only">Back</span>
          ←
        </button>
        <h1 class="text-3xl font-bold tracking-tight">{{ isNew ? 'New Post' : 'Edit Post' }}</h1>
      </div>
      <div class="flex gap-2">
        <button 
          @click="save" 
          :disabled="saving"
          class="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
        >
          {{ saving ? 'Saving...' : 'Save' }}
        </button>
      </div>
    </div>

    <div v-if="loading" class="py-10 text-center">Loading...</div>
    
    <div v-else class="grid gap-6">
      <div class="grid gap-4 md:grid-cols-2">
        <div class="space-y-2">
          <label class="text-sm font-medium leading-none">Title</label>
          <input 
            v-model="form.title" 
            @blur="generateSlug"
            class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
        </div>
        
        <div class="space-y-2">
          <label class="text-sm font-medium leading-none">Slug</label>
          <input 
            v-model="form.slug" 
            class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
        </div>
      </div>

      <div class="space-y-2">
        <label class="text-sm font-medium leading-none">Excerpt</label>
        <textarea 
          v-model="form.excerpt"
          class="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>

      <div class="space-y-2">
        <label class="text-sm font-medium leading-none">Cover Image URL</label>
        <input 
          v-model="form.coverImage" 
          class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
      </div>

      <div class="flex items-center space-x-2">
        <input 
          type="checkbox" 
          id="published" 
          v-model="form.published"
          class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
        >
        <label for="published" class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
          Published
        </label>
      </div>

      <div class="space-y-2">
        <label class="text-sm font-medium leading-none">Content (Markdown)</label>
        <textarea 
          v-model="form.content"
          class="flex min-h-[400px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 font-mono"
        />
      </div>
    </div>
  </div>
</template>
