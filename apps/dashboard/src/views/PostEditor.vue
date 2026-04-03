<script setup lang="ts">
import type { Post } from '@starye/db/schema'
import type { IDomEditor, IEditorConfig, IToolbarConfig } from '@wangeditor/editor'
import { Editor, Toolbar } from '@wangeditor/editor-for-vue'
import { onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { handleError } from '@/composables/useErrorHandler'
import { authClient } from '@/lib/auth-client'

import '@wangeditor/editor/dist/css/style.css'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const isNew = route.params.id === 'new'
const loading = ref(false)
const saving = ref(false)
const error = ref('')

// wangEditor 实例引用（shallowRef 初始值用 undefined，与官方 Vue3 示例一致）
const editorRef = shallowRef<IDomEditor | undefined>()

const form = ref({
  title: '',
  slug: '',
  excerpt: '',
  content: '',
  coverImage: '',
  published: false,
  contentFormat: 'html' as string,
  series: '',
  seriesOrder: null as number | null,
  tags: [] as string[],
})

// tags 输入状态
const tagInput = ref('')

// ---- wangEditor 配置 ----

const toolbarConfig: Partial<IToolbarConfig> = {
  toolbarKeys: [
    'headerSelect',
    'bold',
    'italic',
    'through',
    'code',
    '|',
    'bulletedList',
    'numberedList',
    'blockquote',
    'codeBlock',
    '|',
    'insertLink',
    'uploadImage',
    'insertTable',
    '|',
    'divider',
    'undo',
    'redo',
  ],
}

const editorConfig: Partial<IEditorConfig> = {
  placeholder: '开始写作...',
  MENU_CONF: {
    uploadImage: {
      // 自定义上传逻辑，对接 /api/upload
      async customUpload(file: File, insertFn: (url: string, alt: string, href: string) => void) {
        try {
          const formData = new FormData()
          formData.append('file', file)
          const res = await fetch('/api/upload', {
            method: 'POST',
            body: formData,
            credentials: 'include',
          })
          if (!res.ok)
            throw new Error(`上传失败：${res.status}`)
          const data = await res.json() as { url?: string, data?: { url: string } }
          const url = data.url || data.data?.url || ''
          if (!url)
            throw new Error('上传响应中无 URL')
          insertFn(url, file.name, '')
        }
        catch (e) {
          handleError(e, '图片上传失败')
        }
      },
    },
  },
}

function handleCreated(editor: IDomEditor) {
  editorRef.value = editor
}

// 组件卸载时销毁编辑器实例，防止内存泄漏
onBeforeUnmount(() => {
  editorRef.value?.destroy()
})

// ---- Tags 操作 ----

function addTag() {
  const raw = tagInput.value.trim().replace(/,+$/, '')
  if (!raw)
    return
  const newTags = raw.split(/[,，]/).map(t => t.trim()).filter(Boolean)
  for (const t of newTags) {
    if (!form.value.tags.includes(t)) {
      form.value.tags.push(t)
    }
  }
  tagInput.value = ''
}

function removeTag(tag: string) {
  form.value.tags = form.value.tags.filter(t => t !== tag)
}

function handleTagKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault()
    addTag()
  }
}

// ---- slug 自动生成 ----

function generateSlug() {
  if (!form.value.title || form.value.slug)
    return
  form.value.slug = form.value.title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// ---- 加载文章 ----

async function fetchPost() {
  if (isNew)
    return
  loading.value = true
  try {
    const response = await authClient.$fetch(`/api/posts/admin/${route.params.id}`)
    if (response.error)
      throw response.error
    if (!response.data || typeof response.data !== 'object' || !('data' in response.data))
      throw new Error('Invalid response format')

    const post = (response.data as { data: Post & { tags?: string[], series?: string, seriesOrder?: number } }).data

    form.value = {
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt || '',
      content: post.content || '',
      coverImage: post.coverImage || '',
      published: post.published ?? false,
      contentFormat: (post as any).contentFormat || 'html',
      series: (post as any).series || '',
      seriesOrder: (post as any).seriesOrder ?? null,
      tags: (post as any).tags || [],
    }

    // v-model="form.content" 会自动将新值同步到编辑器，无需手动 setHtml
  }
  catch (e) {
    console.error(e)
    error.value = '加载文章失败'
    setTimeout(() => router.push('/posts'), 2000)
  }
  finally {
    loading.value = false
  }
}

// ---- 保存 ----

async function save() {
  saving.value = true
  error.value = ''
  try {
    const payload = {
      title: form.value.title,
      slug: form.value.slug,
      excerpt: form.value.excerpt || null,
      content: form.value.content,
      coverImage: form.value.coverImage || null,
      published: form.value.published,
      contentFormat: 'html',
      tags: form.value.tags.length > 0 ? form.value.tags : null,
      series: form.value.series || null,
      seriesOrder: form.value.seriesOrder ?? null,
    }

    const url = isNew ? `/api/posts` : `/api/posts/${route.params.id}`
    const method = isNew ? 'POST' : 'PATCH'

    const response = await authClient.$fetch(url, {
      method,
      body: JSON.stringify(payload),
    })

    if (response.error)
      throw response.error

    router.push('/posts')
  }
  catch (e: unknown) {
    error.value = e instanceof Error ? e.message : '保存失败'
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
  <div class="max-w-5xl mx-auto space-y-6">
    <!-- 顶部操作栏 -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-4">
        <button class="p-2 hover:bg-muted rounded-full transition-colors" @click="router.back()">
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="m15 18-6-6 6-6" />
          </svg>
        </button>
        <h1 class="text-2xl font-bold tracking-tight">
          {{ isNew ? t('dashboard.new_post') : t('dashboard.edit_post') }}
        </h1>
      </div>
      <div class="flex items-center gap-3">
        <!-- 发布状态切换 -->
        <label class="flex items-center gap-2 cursor-pointer">
          <input v-model="form.published" type="checkbox" class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary">
          <span class="text-sm font-medium">{{ t('dashboard.published') }}</span>
        </label>
        <button
          :disabled="saving"
          class="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-5 py-2"
          @click="save"
        >
          {{ saving ? t('dashboard.saving') : t('dashboard.save') }}
        </button>
      </div>
    </div>

    <!-- 错误提示 -->
    <div v-if="error" class="rounded-md border border-destructive bg-destructive/10 p-4 text-destructive flex items-center justify-between">
      <span>{{ error }}</span>
      <button class="text-sm underline ml-2" @click="error = ''">
        关闭
      </button>
    </div>

    <!-- 加载中 -->
    <div v-if="loading" class="py-10 text-center text-muted-foreground">
      加载中...
    </div>

    <div v-else class="grid gap-5">
      <!-- 基础信息 -->
      <div class="rounded-lg border bg-card p-5 space-y-4">
        <h2 class="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          基础信息
        </h2>
        <div class="grid gap-4 md:grid-cols-2">
          <div class="space-y-1.5">
            <label class="text-sm font-medium">{{ t('dashboard.title') }} <span class="text-destructive">*</span></label>
            <input
              v-model="form.title"
              class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              placeholder="文章标题"
              @blur="generateSlug"
            >
          </div>
          <div class="space-y-1.5">
            <label class="text-sm font-medium">{{ t('dashboard.slug') }} <span class="text-destructive">*</span></label>
            <input
              v-model="form.slug"
              class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              placeholder="url-friendly-slug"
            >
          </div>
        </div>
        <div class="space-y-1.5">
          <label class="text-sm font-medium">{{ t('dashboard.excerpt') }}</label>
          <textarea
            v-model="form.excerpt"
            rows="2"
            class="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
            placeholder="文章摘要（120字以内）"
          />
        </div>
        <div class="space-y-1.5">
          <label class="text-sm font-medium">{{ t('dashboard.cover_image') }}</label>
          <input
            v-model="form.coverImage"
            class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            placeholder="封面图 URL（可选）"
          >
        </div>
      </div>

      <!-- 系列 & 标签 -->
      <div class="rounded-lg border bg-card p-5 space-y-4">
        <h2 class="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          系列 & 标签
        </h2>
        <div class="grid gap-4 md:grid-cols-2">
          <div class="space-y-1.5">
            <label class="text-sm font-medium">系列 Slug</label>
            <input
              v-model="form.series"
              class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              placeholder="如：ts-fullstack-ai-chronicle"
            >
          </div>
          <div class="space-y-1.5">
            <label class="text-sm font-medium">系列排序</label>
            <input
              v-model.number="form.seriesOrder"
              type="number"
              min="1"
              class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              placeholder="系列内排序（如 1, 2, 3）"
            >
          </div>
        </div>
        <!-- Tags chip 输入 -->
        <div class="space-y-1.5">
          <label class="text-sm font-medium">标签</label>
          <div class="flex flex-wrap gap-2 p-2 min-h-[44px] rounded-md border border-input bg-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
            <span
              v-for="tag in form.tags"
              :key="tag"
              class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium"
            >
              #{{ tag }}
              <button
                type="button"
                class="hover:text-destructive transition-colors"
                @click="removeTag(tag)"
              >
                <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
            <input
              v-model="tagInput"
              class="flex-1 min-w-[120px] text-sm bg-transparent outline-none placeholder:text-muted-foreground"
              placeholder="输入标签后回车添加，逗号分隔多个"
              @keydown="handleTagKeydown"
              @blur="addTag"
            >
          </div>
        </div>
      </div>

      <!-- wangEditor 富文本编辑器 -->
      <div class="rounded-lg border bg-card overflow-hidden">
        <div class="text-sm font-medium px-5 pt-4 pb-2 text-muted-foreground uppercase tracking-wider">
          正文内容
        </div>
        <div style="border-top: 1px solid var(--border)">
          <Toolbar
            :editor="editorRef"
            :default-config="toolbarConfig"
            class="border-b border-border"
            mode="default"
          />
          <Editor
            v-model="form.content"
            :default-config="editorConfig"
            style="min-height: 450px; overflow-y: hidden;"
            mode="default"
            @on-created="handleCreated"
          />
        </div>
      </div>
    </div>
  </div>
</template>
