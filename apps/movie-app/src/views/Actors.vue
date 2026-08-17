<script setup lang="ts">
import type { SelectOption } from '@starye/ui'
import type { Actor } from '../types'
import { Pagination, Select, SkeletonCard, useListQuery } from '@starye/ui'
import { onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { actorApi } from '../lib/api-client'

const route = useRoute()
const router = useRouter()

const actors = ref<Actor[]>([])
const { page, limit, total, totalPages, loading, error, execute, goToPage, updatePageSize } = useListQuery(24)

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
async function syncUrl(pageNumber = page.value): Promise<void> {
  await router.replace({
    query: {
      ...route.query,
      ...(pageNumber > 1 ? { page: String(pageNumber) } : { page: undefined }),
      sort: filters.sort !== 'name' ? filters.sort : undefined,
      nationality: filters.nationality || undefined,
      isActive: filters.isActive !== undefined ? String(filters.isActive) : undefined,
      hasDetails: filters.hasDetails !== undefined ? String(filters.hasDetails) : undefined,
    },
  })
}

async function fetchActors() {
  const data = await execute(({ page, limit }) => actorApi.getActors({
    page,
    limit,
    sort: filters.sort,
    nationality: filters.nationality || undefined,
    isActive: filters.isActive,
    hasDetails: filters.hasDetails,
  }).then((response) => {
    if (!response.success)
      throw new Error('加载女优失败')
    return response
  }), '加载女优失败')
  if (data)
    actors.value = data
}

async function changePage(page: number): Promise<void> {
  await goToPage(page)
  await fetchActors()
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

async function changePageSize(size: number): Promise<void> {
  await updatePageSize(size)
  await fetchActors()
}

async function applyFilters(): Promise<void> {
  await syncUrl(1)
  await fetchActors()
}

onMounted(() => {
  // 从 URL query 恢复状态
  filters.sort = (route.query.sort as typeof filters.sort) || 'name'
  filters.nationality = (route.query.nationality as string) || ''
  filters.isActive = parseBool(route.query.isActive as string)
  filters.hasDetails = parseBool(route.query.hasDetails as string)
  fetchActors()
})
</script>

<template>
  <div class="ui-public-page actors-page">
    <header class="ui-public-page-header">
      <div>
        <h1 class="ui-public-page-title">
          女优
        </h1>
        <p class="ui-public-page-description">
          按名称、作品数和资料完整度浏览女优
        </p>
      </div>
      <span class="ui-status-tag ui-status-neutral">共 {{ total }} 人</span>
    </header>

    <!-- 筛选器 -->
    <details class="ui-public-surface ui-public-filter mb-5">
      <summary class="cursor-pointer list-none text-sm font-semibold">
        高级筛选
      </summary>
      <div class="ui-public-filter-grid">
        <div class="ui-public-field">
          <label for="actors-sort">排序</label>
          <Select
            id="actors-sort"
            v-model="filters.sort"
            :options="sortOptions"
            size="default"
            @change="applyFilters"
          />
        </div>

        <div class="ui-public-field">
          <label for="actors-nationality">国籍</label>
          <input
            id="actors-nationality"
            v-model="filters.nationality"
            type="text"
            placeholder="输入国籍筛选"
            class="ui-public-input"
            @change="applyFilters"
          >
        </div>

        <div class="ui-public-field">
          <label for="actors-status">状态</label>
          <Select
            id="actors-status"
            v-model="filters.isActive"
            :options="activeOptions"
            size="default"
            @change="applyFilters"
          />
        </div>

        <div class="ui-public-field">
          <label for="actors-details">详情</label>
          <Select
            id="actors-details"
            v-model="filters.hasDetails"
            :options="detailsOptions"
            size="default"
            @change="applyFilters"
          />
        </div>
      </div>
    </details>

    <!-- 加载中 -->
    <div v-if="loading" class="ui-public-grid">
      <SkeletonCard v-for="n in 12" :key="n" variant="poster" />
    </div>

    <!-- 女优列表 -->
    <div v-else-if="error" class="ui-public-empty">
      <span class="text-3xl text-[hsl(var(--status-danger))]">!</span>
      <p>{{ error }}</p>
      <button class="ui-public-button ui-public-button-ghost" @click="fetchActors">
        重试
      </button>
    </div>

    <div v-else-if="actors.length > 0" class="actors-grid">
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

    <div v-else class="ui-public-empty">
      <span class="text-3xl">👤</span>
      <p>暂无符合条件的女优</p>
    </div>

    <!-- 分页 -->
    <Pagination
      v-if="!loading && totalPages > 1"
      :current-page="page"
      :total-pages="totalPages"
      :total="total"
      :page-size="limit"
      @page-change="changePage"
      @size-change="changePageSize"
    />
  </div>
</template>

<style scoped>
.actors-page {
  min-height: 100%;
}

.container {
  max-width: none;
  margin: 0;
  padding: 0;
}

.page-title {
  font-size: 1.875rem;
  font-weight: 700;
  margin-bottom: 1.5rem;
  color: hsl(var(--foreground));
}

.filters {
  display: flex;
  gap: 1.25rem;
  margin-bottom: 2rem;
  flex-wrap: wrap;
  background: hsl(var(--card));
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
  color: hsl(var(--muted-foreground));
}

.filter-group select,
.filter-group input {
  padding: 0.625rem 0.75rem;
  border: 1px solid hsl(var(--border));
  border-radius: 0.5rem;
  font-size: 0.875rem;
  color: hsl(var(--foreground));
  background: hsl(var(--background));
  transition: all 0.2s;
}

.filter-group select:hover,
.filter-group input:hover {
  border-color: hsl(var(--primary) / 0.55);
}

.filter-group select:focus,
.filter-group input:focus {
  outline: none;
  border-color: hsl(var(--primary));
  box-shadow: 0 0 0 3px hsl(var(--ring) / 0.14);
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
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 0.75rem;
  overflow: hidden;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.actor-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
  border-color: hsl(var(--primary));
}

.actor-avatar {
  aspect-ratio: 3 / 4;
  background: hsl(var(--muted));
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
  color: hsl(var(--muted-foreground));
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
  color: hsl(var(--foreground));
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
  color: hsl(var(--primary));
}

.actor-meta {
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
}

.badge {
  display: inline-block;
  padding: 0.25rem 0.625rem;
  font-size: 0.6875rem;
  font-weight: 500;
  background: hsl(var(--status-warning-soft));
  color: hsl(var(--status-warning));
  border-radius: 9999px;
  align-self: flex-start;
}
</style>
