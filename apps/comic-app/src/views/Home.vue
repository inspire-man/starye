<script setup lang="ts">
import type { Comic } from '../types'
import { onMounted, reactive, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { comicApi } from '../api'
import { useUserStore } from '../stores/user'

const userStore = useUserStore()
const loading = ref(true)
const comics = ref<Comic[]>([])
const pagination = reactive({
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 0,
})

const filters = reactive({
  status: '',
  sortBy: 'updatedAt',
  sortOrder: 'desc' as 'asc' | 'desc',
})

async function fetchComics() {
  loading.value = true
  try {
    const response = await comicApi.getComics({
      page: pagination.page,
      limit: pagination.limit,
      status: filters.status || undefined,
      sortBy: filters.sortBy,
      sortOrder: filters.sortOrder,
    })

    if (response.success) {
      comics.value = response.data
      Object.assign(pagination, response.pagination)
    }
  }
  catch (error) {
    console.error('Failed to fetch comics:', error)
  }
  finally {
    loading.value = false
  }
}

function changePage(page: number) {
  pagination.page = page
  fetchComics()
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

watch([() => filters.status, () => filters.sortBy], () => {
  pagination.page = 1
  fetchComics()
})

onMounted(() => {
  fetchComics()
})
</script>

<template>
  <div>
    <!-- R18 Status Banner (if logged in and not verified) -->
    <div v-if="userStore.user && !userStore.user.isR18Verified" class="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-6">
      <div class="flex items-center gap-3">
        <span class="text-2xl flex-shrink-0">🔒</span>
        <div class="text-sm flex-1">
          <p class="font-medium text-amber-900">
            部分 R18 内容已隐藏
          </p>
          <p class="text-amber-700 text-xs mt-0.5">
            当前账号未获得 R18 内容访问权限。如需访问，请联系管理员申请。
          </p>
        </div>
      </div>
    </div>

    <div class="mb-6">
      <h1 class="text-3xl font-bold text-gray-900 mb-4">
        热门漫画
      </h1>

      <div class="flex flex-wrap gap-4 mb-6">
        <select
          v-model="filters.status"
          class="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        >
          <option value="">
            全部状态
          </option>
          <option value="serializing">
            连载中
          </option>
          <option value="completed">
            已完结
          </option>
        </select>

        <select
          v-model="filters.sortBy"
          class="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        >
          <option value="updatedAt">
            最近更新
          </option>
          <option value="createdAt">
            最新上架
          </option>
          <option value="title">
            按标题
          </option>
        </select>
      </div>
    </div>

    <div v-if="loading" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
      <div v-for="i in 10" :key="i" class="animate-pulse">
        <div class="bg-gray-200 aspect-[3/4] rounded-lg mb-2" />
        <div class="bg-gray-200 h-4 rounded mb-1" />
        <div class="bg-gray-200 h-3 rounded w-2/3" />
      </div>
    </div>

    <div v-else-if="comics.length === 0" class="text-center py-12">
      <p class="text-gray-500">
        暂无漫画
      </p>
    </div>

    <div v-else>
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        <RouterLink
          v-for="comic in comics"
          :key="comic.id"
          :to="`/comic/${comic.slug}`"
          class="group cursor-pointer"
        >
          <div class="relative overflow-hidden rounded-lg shadow-md group-hover:shadow-xl transition-shadow duration-300">
            <div class="aspect-[3/4] bg-gray-200">
              <img
                v-if="comic.coverImage"
                :src="comic.coverImage"
                :alt="comic.title"
                class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                loading="lazy"
              >
            </div>
            <div
              v-if="comic.isR18"
              class="absolute top-2 right-2 bg-red-600 text-white text-xs px-2 py-1 rounded"
            >
              R18
            </div>
          </div>
          <h3 class="mt-2 font-medium text-gray-900 line-clamp-2 group-hover:text-primary-600 transition">
            {{ comic.title }}
          </h3>
          <p class="text-sm text-gray-500 line-clamp-1">
            {{ comic.author || '未知作者' }}
          </p>
        </RouterLink>
      </div>

      <div v-if="pagination.totalPages > 1" class="mt-8 flex justify-center gap-2">
        <button
          :disabled="pagination.page <= 1"
          class="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
          @click="changePage(pagination.page - 1)"
        >
          上一页
        </button>
        <span class="px-4 py-2 text-gray-700">
          {{ pagination.page }} / {{ pagination.totalPages }}
        </span>
        <button
          :disabled="pagination.page >= pagination.totalPages"
          class="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
          @click="changePage(pagination.page + 1)"
        >
          下一页
        </button>
      </div>
    </div>
  </div>
</template>
