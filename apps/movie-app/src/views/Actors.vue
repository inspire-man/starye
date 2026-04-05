<script setup lang="ts">
import type { SelectOption } from '../components/Select.vue'
import type { Actor } from '../types'
import { onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Select from '../components/Select.vue'
import { actorApi } from '../lib/api-client'

const route = useRoute()
const router = useRouter()

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

// 选项配置
const sortOptions: SelectOption<string>[] = [
  { label: '按名称', value: 'name', icon: '🔤' },
  { label: '按作品数', value: 'movieCount', icon: '🎬' },
  { label: '按创建时间', value: 'createdAt', icon: '📅' },
]

const activeOptions: SelectOption<boolean | undefined>[] = [
  { label: '全部', value: undefined },
  { label: '活跃', value: true, icon: '✅' },
  { label: '已引退', value: false, icon: '⏸️' },
]

const detailsOptions: SelectOption<boolean | undefined>[] = [
  { label: '全部', value: undefined },
  { label: '已补全', value: true, icon: '✅' },
  { label: '待补全', value: false, icon: '⏳' },
]

// 将布尔类型的 query 字符串解析回 boolean | undefined
function parseBool(val: string | string[] | undefined): boolean | undefined {
  if (val === 'true')
    return true
  if (val === 'false')
    return false
  return undefined
}

// 将当前状态同步到 URL query
function syncUrl() {
  router.replace({
    query: {
      ...(pagination.page > 1 && { page: String(pagination.page) }),
      ...(filters.sort !== 'name' && { sort: filters.sort }),
      ...(filters.nationality && { nationality: filters.nationality }),
      ...(filters.isActive !== undefined && { isActive: String(filters.isActive) }),
      ...(filters.hasDetails !== undefined && { hasDetails: String(filters.hasDetails) }),
    },
  })
}

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
  syncUrl()
  fetchActors()
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function applyFilters() {
  pagination.page = 1
  syncUrl()
  fetchActors()
}

onMounted(() => {
  // 从 URL query 恢复状态
  pagination.page = Number(route.query.page) || 1
  filters.sort = (route.query.sort as typeof filters.sort) || 'name'
  filters.nationality = (route.query.nationality as string) || ''
  filters.isActive = parseBool(route.query.isActive as string)
  filters.hasDetails = parseBool(route.query.hasDetails as string)
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
          <Select
            v-model="filters.sort"
            :options="sortOptions"
            size="default"
            @change="applyFilters"
          />
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
          <Select
            v-model="filters.isActive"
            :options="activeOptions"
            size="default"
            @change="applyFilters"
          />
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

.actors-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 1.25rem;
  margin-bottom: 2rem;
}

@media (max-width: 1024px) {
  .actors-grid {
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  }
}

@media (max-width: 640px) {
  .actors-grid {
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: 1rem;
  }
}

.actor-card {
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

.actor-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
  border-color: #3b82f6;
}

.actor-avatar {
  aspect-ratio: 3 / 4;
  background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  position: relative;
}

.actor-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s;
}

.actor-card:hover .actor-avatar img {
  transform: scale(1.05);
}

.avatar-placeholder {
  font-size: 2.5rem;
  font-weight: 700;
  color: #9ca3af;
  text-transform: uppercase;
}

.actor-info {
  padding: 0.875rem;
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.actor-name {
  font-size: 0.9375rem;
  font-weight: 600;
  color: #111827;
  line-height: 1.25;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  min-height: 2.5rem;
}

.actor-stats {
  font-size: 0.8125rem;
  font-weight: 500;
  color: #3b82f6;
}

.actor-meta {
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
  border-color: #3b82f6;
  color: #3b82f6;
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
