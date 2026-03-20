<script setup lang="ts">
import type { Publisher } from '../types'
import { onMounted, reactive, ref } from 'vue'
import { publisherApi } from '../api'

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
          <select v-model="filters.sort" @change="applyFilters">
            <option value="name">
              按名称
            </option>
            <option value="movieCount">
              按作品数
            </option>
            <option value="createdAt">
              按创建时间
            </option>
          </select>
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
          <select v-model="filters.hasDetails" @change="applyFilters">
            <option :value="undefined">
              全部
            </option>
            <option :value="true">
              已补全
            </option>
            <option :value="false">
              待补全
            </option>
          </select>
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
  padding: 2rem 0;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1rem;
}

.page-title {
  font-size: 2rem;
  font-weight: bold;
  margin-bottom: 1.5rem;
}

.filters {
  display: flex;
  gap: 1rem;
  margin-bottom: 2rem;
  flex-wrap: wrap;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.filter-group label {
  font-size: 0.875rem;
  color: #666;
}

.filter-group select,
.filter-group input {
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 0.875rem;
}

.loading {
  text-align: center;
  padding: 2rem;
  color: #666;
}

.publishers-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.publisher-card {
  display: flex;
  flex-direction: column;
  text-decoration: none;
  color: inherit;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
  transition: transform 0.2s, box-shadow 0.2s;
}

.publisher-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.publisher-logo {
  aspect-ratio: 16 / 9;
  background: #f3f4f6;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  padding: 1rem;
}

.publisher-logo img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.logo-placeholder {
  font-size: 2.5rem;
  font-weight: bold;
  color: #9ca3af;
}

.publisher-info {
  padding: 0.75rem;
}

.publisher-name {
  font-size: 0.9375rem;
  font-weight: 600;
  margin-bottom: 0.25rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.publisher-stats {
  font-size: 0.8125rem;
  color: #6b7280;
  margin-bottom: 0.25rem;
}

.publisher-meta {
  font-size: 0.75rem;
  color: #9ca3af;
  margin-bottom: 0.25rem;
}

.badge {
  display: inline-block;
  padding: 0.125rem 0.5rem;
  font-size: 0.75rem;
  background: #fef3c7;
  color: #92400e;
  border-radius: 9999px;
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1rem;
  padding: 2rem 0;
}

.pagination button {
  padding: 0.5rem 1rem;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  background: white;
  cursor: pointer;
  transition: background 0.2s;
}

.pagination button:hover:not(:disabled) {
  background: #f9fafb;
}

.pagination button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-info {
  font-size: 0.875rem;
  color: #6b7280;
}
</style>
