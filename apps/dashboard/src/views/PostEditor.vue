<script setup lang="ts">
import { authClient } from '@/lib/auth-client'
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
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
    const response = await authClient.fetch(`${import.meta.env.VITE_API_URL}/api/posts/admin/${route.params.id}`)
    if (response.error) throw response.error
    
    const post = response.data.data
    
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
          <span class="sr-only">{{ t('dashboard.back') }}</span>
          ←
        </button>
        <h1 class="text-3xl font-bold tracking-tight">{{ isNew ? t('dashboard.new_post') : t('dashboard.edit_post') }}</h1>
      </div>
      <div class="flex gap-2">
        <button 
          @click="save" 
          :disabled="saving"
          class="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
        >
          {{ saving ? t('dashboard.saving') : t('dashboard.save') }}
        </button>
      </div>
    </div>

    <div v-if="loading" class="py-10 text-center">{{ t('dashboard.saving') }}</div>
    
    <div v-else class="grid gap-6">
      <div class="grid gap-4 md:grid-cols-2">
        <div class="space-y-2">
          <label class="text-sm font-medium leading-none">{{ t('dashboard.title') }}</label>
          <input 
            v-model="form.title" 
            @blur="generateSlug"
            class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
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
          type="checkbox" 
          id="published" 
          v-model="form.published"
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