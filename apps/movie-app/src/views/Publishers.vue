<script setup lang="ts">
import type { SelectOption } from '@starye/ui'
import type { Publisher } from '../types'
import { Pagination, Select, SkeletonCard, useListQuery } from '@starye/ui'
import { onMounted, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { publisherApi } from '../lib/api-client'

const route = useRoute()
const router = useRouter()

const publishers = ref<Publisher[]>([])
const { page, limit, total, totalPages, loading, error, execute, goToPage, updatePageSize } = useListQuery(30)

const sort = ref<'name' | 'movieCount' | 'createdAt'>('movieCount')

const sortOptions: SelectOption<string>[] = [
  { label: '作品数', value: 'movieCount', icon: '🎬' },
  { label: '名称', value: 'name', icon: '🔤' },
  { label: '最新', value: 'createdAt', icon: '📅' },
]

// 将当前状态同步到 URL query
async function syncUrl(pageNumber = page.value): Promise<void> {
  await router.replace({
    query: {
      ...route.query,
      ...(pageNumber > 1 ? { page: String(pageNumber) } : { page: undefined }),
      sort: sort.value !== 'movieCount' ? sort.value : undefined,
    },
  })
}

async function fetchPublishers() {
  const data = await execute(({ page, limit }) => publisherApi.getPublishers({
    page,
    limit,
    sort: sort.value,
  }).then((response) => {
    if (!response.success)
      throw new Error('加载厂商失败')
    return response
  }), '加载厂商失败')
  if (data)
    publishers.value = data
}

async function changePage(page: number): Promise<void> {
  await goToPage(page)
  await fetchPublishers()
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

async function changePageSize(size: number): Promise<void> {
  await updatePageSize(size)
  await fetchPublishers()
}

async function onSortChange(): Promise<void> {
  await syncUrl(1)
  await fetchPublishers()
}

onMounted(() => {
  // 从 URL query 恢复状态
  sort.value = (route.query.sort as typeof sort.value) || 'movieCount'
  fetchPublishers()
})
</script>

<template>
  <div class="ui-public-page">
    <!-- 顶栏 -->
    <div class="ui-public-page-header">
      <div>
        <h1 class="ui-public-page-title">
          厂商
        </h1>
        <p class="ui-public-page-description">
          共 {{ total }} 家厂商
        </p>
      </div>
      <Select
        v-model="sort"
        :options="sortOptions"
        size="default"
        @change="onSortChange"
      />
    </div>

    <!-- 加载骨架 -->
    <div v-if="loading" class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      <SkeletonCard v-for="n in 12" :key="n" variant="row" />
    </div>

    <!-- 厂商列表 -->
    <div v-else-if="error" class="ui-public-empty">
      <span class="text-3xl text-[hsl(var(--status-danger))]">!</span>
      <p>{{ error }}</p>
      <button class="ui-public-button ui-public-button-ghost" @click="fetchPublishers">
        重试
      </button>
    </div>

    <div v-else-if="publishers.length > 0" class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
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
          <span v-else class="text-2xl font-bold uppercase text-muted-foreground">
            {{ publisher.name[0] }}
          </span>
        </div>
        <!-- 信息区 -->
        <div class="px-3 pb-3 pt-2">
          <p class="line-clamp-2 text-sm font-semibold leading-snug text-foreground">
            {{ publisher.name }}
          </p>
          <p class="mt-1 text-xs font-medium text-primary">
            {{ publisher.movieCount ?? 0 }} 部作品
          </p>
        </div>
      </RouterLink>
    </div>

    <div v-else class="ui-public-empty">
      <span class="text-3xl">🏢</span>
      <p>暂无厂商</p>
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
.publisher-card {
  display: flex;
  flex-direction: column;
  text-decoration: none;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 0.75rem;
  overflow: hidden;
  transition: border-color 0.2s, transform 0.2s, box-shadow 0.2s;
}

.publisher-card:hover {
  border-color: hsl(var(--primary));
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgb(0 0 0 / 0.3);
}

.logo-area {
  aspect-ratio: 16 / 7;
  background: hsl(var(--muted));
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
