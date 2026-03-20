<script setup lang="ts">
import type { Actor } from '../types'
import { onMounted, reactive, ref } from 'vue'
import { actorApi } from '../api'

const loading = ref(true)
const actors = ref<Actor[]>([])
const pagination = reactive({
  page: 1,
  limit: 24,
  total: 0,
  totalPages: 0,
})

const filters = reactive({
  sort: 'name' as 'name' | 'movieCount' | 'createdAt',
  nationality: '',
  isActive: undefined as boolean | undefined,
  hasDetails: undefined as boolean | undefined,
})

async function fetchActors() {
  loading.value = true
  try {
    const response = await actorApi.getActors({
      page: pagination.page,
      limit: pagination.limit,
      sort: filters.sort,
      nationality: filters.nationality || undefined,
      isActive: filters.isActive,
      hasDetails: filters.hasDetails,
    })

    if (response.success) {
      actors.value = response.data
      Object.assign(pagination, response.pagination)
    }
  }
  catch (error) {
    console.error('Failed to fetch actors:', error)
  }
  finally {
    loading.value = false
  }
}

function changePage(page: number) {
  pagination.page = page
  fetchActors()
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function applyFilters() {
  pagination.page = 1
  fetchActors()
}

onMounted(() => {
  fetchActors()
})
</script>

<template>
  <div class="actors-page">
    <div class="container">
      <h1 class="page-title">
        女优
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
          <label>国籍</label>
          <input
            v-model="filters.nationality"
            type="text"
            placeholder="输入国籍筛选"
            @change="applyFilters"
          >
        </div>

        <div class="filter-group">
          <label>状态</label>
          <select v-model="filters.isActive" @change="applyFilters">
            <option :value="undefined">
              全部
            </option>
            <option :value="true">
              活跃
            </option>
            <option :value="false">
              已引退
            </option>
          </select>
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

      <!-- 女优列表 -->
      <div v-else class="actors-grid">
        <RouterLink
          v-for="actor in actors"
          :key="actor.id"
          :to="`/actors/${actor.slug}`"
          class="actor-card"
        >
          <div class="actor-avatar">
            <img
              v-if="actor.avatar"
              :src="actor.avatar"
              :alt="actor.name"
            >
            <div v-else class="avatar-placeholder">
              {{ actor.name[0] }}
            </div>
          </div>
          <div class="actor-info">
            <h3 class="actor-name">
              {{ actor.name }}
            </h3>
            <p class="actor-stats">
              {{ actor.movieCount }} 作品
            </p>
            <p v-if="actor.nationality" class="actor-meta">
              {{ actor.nationality }}
            </p>
            <span v-if="!actor.hasDetailsCrawled" class="badge">待补全</span>
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
.actors-page {
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

.actors-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.actor-card {
  display: flex;
  flex-direction: column;
  text-decoration: none;
  color: inherit;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
  transition: transform 0.2s, box-shadow 0.2s;
}

.actor-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.actor-avatar {
  aspect-ratio: 3 / 4;
  background: #f3f4f6;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.actor-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-placeholder {
  font-size: 3rem;
  font-weight: bold;
  color: #9ca3af;
}

.actor-info {
  padding: 0.75rem;
}

.actor-name {
  font-size: 0.9375rem;
  font-weight: 600;
  margin-bottom: 0.25rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.actor-stats {
  font-size: 0.8125rem;
  color: #6b7280;
  margin-bottom: 0.25rem;
}

.actor-meta {
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
