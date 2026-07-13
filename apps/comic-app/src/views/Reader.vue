<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { comicApi, progressApi } from '../lib/api-client'
import { useUserStore } from '../stores/user'

type ReaderPageStatus = 'idle' | 'loaded' | 'error'
type ChapterRenderState = 'ready' | 'partial_failed' | 'all_failed' | 'empty'

interface ReaderPage {
  pageNumber: number
  originalUrl: string
  status: ReaderPageStatus
  retryKey: number
}

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const loading = ref(true)
const error = ref('')
const readerPages = ref<ReaderPage[]>([])
const chapterTitle = ref('')
const currentPage = ref(0)
const totalPages = ref(0)
const scrollContainer = ref<HTMLElement | null>(null)

let saveProgressTimer: number | null = null
const chapterContentId = ref('')
const wasCompleted = ref(false)

const successfulPageCount = computed(() =>
  readerPages.value.filter(page => page.status === 'loaded').length,
)

const failedPages = computed(() =>
  readerPages.value.filter(page => page.status === 'error'),
)

const failedCount = computed(() => failedPages.value.length)
const settledCount = computed(() =>
  readerPages.value.filter(page => page.status !== 'idle').length,
)

const chapterRenderState = computed<ChapterRenderState>(() => {
  if (readerPages.value.length === 0) {
    return 'empty'
  }

  if (
    failedCount.value === readerPages.value.length
    && settledCount.value === readerPages.value.length
  ) {
    return 'all_failed'
  }

  if (failedCount.value > 0) {
    return 'partial_failed'
  }

  return 'ready'
})

const displayCurrentPage = computed(() =>
  totalPages.value > 0 ? currentPage.value : 0,
)

const firstOriginalUrl = computed(() =>
  readerPages.value[0]?.originalUrl ?? '',
)

function buildReaderPages(images: string[]): ReaderPage[] {
  return images.map((originalUrl, index) => ({
    pageNumber: index + 1,
    originalUrl,
    status: 'idle',
    retryKey: 0,
  }))
}

function normalizePage(page: number) {
  if (totalPages.value === 0) {
    return 0
  }

  return Math.min(Math.max(page, 1), totalPages.value)
}

function canMarkCompleted(page: number) {
  return totalPages.value > 0
    && successfulPageCount.value > 0
    && page >= totalPages.value
}

function updateReaderPage(pageNumber: number, updater: (page: ReaderPage) => void) {
  const page = readerPages.value.find(item => item.pageNumber === pageNumber)
  if (!page) {
    return
  }

  updater(page)
}

async function fetchChapter() {
  loading.value = true
  error.value = ''
  readerPages.value = []
  chapterTitle.value = ''
  totalPages.value = 0
  currentPage.value = 0
  chapterContentId.value = ''

  try {
    const slug = route.params.slug as string
    const chapterId = route.params.chapterId as string

    const response = await comicApi.getChapterDetail(slug, chapterId)

    if (response.success && response.data) {
      chapterContentId.value = response.data.id
      chapterTitle.value = response.data.title
      readerPages.value = buildReaderPages(response.data.images)
      totalPages.value = readerPages.value.length
      currentPage.value = totalPages.value > 0 ? 1 : 0

      if (userStore.user) {
        await loadProgress(response.data.id)
      }
    }
    else {
      error.value = response.error || '加载失败'
    }
  }
  catch (err: any) {
    error.value = err?.response?.data?.error || err?.message || '加载章节失败'
  }
  finally {
    loading.value = false
  }
}

async function loadProgress(chapterId: string) {
  try {
    const response = await progressApi.getReadingProgress(chapterId)
    if (response.success && response.data && !Array.isArray(response.data)) {
      wasCompleted.value = response.data.completed
      const restoredPage = response.data.completed ? 1 : response.data.page
      const page = normalizePage(restoredPage || 1)

      currentPage.value = page
      if (page > 0) {
        setTimeout(() => {
          scrollToPage(page)
        }, 100)
      }

      if (response.data.completed) {
        clearCompletedIfRestarting(page)
      }
    }
  }
  catch (loadError) {
    console.error('Failed to load progress:', loadError)
  }
}

function scrollToPage(page: number) {
  if (!scrollContainer.value || page <= 0) {
    return
  }

  const pageContainers = scrollContainer.value.querySelectorAll<HTMLElement>('.reader-page')
  pageContainers[page - 1]?.scrollIntoView({ behavior: 'smooth' })
}

function onPageLoad(pageNumber: number) {
  updateReaderPage(pageNumber, (page) => {
    page.status = 'loaded'
  })
}

function handleImageError(pageNumber: number) {
  updateReaderPage(pageNumber, (page) => {
    page.status = 'error'
  })
}

function retryPage(pageNumber: number) {
  updateReaderPage(pageNumber, (page) => {
    page.status = 'idle'
    page.retryKey += 1
  })
}

function retryFailedPages() {
  for (const page of failedPages.value) {
    retryPage(page.pageNumber)
  }
}

function retryChapter() {
  void fetchChapter()
}

function openOriginal(url: string) {
  if (!url) {
    return
  }

  window.open(url, '_blank', 'noopener,noreferrer')
}

function handleScroll() {
  if (!scrollContainer.value) {
    return
  }

  const pageContainers = scrollContainer.value.querySelectorAll<HTMLElement>('.reader-page')
  if (pageContainers.length === 0) {
    currentPage.value = totalPages.value > 0 ? currentPage.value : 0
    return
  }

  const viewportMidpoint = window.innerHeight / 2
  let visiblePage = 1

  for (let i = 0; i < pageContainers.length; i++) {
    const rect = pageContainers[i].getBoundingClientRect()

    if (rect.top <= viewportMidpoint) {
      visiblePage = i + 1
    }

    if (rect.top <= viewportMidpoint && rect.bottom >= viewportMidpoint) {
      visiblePage = i + 1
      break
    }
  }

  currentPage.value = normalizePage(visiblePage)

  if (userStore.user && currentPage.value > 0) {
    debounceSaveProgress(currentPage.value, canMarkCompleted(currentPage.value))
  }
}

async function persistProgress(page: number, completed: boolean) {
  if (!chapterContentId.value || totalPages.value === 0) {
    return
  }

  await progressApi.saveReadingProgress(
    chapterContentId.value,
    normalizePage(page),
    completed,
  )
  wasCompleted.value = completed
}

function debounceSaveProgress(page: number, completed: boolean) {
  if (saveProgressTimer) {
    clearTimeout(saveProgressTimer)
  }

  saveProgressTimer = window.setTimeout(async () => {
    try {
      await persistProgress(page, completed)
    }
    catch (saveError) {
      console.error('Failed to save progress:', saveError)
    }
  }, 500)
}

function clearCompletedIfRestarting(page: number) {
  if (!wasCompleted.value || page !== 1 || !userStore.user || !chapterContentId.value) {
    return
  }

  saveProgressTimer = window.setTimeout(async () => {
    try {
      await persistProgress(1, false)
    }
    catch (resetError) {
      console.error('Failed to reset completed reading progress:', resetError)
    }
  }, 0)
}

function handlePageHide() {
  if (!userStore.user || !chapterContentId.value || totalPages.value === 0) {
    return
  }

  void persistProgress(
    currentPage.value,
    canMarkCompleted(currentPage.value),
  ).catch((saveError) => {
    console.error('Failed to save progress on pagehide:', saveError)
  })
}

function goBack() {
  router.back()
}

onMounted(() => {
  window.addEventListener('pagehide', handlePageHide)
  void fetchChapter()
})

onUnmounted(() => {
  window.removeEventListener('pagehide', handlePageHide)
  handlePageHide()
  if (saveProgressTimer) {
    clearTimeout(saveProgressTimer)
  }
})
</script>

<template>
  <div class="fixed inset-0 z-50 bg-black">
    <div class="absolute left-0 right-0 top-0 z-10 bg-gradient-to-b from-black/80 to-transparent p-4">
      <div class="container mx-auto flex items-center justify-between gap-4">
        <button
          class="flex items-center gap-2 text-white transition hover:text-primary-400"
          @click="goBack"
        >
          <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
          返回
        </button>

        <div class="text-center text-white">
          <h2 class="text-lg font-medium">
            {{ chapterTitle || '漫画阅读器' }}
          </h2>
          <p class="text-sm text-gray-400" data-page-counter>
            {{ displayCurrentPage }} / {{ totalPages }}
          </p>
        </div>

        <div class="w-16" />
      </div>
    </div>

    <div v-if="loading" class="flex h-full items-center justify-center">
      <div class="text-lg text-white">
        加载中...
      </div>
    </div>

    <div v-else-if="error" class="flex h-full items-center justify-center">
      <div class="text-lg text-red-500">
        {{ error }}
      </div>
    </div>

    <div
      v-else
      ref="scrollContainer"
      data-scroll-container
      class="h-full overflow-y-auto scrollbar-hide"
      @scroll="handleScroll"
    >
      <div class="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-20">
        <div
          v-if="chapterRenderState === 'partial_failed'"
          data-partial-failure
          class="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-amber-100"
        >
          <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p class="text-base font-medium">
                {{ failedCount }} 页加载失败，阅读仍可继续
              </p>
              <p class="text-sm text-amber-200/80">
                失败页会保留页码和原图入口，进度保存只会在至少有一页成功加载时允许标记为已读完。
              </p>
            </div>
            <button
              data-retry-failed
              class="rounded-full border border-amber-300/60 px-4 py-2 text-sm font-medium text-amber-50 transition hover:bg-amber-300/10"
              @click="retryFailedPages"
            >
              重试失败页
            </button>
          </div>
        </div>

        <div
          v-if="chapterRenderState === 'all_failed' || chapterRenderState === 'empty'"
          data-chapter-failure
          class="rounded-3xl border border-red-500/30 bg-red-500/10 p-8 text-center text-red-50"
        >
          <h3 class="text-2xl font-semibold">
            {{ chapterRenderState === 'empty' ? '本章暂时没有可显示的图片' : '整章图片均加载失败' }}
          </h3>
          <p class="mt-3 text-sm text-red-100/80">
            {{ chapterRenderState === 'empty' ? '接口返回了 0 张图片，请稍后重试本章。' : `已尝试加载 ${totalPages} 张图片，但当前没有任何成功页。` }}
          </p>
          <div class="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              class="rounded-full border border-white/30 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
              @click="goBack"
            >
              返回目录
            </button>
            <button
              data-retry-chapter
              class="rounded-full border border-red-200/50 px-4 py-2 text-sm font-medium text-red-50 transition hover:bg-red-200/10"
              @click="retryChapter"
            >
              重试本章
            </button>
            <button
              data-open-first-original
              class="rounded-full border border-red-200/50 px-4 py-2 text-sm font-medium text-red-50 transition hover:bg-red-200/10 disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="!firstOriginalUrl"
              @click="openOriginal(firstOriginalUrl)"
            >
              打开原图
            </button>
          </div>
        </div>

        <div v-else class="flex flex-col gap-2">
          <article
            v-for="page in readerPages"
            :key="page.pageNumber"
            class="reader-page overflow-hidden rounded-2xl border border-white/5 bg-white/[0.02] shadow-[0_20px_60px_rgba(0,0,0,0.35)]"
            :data-reader-page="page.pageNumber"
          >
            <img
              v-if="page.status !== 'error'"
              :key="`${page.pageNumber}-${page.retryKey}`"
              :data-page-image="page.pageNumber"
              :src="page.originalUrl"
              :alt="`第 ${page.pageNumber} 页`"
              class="w-full"
              loading="lazy"
              @load="onPageLoad(page.pageNumber)"
              @error="handleImageError(page.pageNumber)"
            >

            <div
              v-else
              class="flex min-h-[40vh] flex-col items-center justify-center gap-4 px-6 py-10 text-center text-white"
              :data-page-error="page.pageNumber"
            >
              <div class="space-y-2">
                <p class="text-lg font-semibold">
                  第 {{ page.pageNumber }} 页加载失败
                </p>
                <p class="mx-auto max-w-2xl break-all text-sm text-gray-300">
                  {{ page.originalUrl }}
                </p>
              </div>

              <div class="flex flex-wrap items-center justify-center gap-3">
                <button
                  class="rounded-full border border-white/30 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
                  :data-retry-page="page.pageNumber"
                  @click="retryPage(page.pageNumber)"
                >
                  重试此页
                </button>
                <button
                  class="rounded-full border border-red-300/50 px-4 py-2 text-sm font-medium text-red-100 transition hover:bg-red-300/10"
                  :data-open-page="page.pageNumber"
                  @click="openOriginal(page.originalUrl)"
                >
                  打开原图
                </button>
              </div>
            </div>
          </article>
        </div>
      </div>
    </div>
  </div>
</template>
