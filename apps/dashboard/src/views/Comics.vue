<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { api, type Comic } from '@/lib/api'
import { useSession } from '@/lib/auth-client'

useSession()
const comics = ref<Comic[]>([])
const loading = ref(true)
const error = ref('')

// Modal state
const isEditModalOpen = ref(false)
const editingComic = ref<Comic | null>(null)
const updateLoading = ref(false)
const uploadLoading = ref(false)

const handleUpload = async (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file || !editingComic.value) return

  uploadLoading.value = true
  try {
    // 1. Get Presigned URL
    const presignRes = await api.upload.presign(file.name, file.type)

    // 2. Upload to R2 (Directly)
    await fetch(presignRes.uploadUrl, {
      method: 'PUT',
      body: file,
      headers: {
        'Content-Type': file.type
      }
    })

    // 3. Update local state
    editingComic.value.coverImage = presignRes.publicUrl
  } catch (e: any) {
    alert('Upload failed: ' + e.message)
  } finally {
    uploadLoading.value = false
  }
}

const loadComics = async () => {
  loading.value = true
  try {
    // Admin interface returns full data including isR18
    comics.value = await api.admin.getComics()
  } catch (e: any) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

onMounted(loadComics)

const openEditModal = (comic: Comic) => {
  editingComic.value = { ...comic }
  isEditModalOpen.value = true
}

const handleUpdate = async () => {
  if (!editingComic.value?.id) return

  updateLoading.value = true
  try {
    await api.admin.updateComic(editingComic.value.id, {
      title: editingComic.value.title,
      author: editingComic.value.author,
      isR18: editingComic.value.isR18,
      status: editingComic.value.status,
    })

    // Close modal and refresh list
    isEditModalOpen.value = false
    await loadComics()
  } catch (e: any) {
    alert('Update failed: ' + e.message)
  } finally {
    updateLoading.value = false
  }
}

const toggleR18Shortcut = async (comic: Comic) => {
  const newValue = !comic.isR18
  try {
    if (comic.id) {
        await api.admin.updateComic(comic.id, { isR18: newValue })
        comic.isR18 = newValue
    }
  } catch (e) {
    alert('Quick update failed')
  }
}
</script>

<template>
  <div class="space-y-6 relative">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-3xl font-bold tracking-tight text-neutral-900 dark:text-white">Comic Library</h2>
        <p class="text-neutral-500 mt-1">Manage metadata and visibility of your collection.</p>
      </div>
      <button @click="loadComics" class="p-2 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded-lg transition-colors">
        <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"></path><path d="M21 3v5h-5"></path></svg>
      </button>
    </div>

    <div v-if="loading" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
      <div v-for="i in 6" :key="i" class="h-40 bg-neutral-200 dark:bg-neutral-800 animate-pulse rounded-2xl"></div>
    </div>

    <div v-else-if="error" class="p-6 bg-red-50 border border-red-200 text-red-600 rounded-2xl flex flex-col items-center">
       <p class="font-bold">Backend Communication Error</p>
       <p class="text-sm mt-1">{{ error }}</p>
       <button @click="loadComics" class="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg text-sm">Retry Connection</button>
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
      <div v-for="comic in comics" :key="comic.slug"
           class="group bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden flex shadow-sm hover:shadow-md transition-all">

        <!-- Cover Preview -->
        <div class="w-28 shrink-0 bg-neutral-100 dark:bg-neutral-800 relative">
          <img v-if="comic.coverImage" :src="comic.coverImage" class="w-full h-full object-cover" />
          <div v-else class="w-full h-full flex items-center justify-center text-neutral-400">
             <svg class="w-8 h-8 opacity-20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
          </div>
          <div v-if="comic.isR18" class="absolute bottom-1 right-1 bg-red-500 text-[8px] text-white font-black px-1 rounded uppercase">R18</div>
        </div>

        <!-- Info -->
        <div class="flex-1 p-4 flex flex-col">
          <div class="flex-1">
            <h3 class="font-bold text-sm line-clamp-1 group-hover:text-primary transition-colors">{{ comic.title }}</h3>
            <p class="text-xs text-neutral-500 mt-1">{{ comic.author || 'Unknown Author' }}</p>
          </div>

          <div class="mt-4 flex items-center justify-between">
            <div class="flex gap-1">
               <button @click="toggleR18Shortcut(comic)"
                       class="text-[10px] font-bold px-2 py-0.5 rounded border transition-colors"
                       :class="comic.isR18 ? 'bg-red-50 text-red-600 border-red-200' : 'bg-green-50 text-green-600 border-green-200'">
                 {{ comic.isR18 ? 'R18' : 'SAFE' }}
               </button>
            </div>
            <button @click="openEditModal(comic)" class="text-xs font-medium text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors">
              Edit Details
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Edit Modal -->
    <div v-if="isEditModalOpen && editingComic" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div class="w-full max-w-lg bg-white dark:bg-neutral-900 rounded-3xl shadow-2xl overflow-hidden border border-neutral-200 dark:border-neutral-800 animate-in fade-in zoom-in duration-200">
        <div class="p-6 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
          <h3 class="text-xl font-bold">Edit Comic</h3>
          <button @click="isEditModalOpen = false" class="text-neutral-400 hover:text-neutral-900 dark:hover:text-white">
             <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>

        <div class="p-8 space-y-5">
          <div class="space-y-2">
            <label class="text-xs font-black uppercase tracking-widest text-neutral-500">Cover Image</label>
            <div class="flex items-center gap-4">
              <div class="w-16 h-24 bg-neutral-100 dark:bg-neutral-800 rounded-lg overflow-hidden border border-neutral-200 dark:border-neutral-700 relative group">
                <img v-if="editingComic.coverImage" :src="editingComic.coverImage" class="w-full h-full object-cover" />
                <div v-if="uploadLoading" class="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <svg class="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                </div>
              </div>
              <div class="flex-1">
                <input
                  type="text"
                  v-model="editingComic.coverImage"
                  class="w-full px-3 py-2 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800 bg-transparent mb-2"
                  placeholder="https://..."
                />
                <label class="inline-flex items-center px-3 py-2 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-xs font-bold rounded-lg cursor-pointer transition-colors">
                  <svg class="w-3 h-3 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                  Upload New Cover
                  <input type="file" class="hidden" accept="image/*" @change="handleUpload" />
                </label>
              </div>
            </div>
          </div>

          <div class="space-y-2">
            <label class="text-xs font-black uppercase tracking-widest text-neutral-500">Comic Title</label>
            <input v-model="editingComic.title" class="w-full px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-transparent focus:ring-2 ring-primary transition-all outline-none" />
          </div>

          <div class="space-y-2">
            <label class="text-xs font-black uppercase tracking-widest text-neutral-500">Author</label>
            <input v-model="editingComic.author" class="w-full px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-transparent focus:ring-2 ring-primary transition-all outline-none" />
          </div>

          <div class="flex items-center justify-between p-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-2xl border border-neutral-100 dark:border-neutral-800">
            <div>
              <p class="font-bold text-sm text-red-600">R18 Content</p>
              <p class="text-[10px] text-neutral-500">Enables age verification protection</p>
            </div>
            <input type="checkbox" v-model="editingComic.isR18" class="w-5 h-5 accent-red-600 cursor-pointer" />
          </div>
        </div>

        <div class="p-6 bg-neutral-50 dark:bg-neutral-800/50 border-t border-neutral-100 dark:border-neutral-800 flex gap-3">
          <button @click="isEditModalOpen = false" class="flex-1 px-4 py-3 rounded-xl font-bold text-sm hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-all">Cancel</button>
          <button @click="handleUpdate" :disabled="updateLoading" class="flex-1 px-4 py-3 bg-neutral-900 dark:bg-white dark:text-neutral-900 text-white rounded-xl font-bold text-sm hover:opacity-90 disabled:opacity-50 transition-all">
            {{ updateLoading ? 'Saving...' : 'Save Changes' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
