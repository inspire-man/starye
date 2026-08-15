<script setup lang="ts">
import type { Post } from '@starye/db/schema'
import { ConfirmDialog, DataTable, DetailDrawer, Pagination, success, usePagination } from '@starye/ui'
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { handleError } from '@/composables/useErrorHandler'

interface PostWithAuthor extends Pick<Post, 'id' | 'title' | 'slug' | 'published' | 'createdAt' | 'updatedAt'> {
  author?: {
    name: string
    image?: string | null
  } | null
}

interface PostsResponse {
  data?: PostWithAuthor[]
  meta?: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

const router = useRouter()
const { t } = useI18n()
const posts = ref<PostWithAuthor[]>([])
const loading = ref(false)
const deleteConfirmId = ref<string | null>(null)
const selectedPost = ref<PostWithAuthor | null>(null)
const postDrawerOpen = ref(false)
const { currentPage, limit: pageSize, totalPages, total, setMeta, goToPage, updatePageSize } = usePagination(20)

const tableColumns = [
  { key: 'title', label: '标题', minWidth: '260px' },
  { key: 'slug', label: 'Slug', minWidth: '180px' },
  { key: 'published', label: '状态', width: '110px' },
  { key: 'createdAt', label: '创建时间', width: '150px' },
  { key: 'actions', label: '操作', width: '150px' },
]

async function fetchPosts() {
  loading.value = true
  try {
    const params = new URLSearchParams({
      draft: 'true',
      page: String(currentPage.value),
      limit: String(pageSize.value),
    })
    const response = await fetch(`/api/posts?${params.toString()}`, { credentials: 'include' })

    if (!response.ok)
      throw new Error(`HTTP error! status: ${response.status}`)

    const result = await response.json() as PostsResponse
    posts.value = result.data || []
    if (result.meta) {
      setMeta({ total: result.meta.total, totalPages: result.meta.totalPages })
    }
    else {
      setMeta({ total: posts.value.length, totalPages: posts.value.length ? 1 : 0 })
    }
  }
  catch (e: unknown) {
    handleError(e, '加载文章列表失败')
  }
  finally {
    loading.value = false
  }
}

function formatDate(date: Date | string | null) {
  if (!date)
    return ''
  return new Date(date).toLocaleDateString('zh-CN')
}

function editPost(id: string) {
  router.push(`/posts/${id}`)
}

function createPost() {
  router.push('/posts/new')
}

function openPostDetails(post: PostWithAuthor) {
  selectedPost.value = post
  postDrawerOpen.value = true
}

function closePostDetails() {
  postDrawerOpen.value = false
  selectedPost.value = null
}

function requestDelete(id: string) {
  deleteConfirmId.value = id
}

function cancelDelete() {
  deleteConfirmId.value = null
}

async function confirmDelete() {
  if (!deleteConfirmId.value)
    return

  const id = deleteConfirmId.value
  deleteConfirmId.value = null

  try {
    const response = await fetch(`/api/posts/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    })

    if (!response.ok)
      throw new Error(`HTTP error! status: ${response.status}`)

    success('文章已删除')
    await fetchPosts()
  }
  catch (e: unknown) {
    handleError(e, '删除文章失败')
  }
}

watch([currentPage, pageSize], fetchPosts, { immediate: true })
</script>

<template>
  <div class="posts-page dashboard-list-page">
    <ConfirmDialog
      :open="!!deleteConfirmId"
      :title="t('dashboard.confirm_delete') || '确认删除'"
      :message="t('dashboard.delete_confirm')"
      :confirm-text="t('dashboard.delete')"
      :cancel-text="t('dashboard.cancel') || '取消'"
      variant="danger"
      @update:open="!$event && cancelDelete()"
      @confirm="confirmDelete"
    />

    <div class="list-toolbar">
      <span class="list-toolbar-text">{{ t('dashboard.manage_blog') }}</span>
      <button class="list-toolbar-primary" type="button" @click="createPost">
        {{ t('dashboard.new_post') }}
      </button>
    </div>

    <DataTable
      :data="posts"
      :columns="tableColumns"
      :loading="loading"
      min-width="820px"
      :empty-message="t('dashboard.no_data')"
      @row-click="openPostDetails"
    >
      <template #cell-title="{ item }">
        <div class="min-w-0">
          <div class="truncate font-medium text-foreground">
            {{ item.title }}
          </div>
          <div v-if="item.author?.name" class="mt-0.5 text-xs text-muted-foreground">
            {{ item.author.name }}
          </div>
        </div>
      </template>
      <template #cell-slug="{ item }">
        <span class="font-mono text-xs text-muted-foreground">{{ item.slug }}</span>
      </template>
      <template #cell-published="{ item }">
        <span
          class="ui-status-tag"
          :class="item.published ? 'ui-status-success' : 'ui-status-neutral'"
        >
          {{ item.published ? t('dashboard.published') : t('dashboard.draft') }}
        </span>
      </template>
      <template #cell-createdAt="{ item }">
        <span class="text-sm text-muted-foreground">{{ formatDate(item.createdAt) }}</span>
      </template>
      <template #cell-actions="{ item }">
        <div class="flex justify-end gap-1.5" @click.stop>
          <button class="inline-flex h-8 items-center rounded-md border border-border px-2.5 text-xs font-medium transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary" type="button" @click="editPost(item.id)">
            {{ t('dashboard.edit') }}
          </button>
          <button class="inline-flex h-8 items-center rounded-md border border-destructive/25 px-2.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10" type="button" @click="requestDelete(item.id)">
            {{ t('dashboard.delete') }}
          </button>
        </div>
      </template>
    </DataTable>

    <Pagination
      v-if="loading || total > 0"
      :current-page="currentPage"
      :total-pages="totalPages"
      :total="total"
      :loading="loading"
      :page-size="pageSize"
      :page-sizes="[10, 20, 50, 100]"
      layout="total, sizes, prev, pager, next, jumper"
      @update:current-page="goToPage"
      @update:page-size="updatePageSize"
    />

    <DetailDrawer
      :open="postDrawerOpen && !!selectedPost"
      :title="selectedPost?.title || '文章详情'"
      :description="selectedPost?.slug || ''"
      width="md"
      @update:open="$event ? undefined : closePostDetails()"
    >
      <div v-if="selectedPost" class="space-y-5">
        <div class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/30 p-4">
          <div>
            <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              文章状态
            </p>
            <span
              class="ui-status-tag mt-2"
              :class="selectedPost.published ? 'ui-status-success' : 'ui-status-neutral'"
            >
              {{ selectedPost.published ? t('dashboard.published') : t('dashboard.draft') }}
            </span>
          </div>
          <div class="text-right text-sm text-muted-foreground">
            <p>作者</p>
            <p class="mt-1 font-medium text-foreground">
              {{ selectedPost.author?.name || '未填写' }}
            </p>
          </div>
        </div>

        <dl class="divide-y divide-border rounded-xl border border-border">
          <div class="flex items-start justify-between gap-4 px-4 py-3">
            <dt class="text-sm text-muted-foreground">
              Slug
            </dt>
            <dd class="break-all text-right font-mono text-xs">
              {{ selectedPost.slug }}
            </dd>
          </div>
          <div class="flex items-center justify-between gap-4 px-4 py-3">
            <dt class="text-sm text-muted-foreground">
              创建时间
            </dt>
            <dd class="text-sm">
              {{ formatDate(selectedPost.createdAt) }}
            </dd>
          </div>
          <div class="flex items-center justify-between gap-4 px-4 py-3">
            <dt class="text-sm text-muted-foreground">
              更新时间
            </dt>
            <dd class="text-sm">
              {{ formatDate(selectedPost.updatedAt) }}
            </dd>
          </div>
        </dl>
      </div>

      <template #footer>
        <div class="flex justify-end gap-2">
          <button
            class="inline-flex h-9 items-center justify-center rounded-md border border-destructive/25 px-3 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
            type="button"
            @click.stop="requestDelete(selectedPost!.id)"
          >
            {{ t('dashboard.delete') }}
          </button>
          <button
            class="inline-flex h-9 items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            type="button"
            @click.stop="editPost(selectedPost!.id)"
          >
            {{ t('dashboard.edit') }}
          </button>
        </div>
      </template>
    </DetailDrawer>
  </div>
</template>
