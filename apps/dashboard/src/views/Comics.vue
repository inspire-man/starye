<script setup lang="ts">
import type { Chapter, Comic } from '@/lib/api'
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { api } from '@/lib/api'
import { useSession } from '@/lib/auth-client'

const { t } = useI18n()
useSession()
const comics = ref<Comic[]>([])
const loading = ref(true)
const error = ref('')

// Modal state
const isEditModalOpen = ref(false)
const editingComic = ref<Comic | null>(null)
const updateLoading = ref(false)
const uploadLoading = ref(false)

// Chapter Management State
const activeTab = ref<'metadata' | 'chapters'>('metadata')
const chapters = ref<Chapter[]>([])
const chaptersLoading = ref(false)

async function handleUpload(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file || !editingComic.value)
    return

  uploadLoading.value = true
  try {
    const presignRes = await api.upload.presign(file.name, file.type)
    await fetch(presignRes.uploadUrl, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': file.type },
    })
    editingComic.value.coverImage = presignRes.publicUrl
  }
  catch (e: unknown) {
    console.error(e)
  }
  finally {
    uploadLoading.value = false
  }
}

async function loadComics() {
  loading.value = true
  try {
    const response = await api.admin.getComics()
    comics.value = response.data
  }
  catch (e: unknown) {
    error.value = String(e)
  }
  finally {
    loading.value = false
  }
}

onMounted(loadComics)

function openEditModal(comic: Comic) {
  editingComic.value = { ...comic }
  isEditModalOpen.value = true
  activeTab.value = 'metadata'
  if (comic.id) {
    loadChapters(comic.id)
  }
}

async function loadChapters(comicId: string) {
  chaptersLoading.value = true
  try {
    chapters.value = await api.admin.getChapters(comicId)
  }
  catch (e) {
    console.error(e)
  }
  finally {
    chaptersLoading.value = false
  }
}

async function deleteChapter(id: string) {
  await api.admin.deleteChapter(id)
  // Remove from local list
  chapters.value = chapters.value.filter(c => c.id !== id)
}

async function handleUpdate() {
  if (!editingComic.value?.id)
    return

  updateLoading.value = true
  try {
    await api.admin.updateComic(editingComic.value.id, {
      title: editingComic.value.title,
      author: editingComic.value.author,
      description: editingComic.value.description,
      isR18: editingComic.value.isR18,
      metadataLocked: editingComic.value.metadataLocked, // New Field
      status: editingComic.value.status as any,
      region: editingComic.value.region,
      genres: Array.isArray(editingComic.value.genres)
        ? editingComic.value.genres
        : (typeof editingComic.value.genres === 'string' ? (editingComic.value.genres as string).split(',').map(s => s.trim()).filter(Boolean) : []),
    })

    isEditModalOpen.value = false
    await loadComics()
  }
  catch (e: unknown) {
    console.error(e)
  }
  finally {
    updateLoading.value = false
  }
}

async function toggleR18Shortcut(comic: Comic) {
  const newValue = !comic.isR18
  try {
    if (comic.id) {
      await api.admin.updateComic(comic.id, { isR18: newValue })
      comic.isR18 = newValue
    }
  }
  catch {
    console.error('Quick update failed')
  }
}
</script>

<template>
  <div class="space-y-6 relative">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-3xl font-bold tracking-tight text-neutral-900 dark:text-white">
          {{ t('dashboard.comic_library') }}
        </h2>
        <p class="text-neutral-500 mt-1">
          {{ t('dashboard.manage_metadata') }}
        </p>
      </div>
      <button
        class="p-2 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded-lg transition-colors"
        @click="loadComics"
      >
        <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
          <path d="M21 3v5h-5" />
        </svg>
      </button>
    </div>

    <!-- Loading / Error States (Same as before) -->
    <div v-if="loading" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
      <div v-for="i in 6" :key="i" class="h-40 bg-neutral-200 dark:bg-neutral-800 animate-pulse rounded-2xl" />
    </div>

    <div
      v-else-if="error"
      class="p-6 bg-red-50 border border-red-200 text-red-600 rounded-2xl flex flex-col items-center"
    >
      <p class="font-bold">
        Error
      </p>
      <p class="text-sm mt-1">
        {{ error }}
      </p>
      <button class="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg text-sm" @click="loadComics">
        Retry
      </button>
    </div>

    <!-- Comic Grid -->
    <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
      <div
        v-for="comic in comics" :key="comic.slug"
        class="group bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden flex shadow-sm hover:shadow-md transition-all"
      >
        <!-- Cover Preview -->
        <div class="w-28 shrink-0 bg-neutral-100 dark:bg-neutral-800 relative">
          <img v-if="comic.coverImage" :src="comic.coverImage" class="w-full h-full object-cover">
          <div v-else class="w-full h-full flex items-center justify-center text-neutral-400">
            <svg class="w-8 h-8 opacity-20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
          </div>
          <div
            v-if="comic.isR18"
            class="absolute bottom-1 right-1 bg-red-500 text-[8px] text-white font-black px-1 rounded uppercase"
          >
            R18
          </div>
          <div
            v-if="comic.metadataLocked"
            class="absolute top-1 right-1 bg-amber-500 text-[8px] text-white font-black px-1 rounded uppercase"
          >
            LOCKED
          </div>
        </div>

        <!-- Info -->
        <div class="flex-1 p-4 flex flex-col">
          <div class="flex-1">
            <h3 class="font-bold text-sm line-clamp-1 group-hover:text-primary transition-colors">
              {{ comic.title }}
            </h3>
            <p class="text-xs text-neutral-500 mt-1">
              {{ comic.author || t('dashboard.unknown_author') }}
            </p>
          </div>

          <div class="mt-4 flex items-center justify-between">
            <div class="flex gap-1">
              <button
                class="text-[10px] font-bold px-2 py-0.5 rounded border transition-colors"
                :class="comic.isR18 ? 'bg-red-50 text-red-600 border-red-200' : 'bg-green-50 text-green-600 border-green-200'"
                @click="toggleR18Shortcut(comic)"
              >
                {{ comic.isR18 ? 'R18' : t('dashboard.safe') }}
              </button>
            </div>
            <button
              class="text-xs font-medium text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors"
              @click="openEditModal(comic)"
            >
              {{ t('dashboard.edit_details') }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Edit Modal -->
    <div
      v-if="isEditModalOpen && editingComic"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
    >
      <div
        class="w-full max-w-2xl bg-white dark:bg-neutral-900 rounded-3xl shadow-2xl overflow-hidden border border-neutral-200 dark:border-neutral-800 animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]"
      >
        <!-- Header -->
        <div class="p-6 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between shrink-0">
          <div class="flex items-center gap-4">
            <h3 class="text-xl font-bold">
              {{ t('dashboard.edit_comic') }}
            </h3>
            <!-- Tabs -->
            <div class="flex bg-neutral-100 dark:bg-neutral-800 rounded-lg p-1">
              <button
                class="px-3 py-1 text-xs font-bold rounded-md transition-all"
                :class="activeTab === 'metadata' ? 'bg-white dark:bg-neutral-700 shadow-sm' : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'"
                @click="activeTab = 'metadata'"
              >
                Metadata
              </button>
              <button
                class="px-3 py-1 text-xs font-bold rounded-md transition-all"
                :class="activeTab === 'chapters' ? 'bg-white dark:bg-neutral-700 shadow-sm' : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'"
                @click="activeTab = 'chapters'"
              >
                Chapters ({{ chapters.length }})
              </button>
            </div>
          </div>
          <button
            class="text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
            @click="isEditModalOpen = false"
          >
            <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <!-- Content (Scrollable) -->
        <div class="p-8 overflow-y-auto flex-1">
          <!-- Metadata Tab -->
          <div v-if="activeTab === 'metadata'" class="space-y-5">
            <!-- Lock Metadata Toggle -->
            <div
              class="flex items-center justify-between p-4 bg-amber-50 dark:bg-amber-900/20 rounded-2xl border border-amber-100 dark:border-amber-900/50"
            >
              <div>
                <p class="font-bold text-sm text-amber-700 dark:text-amber-500">
                  Lock Metadata
                </p>
                <p class="text-[10px] text-amber-600/80 dark:text-amber-500/80">
                  Prevent crawler from overwriting title, tags, and description.
                </p>
              </div>
              <input
                v-model="editingComic.metadataLocked" type="checkbox"
                class="w-5 h-5 accent-amber-600 cursor-pointer"
              >
            </div>

            <!-- Existing Fields -->
            <div class="space-y-2">
              <label class="text-xs font-black uppercase tracking-widest text-neutral-500">{{ t('dashboard.cover_image')
              }}</label>
              <div class="flex items-center gap-4">
                <div
                  class="w-16 h-24 bg-neutral-100 dark:bg-neutral-800 rounded-lg overflow-hidden border border-neutral-200 dark:border-neutral-700 relative group"
                >
                  <img v-if="editingComic.coverImage" :src="editingComic.coverImage" class="w-full h-full object-cover">
                  <div v-if="uploadLoading" class="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <svg class="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
                      <circle
                        class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"
                        fill="none"
                      />
                      <path
                        class="opacity-75" fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                  </div>
                </div>
                <div class="flex-1">
                  <input
                    v-model="editingComic.coverImage" type="text"
                    class="w-full px-3 py-2 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800 bg-transparent mb-2"
                    placeholder="https://..."
                  >
                  <label
                    class="inline-flex items-center px-3 py-2 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-xs font-bold rounded-lg cursor-pointer transition-colors"
                  >
                    <svg class="w-3 h-3 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    {{ t('dashboard.upload_new_cover') }}
                    <input type="file" class="hidden" accept="image/*" @change="handleUpload">
                  </label>
                </div>
              </div>
            </div>

            <div class="space-y-2">
              <label class="text-xs font-black uppercase tracking-widest text-neutral-500">{{ t('dashboard.comic_title')
              }}</label>
              <input
                v-model="editingComic.title"
                class="w-full px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-transparent focus:ring-2 ring-primary transition-all outline-none"
              >
            </div>

            <div class="space-y-2">
              <label class="text-xs font-black uppercase tracking-widest text-neutral-500">{{ t('dashboard.author')
              }}</label>
              <input
                v-model="editingComic.author"
                class="w-full px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-transparent focus:ring-2 ring-primary transition-all outline-none"
              >
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div class="space-y-2">
                <label class="text-xs font-black uppercase tracking-widest text-neutral-500">{{ t('dashboard.region')
                }}</label>
                <input
                  v-model="editingComic.region"
                  class="w-full px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-transparent focus:ring-2 ring-primary transition-all outline-none text-sm"
                >
              </div>
              <div class="space-y-2">
                <label class="text-xs font-black uppercase tracking-widest text-neutral-500">{{ t('dashboard.status')
                }}</label>
                <select
                  v-model="editingComic.status"
                  class="w-full px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-transparent focus:ring-2 ring-primary transition-all outline-none text-sm appearance-none"
                >
                  <option value="serializing">
                    {{ t('dashboard.serializing') }}
                  </option>
                  <option value="completed">
                    {{ t('dashboard.completed') }}
                  </option>
                </select>
              </div>
            </div>

            <div class="space-y-2">
              <label class="text-xs font-black uppercase tracking-widest text-neutral-500">{{ t('dashboard.genres')
              }}</label>
              <input
                :value="Array.isArray(editingComic.genres) ? editingComic.genres.join(', ') : editingComic.genres"
                class="w-full px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-transparent focus:ring-2 ring-primary transition-all outline-none text-sm"
                @input="e => editingComic!.genres = (e.target as HTMLInputElement).value.split(',').map(s => s.trim())"
              >
            </div>

            <div class="space-y-2">
              <label class="text-xs font-black uppercase tracking-widest text-neutral-500">{{ t('dashboard.description')
              }}</label>
              <textarea
                v-model="editingComic.description" rows="3"
                class="w-full px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-transparent focus:ring-2 ring-primary transition-all outline-none text-sm resize-none"
              />
            </div>

            <div
              class="flex items-center justify-between p-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-2xl border border-neutral-100 dark:border-neutral-800"
            >
              <div>
                <p class="font-bold text-sm text-red-600">
                  {{ t('dashboard.r18_content') }}
                </p>
                <p class="text-[10px] text-neutral-500">
                  {{ t('dashboard.enables_age_verification') }}
                </p>
              </div>
              <input v-model="editingComic.isR18" type="checkbox" class="w-5 h-5 accent-red-600 cursor-pointer">
            </div>
          </div>

          <!-- Chapters Tab -->
          <div v-else class="space-y-4">
            <div v-if="chaptersLoading" class="text-center py-8 text-neutral-500">
              Loading chapters...
            </div>
            <div v-else-if="chapters.length === 0" class="text-center py-8 text-neutral-500">
              No chapters found.
            </div>
            <div v-else class="border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden">
              <table class="w-full text-sm text-left">
                <thead class="bg-neutral-50 dark:bg-neutral-800 text-xs uppercase text-neutral-500 font-bold">
                  <tr>
                    <th class="px-4 py-3">
                      #
                    </th>
                    <th class="px-4 py-3">
                      Title
                    </th>
                    <th class="px-4 py-3 text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-neutral-100 dark:divide-neutral-800">
                  <tr
                    v-for="chapter in chapters" :key="chapter.id"
                    class="hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                  >
                    <td class="px-4 py-3 text-neutral-500">
                      {{ chapter.sortOrder }}
                    </td>
                    <td class="px-4 py-3 font-medium">
                      {{ chapter.title }}
                      <span v-if="chapter.slug" class="ml-2 text-[10px] text-neutral-400 font-mono">{{ chapter.slug
                      }}</span>
                    </td>
                    <td class="px-4 py-3 text-right">
                      <button
                        class="text-red-600 hover:text-red-700 font-bold text-xs"
                        @click="deleteChapter(chapter.id)"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div
          class="p-6 bg-neutral-50 dark:bg-neutral-800/50 border-t border-neutral-100 dark:border-neutral-800 flex gap-3 shrink-0"
        >
          <button
            class="flex-1 px-4 py-3 rounded-xl font-bold text-sm hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-all"
            @click="isEditModalOpen = false"
          >
            {{ t('dashboard.cancel') }}
          </button>
          <button
            :disabled="updateLoading"
            class="flex-1 px-4 py-3 bg-neutral-900 dark:bg-white dark:text-neutral-900 text-white rounded-xl font-bold text-sm hover:opacity-90 disabled:opacity-50 transition-all"
            @click="handleUpdate"
          >
            {{ updateLoading ? t('dashboard.saving') : t('dashboard.save_changes') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
