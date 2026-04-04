<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { comicApi, progressApi } from '../lib/api-client'
import { useUserStore } from '../stores/user'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const loading = ref(true)
const error = ref('')
const images = ref<string[]>([])
const chapterTitle = ref('')
const currentPage = ref(1)
const totalPages = ref(0)
const scrollContainer = ref<HTMLElement>()

const loadedImages = new Set<number>()
let saveProgressTimer: number | null = null

async function fetchChapter() {
  loading.value = true
  error.value = ''

  try {
    const slug = route.params.slug as string
    const chapterId = route.params.chapterId as string

    const response = await comicApi.getChapterDetail(slug, chapterId)

    if (response.success && response.data) {
      images.value = response.data.images
      chapterTitle.value = response.data.title
      totalPages.value = response.data.images.length

      if (userStore.user) {
        await loadProgress(response.data.id)
      }
    }
    else {
      error.value = response.error || '加载失败'
    }
  }
  catch (err: any) {
    error.value = err.response?.data?.error || '加载章节失败'
  }
  finally {
    loading.value = false
  }
}

async function loadProgress(chapterId: string) {
  try {
    const response = await progressApi.getReadingProgress(chapterId)
    if (response.success && response.data && !Array.isArray(response.data)) {
      const page = response.data.page
      setTimeout(() => {
        scrollToPage(page)
      }, 100)
    }
  }
  catch (error) {
    console.error('Failed to load progress:', error)
  }
}

function scrollToPage(page: number) {
  if (!scrollContainer.value)
    return

  const images = scrollContainer.value.querySelectorAll('img')
  if (images[page - 1]) {
    images[page - 1].scrollIntoView({ behavior: 'smooth' })
  }
}

function onImageLoad(index: number) {
  loadedImages.add(index)
}

function handleScroll() {
  if (!scrollContainer.value)
    return

  const container = scrollContainer.value
  const images = container.querySelectorAll('img')

  let visiblePage = 1
  for (let i = 0; i < images.length; i++) {
    const rect = images[i].getBoundingClientRect()
    if (rect.top < window.innerHeight / 2 && rect.bottom > window.innerHeight / 2) {
      visiblePage = i + 1
      break
    }
  }

  currentPage.value = visiblePage

  if (userStore.user) {
    debounceSaveProgress(visiblePage)
  }
}

function debounceSaveProgress(page: number) {
  if (saveProgressTimer) {
    clearTimeout(saveProgressTimer)
  }

  saveProgressTimer = window.setTimeout(async () => {
    try {
      const chapterId = `${route.params.slug}-${route.params.chapterId}`
      await progressApi.saveReadingProgress(chapterId, page)
    }
    catch (error) {
      console.error('Failed to save progress:', error)
    }
  }, 1000)
}

function goBack() {
  router.back()
}

onMounted(() => {
  fetchChapter()
})

onUnmounted(() => {
  if (saveProgressTimer) {
    clearTimeout(saveProgressTimer)
  }
})
</script>

<template>
  <div class="fixed inset-0 bg-black z-50">
    <div class="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/80 to-transparent p-4 z-10">
      <div class="container mx-auto flex items-center justify-between">
        <button
          class="text-white hover:text-primary-400 transition flex items-center gap-2"
          @click="goBack"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
          返回
        </button>

        <div class="text-white text-center">
          <h2 class="text-lg font-medium">
            {{ chapterTitle }}
          </h2>
          <p class="text-sm text-gray-400">
            {{ currentPage }} / {{ totalPages }}
          </p>
        </div>

        <div class="w-16" />
      </div>
    </div>

    <div
      v-if="loading"
      class="flex items-center justify-center h-full"
    >
      <div class="text-white text-lg">
        加载中...
      </div>
    </div>

    <div
      v-else-if="error"
      class="flex items-center justify-center h-full"
    >
      <div class="text-red-500 text-lg">
        {{ error }}
      </div>
    </div>

    <div
      v-else
      ref="scrollContainer"
      class="h-full overflow-y-auto scrollbar-hide"
      @scroll="handleScroll"
    >
      <div class="max-w-4xl mx-auto py-20">
        <img
          v-for="(image, index) in images"
          :key="index"
          :src="image"
          :alt="`第 ${index + 1} 页`"
          class="w-full mb-1"
          loading="lazy"
          @load="onImageLoad(index)"
        >
      </div>
    </div>
  </div>
</template>
