<script setup lang="ts">
import { useSearch } from '~/composables/useSearch'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const { search, init, isLoading } = useSearch()
const query = ref('')
const results = ref<any[]>([])
const searchLoading = ref(false)

// Init search index when dialog opens
watch(() => props.open, async (isOpen) => {
  if (isOpen) {
    await init()
    // Auto focus input
    setTimeout(() => {
      document.getElementById('search-input')?.focus()
    }, 100)
  }
})

// Debounced search
let timeout: any
function handleInput() {
  clearTimeout(timeout)
  timeout = setTimeout(async () => {
    if (!query.value.trim()) {
      results.value = []
      return
    }
    searchLoading.value = true
    try {
      results.value = await search(query.value)
    }
    finally {
      searchLoading.value = false
    }
  }, 300)
}

function close() {
  emit('close')
  query.value = ''
  results.value = []
}
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-[100] flex items-start justify-center pt-24 px-4">
    <!-- Backdrop -->
    <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="close" />

    <!-- Dialog -->
    <div class="relative w-full max-w-2xl bg-background rounded-xl shadow-2xl overflow-hidden border animate-in fade-in zoom-in-95 duration-200">
      <div class="flex items-center px-4 border-b">
        <svg class="w-5 h-5 text-muted-foreground mr-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          id="search-input"
          v-model="query"
          class="flex-1 h-14 bg-transparent border-none outline-none text-lg placeholder:text-muted-foreground"
          :placeholder="$t('comic.search_placeholder') || 'Search comics...'"
          @input="handleInput"
          @keydown.esc="close"
        >
        <div v-if="isLoading" class="ml-2 animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full" />
      </div>

      <div v-if="results.length > 0" class="max-h-[60vh] overflow-y-auto py-2">
        <div class="px-2">
          <NuxtLink
            v-for="item in results"
            :key="item.slug"
            :to="`/${item.slug}`"
            class="flex items-start gap-4 p-3 rounded-lg hover:bg-muted transition-colors group"
            @click="close"
          >
            <img v-if="item.cover" :src="item.cover" class="w-12 h-16 object-cover rounded bg-muted">
            <div class="flex-1 min-w-0">
              <h4 class="font-bold text-sm group-hover:text-primary truncate">
                {{ item.title }}
              </h4>
              <p class="text-xs text-muted-foreground mt-1 truncate">
                {{ item.author }}
              </p>
              <div class="flex gap-2 mt-2">
                <span v-if="item.region" class="text-[10px] px-1.5 py-0.5 bg-muted-foreground/10 rounded text-muted-foreground">{{ item.region }}</span>
                <span v-if="item.status" class="text-[10px] px-1.5 py-0.5 bg-muted-foreground/10 rounded text-muted-foreground">{{ item.status }}</span>
              </div>
            </div>
          </NuxtLink>
        </div>
      </div>

      <div v-else-if="query && !searchLoading && !isLoading" class="p-8 text-center text-muted-foreground">
        No results found.
      </div>

      <div v-else-if="!query" class="p-8 text-center text-sm text-muted-foreground">
        Type to search...
      </div>
    </div>
  </div>
</template>
