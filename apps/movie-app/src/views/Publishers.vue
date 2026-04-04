<script setup lang="ts">
import type { SelectOption } from '../components/Select.vue'
import type { Publisher } from '../types'
import { onMounted, reactive, ref } from 'vue'
import { RouterLink } from 'vue-router'
import Select from '../components/Select.vue'
import { publisherApi } from '../lib/api-client'

const loading = ref(true)
const publishers = ref<Publisher[]>([])
const pagination = reactive({
  page: 1,
  limit: 30,
  total: 0,
  totalPages: 0,
})

const sort = ref<'name' | 'movieCount' | 'createdAt'>('movieCount')

const sortOptions: SelectOption<string>[] = [
  { label: '作品数', value: 'movieCount', icon: '🎬' },
  { label: '名称', value: 'name', icon: '🔤' },
  { label: '最新', value: 'createdAt', icon: '📅' },
]

async function fetchPublishers() {
  loading.value = true
  try {
    const response = await publisherApi.getPublishers({
      page: pagination.page,
      limit: pagination.limit,
      sort: sort.value,
    })

    if (response.success) {
      publishers.value = response.data
      Object.assign(pagination, response.pagination)
    }
  }
  catch (error) {
    console.error('Failed to fetch publishers:', error)
  }
  finally {
    loading.value = false
  }
}

function changePage(page: number) {
  pagination.page = page
  fetchPublishers()
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function onSortChange() {
  pagination.page = 1
  fetchPublishers()
}

onMounted(() => {
  fetchPublishers()
})
</script>

<template>
  <div class="min-h-screen bg-gray-900 px-4 py-6">
    <div class="max-w-7xl mx-auto">
      <!-- 顶栏 -->
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-2xl font-bold text-white">
          厂商
          <span v-if="pagination.total > 0" class="ml-2 text-sm font-normal text-gray-400">
            共 {{ pagination.total }} 家
          </span>
        </h1>
        <Select
          v-model="sort"
          :options="sortOptions"
          size="default"
          @change="onSortChange"
        />
      </div>

      <!-- 加载骨架 -->
      <div v-if="loading" class="grid gap-3" style="grid-template-columns: repeat(auto-fill, minmax(160px, 1fr))">
        <div v-for="n in 12" :key="n" class="h-16 rounded-xl bg-gray-800 animate-pulse" />
      </div>

      <!-- 厂商列表 -->
      <div v-else class="grid gap-3" style="grid-template-columns: repeat(auto-fill, minmax(160px, 1fr))">
        <RouterLink
          v-for="publisher in publishers"
          :key="publisher.id"
          :to="`/publishers/${publisher.slug}`"
          class="publisher-card group"
        >
          <!-- logo 区 -->
          <div class="logo-area">
            <img
              v-if="publisher.logo"
              :src="publisher.logo"
              :alt="publisher.name"
              class="max-w-full max-h-full object-contain group-hover:scale-105 transition-transform duration-300"
            >
            <span v-else class="text-2xl font-bold text-gray-500 uppercase">
              {{ publisher.name[0] }}
            </span>
          </div>
          <!-- 信息区 -->
          <div class="px-3 pb-3 pt-2">
            <p class="text-sm font-semibold text-white leading-snug line-clamp-2">
              {{ publisher.name }}
            </p>
            <p class="text-xs text-emerald-400 mt-1 font-medium">
              {{ publisher.movieCount ?? 0 }} 部作品
            </p>
          </div>
        </RouterLink>
      </div>

      <!-- 分页 -->
      <div v-if="!loading && pagination.totalPages > 1" class="flex justify-center items-center gap-3 py-8">
        <button
          class="px-4 py-2 rounded-lg text-sm font-medium border border-gray-600 text-gray-300 hover:border-emerald-500 hover:text-emerald-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          :disabled="pagination.page === 1"
          @click="changePage(pagination.page - 1)"
        >
          上一页
        </button>
        <span class="text-sm text-gray-400">
          {{ pagination.page }} / {{ pagination.totalPages }}
        </span>
        <button
          class="px-4 py-2 rounded-lg text-sm font-medium border border-gray-600 text-gray-300 hover:border-emerald-500 hover:text-emerald-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          :disabled="pagination.page === pagination.totalPages"
          @click="changePage(pagination.page + 1)"
        >
          下一页
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.publisher-card {
  display: flex;
  flex-direction: column;
  text-decoration: none;
  background: #1f2937;
  border: 1px solid #374151;
  border-radius: 0.75rem;
  overflow: hidden;
  transition: border-color 0.2s, transform 0.2s, box-shadow 0.2s;
}

.publisher-card:hover {
  border-color: #10b981;
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgb(0 0 0 / 0.3);
}

.logo-area {
  aspect-ratio: 16 / 7;
  background: #111827;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  padding: 0.75rem;
}

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
