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
  <div class="reader-shell fixed inset-0 z-50">
    <div class="reader-topbar absolute left-0 right-0 top-0 z-10 p-4">
      <div class="mx-auto flex max-w-[96rem] items-center justify-between gap-4">
        <button
          class="ui-reader-button"
          @click="goBack"
        >
          <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
          返回
        </button>

        <div class="reader-title text-center">
          <h2 class="text-lg font-medium">
            {{ chapterTitle || '漫画阅读器' }}
          </h2>
          <p class="reader-muted text-sm" data-page-counter>
            {{ displayCurrentPage }} / {{ totalPages }}
          </p>
        </div>

        <div class="w-16" />
      </div>
    </div>

    <div v-if="loading" class="reader-state flex h-full items-center justify-center">
      <div class="text-lg">
        加载中...
      </div>
    </div>

    <div v-else-if="error" class="reader-state reader-state-error flex h-full items-center justify-center">
      <div class="text-lg">
        {{ error }}
      </div>
    </div>

    <div
      v-else
      ref="scrollContainer"
      data-scroll-container
      class="reader-scroll h-full overflow-y-auto scrollbar-hide"
      @scroll="handleScroll"
    >
      <div class="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-20">
        <div
          v-if="chapterRenderState === 'partial_failed'"
          data-partial-failure
          class="reader-alert reader-alert-warning rounded-[var(--ui-radius-lg)] border p-4"
        >
          <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p class="text-base font-medium">
                {{ failedCount }} 页加载失败，阅读仍可继续
              </p>
              <p class="reader-muted text-sm">
                失败页会保留页码和原图入口，进度保存只会在至少有一页成功加载时允许标记为已读完。
              </p>
            </div>
            <button
              data-retry-failed
              class="ui-reader-button"
              @click="retryFailedPages"
            >
              重试失败页
            </button>
          </div>
        </div>

        <div
          v-if="chapterRenderState === 'all_failed' || chapterRenderState === 'empty'"
          data-chapter-failure
          class="reader-alert reader-alert-danger rounded-[var(--ui-radius-lg)] border p-8 text-center"
        >
          <h3 class="text-2xl font-semibold">
            {{ chapterRenderState === 'empty' ? '本章暂时没有可显示的图片' : '整章图片均加载失败' }}
          </h3>
          <p class="reader-muted mt-3 text-sm">
            {{ chapterRenderState === 'empty' ? '接口返回了 0 张图片，请稍后重试本章。' : `已尝试加载 ${totalPages} 张图片，但当前没有任何成功页。` }}
          </p>
          <div class="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              class="ui-reader-button"
              @click="goBack"
            >
              返回目录
            </button>
            <button
              data-retry-chapter
              class="ui-reader-button"
              @click="retryChapter"
            >
              重试本章
            </button>
            <button
              data-open-first-original
              class="ui-reader-button"
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
            class="reader-page overflow-hidden rounded-[var(--ui-radius-lg)] border"
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
              class="reader-page-error flex min-h-[40vh] flex-col items-center justify-center gap-4 px-6 py-10 text-center"
              :data-page-error="page.pageNumber"
            >
              <div class="space-y-2">
                <p class="text-lg font-semibold">
                  第 {{ page.pageNumber }} 页加载失败
                </p>
                <p class="reader-muted mx-auto max-w-2xl break-all text-sm">
                  {{ page.originalUrl }}
                </p>
              </div>

              <div class="flex flex-wrap items-center justify-center gap-3">
                <button
                  class="ui-reader-button"
                  :data-retry-page="page.pageNumber"
                  @click="retryPage(page.pageNumber)"
                >
                  重试此页
                </button>
                <button
                  class="ui-reader-button"
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

<style scoped>
.reader-shell {
  --background: 220 15% 8%;
  --foreground: 0 0% 98%;
  --card: 220 13% 13%;
  --card-foreground: 0 0% 98%;
  --popover: 220 13% 13%;
  --popover-foreground: 0 0% 98%;
  --muted: 220 12% 17%;
  --muted-foreground: 220 9% 68%;
  --accent: 220 12% 20%;
  --accent-foreground: 0 0% 98%;
  --border: 220 10% 28%;
  --input: 220 10% 28%;
  --primary: 25 95% 53%;
  --primary-foreground: 0 0% 100%;
  --ring: 25 95% 53%;
  --status-danger: 0 72% 58%;
  --status-danger-soft: 0 50% 17%;
  --status-warning: 36 90% 60%;
  --status-warning-soft: 36 50% 17%;
  background: hsl(var(--background));
  color: hsl(var(--foreground));
}

.reader-topbar {
  background: hsl(var(--background) / 0.88);
  border-bottom: 1px solid hsl(var(--border) / 0.7);
  backdrop-filter: blur(14px);
}

.reader-title {
  color: hsl(var(--foreground));
}

.reader-muted {
  color: hsl(var(--muted-foreground));
}

.reader-state {
  color: hsl(var(--foreground));
}

.reader-state-error {
  color: hsl(var(--status-danger));
}

.reader-alert-warning {
  border-color: hsl(var(--status-warning) / 0.42);
  background: hsl(var(--status-warning-soft));
  color: hsl(var(--status-warning));
}

.reader-alert-danger {
  border-color: hsl(var(--status-danger) / 0.42);
  background: hsl(var(--status-danger-soft));
  color: hsl(var(--status-danger));
}

.reader-page {
  border-color: hsl(var(--border) / 0.72);
  background: hsl(var(--card));
  box-shadow: 0 20px 60px hsl(0 0% 0% / 0.35);
}

.reader-page-error {
  color: hsl(var(--foreground));
}

@media (max-width: 640px) {
  .reader-topbar {
    padding: var(--ui-space-3);
  }

  .reader-title h2 {
    max-width: 12rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
</style>
