<script setup lang="ts">
import type { SelectOption } from '../components/Select.vue'
import type { Publisher } from '../types'
import { onMounted, reactive, ref } from 'vue'
import { publisherApi } from '../lib/api-client'
import Select from '../components/Select.vue'

const loading = ref(true)
const publishers = ref<Publisher[]>([])
const pagination = reactive({
  page: 1,
  limit: 24,
  total: 0,
  totalPages: 0,
})

const filters = reactive({
  sort: 'name' as 'name' | 'movieCount' | 'createdAt',
  country: '',
  hasDetails: undefined as boolean | undefined,
})

// 选项配置
const sortOptions: SelectOption<string>[] = [
  { label: '按名称', value: 'name', icon: '🔤' },
  { label: '按作品数', value: 'movieCount', icon: '🎬' },
  { label: '按创建时间', value: 'createdAt', icon: '📅' },
]

const detailsOptions: SelectOption<boolean | undefined>[] = [
  { label: '全部', value: undefined },
  { label: '已补全', value: true, icon: '✅' },
  { label: '待补全', value: false, icon: '⏳' },
]

async function fetchPublishers() {
  loading.value = true
  try {
    const response = await publisherApi.getPublishers({
      page: pagination.page,
      limit: pagination.limit,
      sort: filters.sort,
      country: filters.country || undefined,
      hasDetails: filters.hasDetails,
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

function applyFilters() {
  pagination.page = 1
  fetchPublishers()
}

onMounted(() => {
  fetchPublishers()
})
</script>

<template>
  <div class="publishers-page">
    <div class="container">
      <h1 class="page-title">
        厂商
      </h1>

      <!-- 筛选器 -->
      <div class="filters">
        <div class="filter-group">
          <label>排序</label>
          <Select
            v-model="filters.sort"
            :options="sortOptions"
            size="default"
            @change="applyFilters"
          />
        </div>

        <div class="filter-group">
          <label>国家</label>
          <input
            v-model="filters.country"
            type="text"
            placeholder="输入国家筛选"
            @change="applyFilters"
          >
        </div>

        <div class="filter-group">
          <label>详情</label>
          <Select
            v-model="filters.hasDetails"
            :options="detailsOptions"
            size="default"
            @change="applyFilters"
          />
        </div>
      </div>

      <!-- 加载中 -->
      <div v-if="loading" class="loading">
        加载中...
      </div>

      <!-- 厂商列表 -->
      <div v-else class="publishers-grid">
        <RouterLink
          v-for="publisher in publishers"
          :key="publisher.id"
          :to="`/publishers/${publisher.slug}`"
          class="publisher-card"
        >
          <div class="publisher-logo">
            <img
              v-if="publisher.logo"
              :src="publisher.logo"
              :alt="publisher.name"
            >
            <div v-else class="logo-placeholder">
              {{ publisher.name[0] }}
            </div>
          </div>
          <div class="publisher-info">
            <h3 class="publisher-name">
              {{ publisher.name }}
            </h3>
            <p class="publisher-stats">
              {{ publisher.movieCount }} 作品
            </p>
            <p v-if="publisher.country" class="publisher-meta">
              {{ publisher.country }}
            </p>
            <span v-if="!publisher.hasDetailsCrawled" class="badge">待补全</span>
          </div>
        </RouterLink>
      </div>

      <!-- 分页 -->
      <div v-if="!loading && pagination.totalPages > 1" class="pagination">
        <button
          :disabled="pagination.page === 1"
          @click="changePage(pagination.page - 1)"
        >
          上一页
        </button>
        <span class="page-info">
          第 {{ pagination.page }} / {{ pagination.totalPages }} 页
        </span>
        <button
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
.publishers-page {
  padding: 1.5rem 0;
  min-height: 100vh;
  background: #f9fafb;
}

.container {
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 1.5rem;
}

.page-title {
  font-size: 1.875rem;
  font-weight: 700;
  margin-bottom: 1.5rem;
  color: #111827;
}

.filters {
  display: flex;
  gap: 1.25rem;
  margin-bottom: 2rem;
  flex-wrap: wrap;
  background: white;
  padding: 1.25rem;
  border-radius: 0.75rem;
  box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1);
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-width: 140px;
}

.filter-group label {
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
}

.filter-group select,
.filter-group input {
  padding: 0.625rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  color: #111827;
  background: white;
  transition: all 0.2s;
}

.filter-group select:hover,
.filter-group input:hover {
  border-color: #9ca3af;
}

.filter-group select:focus,
.filter-group input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

@media (max-width: 768px) {
  .filters {
    gap: 1rem;
    padding: 1rem;
  }

  .filter-group {
    min-width: calc(50% - 0.5rem);
  }
}

@media (max-width: 480px) {
  .filter-group {
    min-width: 100%;
  }
}

.loading {
  text-align: center;
  padding: 4rem 2rem;
  color: #6b7280;
  font-size: 1rem;
}

.publishers-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1.25rem;
  margin-bottom: 2rem;
}

@media (max-width: 1024px) {
  .publishers-grid {
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  }
}

@media (max-width: 640px) {
  .publishers-grid {
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 1rem;
  }
}

.publisher-card {
  display: flex;
  flex-direction: column;
  text-decoration: none;
  color: inherit;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 0.75rem;
  overflow: hidden;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.publisher-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
  border-color: #10b981;
}

.publisher-logo {
  aspect-ratio: 16 / 9;
  background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  padding: 1.25rem;
}

.publisher-logo img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  transition: transform 0.3s;
}

.publisher-card:hover .publisher-logo img {
  transform: scale(1.05);
}

.logo-placeholder {
  font-size: 2.5rem;
  font-weight: 700;
  color: #9ca3af;
  text-transform: uppercase;
}

.publisher-info {
  padding: 0.875rem;
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.publisher-name {
  font-size: 0.9375rem;
  font-weight: 600;
  color: #111827;
  line-height: 1.25;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  min-height: 2.5rem;
}

.publisher-stats {
  font-size: 0.8125rem;
  font-weight: 500;
  color: #10b981;
}

.publisher-meta {
  font-size: 0.75rem;
  color: #6b7280;
}

.badge {
  display: inline-block;
  padding: 0.25rem 0.625rem;
  font-size: 0.6875rem;
  font-weight: 500;
  background: #fef3c7;
  color: #92400e;
  border-radius: 9999px;
  align-self: flex-start;
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1rem;
  padding: 2rem 0;
}

.pagination button {
  padding: 0.625rem 1.25rem;
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
  background: white;
  color: #374151;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
}

.pagination button:hover:not(:disabled) {
  background: #f9fafb;
  border-color: #10b981;
  color: #10b981;
}

.pagination button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  background: #f9fafb;
}

.page-info {
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
  padding: 0 0.5rem;
}

@media (max-width: 480px) {
  .pagination {
    gap: 0.75rem;
  }

  .pagination button {
    padding: 0.5rem 1rem;
    font-size: 0.8125rem;
  }

  .page-info {
    font-size: 0.8125rem;
  }
}
</style>
