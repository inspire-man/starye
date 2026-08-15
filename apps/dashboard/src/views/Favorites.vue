<script setup lang="ts">
/** 用户收藏列表：统一筛选、表格操作栏和服务端分页。 */

import { DataTable, DetailDrawer, Pagination, useFilters, usePagination } from '@starye/ui'
import { ref, watch } from 'vue'
import FavoriteButton from '@/components/FavoriteButton.vue'
import { fetchApi } from '@/lib/api'
import { formatDateTime } from '@/lib/date-utils'

interface Favorite {
  id: string
  userId: string
  entityType: 'actor' | 'publisher' | 'movie' | 'comic'
  entityId: string
  createdAt: number
}

interface EntityDetails {
  id: string
  name: string
  slug?: string
  avatar?: string
  logo?: string
  coverImage?: string
  movieCount?: number
}

const favorites = ref<Favorite[]>([])
const entityDetailsMap = ref<Map<string, EntityDetails>>(new Map())
const loading = ref(false)
const error = ref('')
const selectedFavorite = ref<Favorite | null>(null)
const favoriteDrawerOpen = ref(false)

const { filters, applyFilters } = useFilters({ entityType: '' })
const { currentPage, limit: pageSize, totalPages, total: totalItems, setMeta, goToPage, updatePageSize } = usePagination()

const favoriteTableColumns = [
  { key: 'entity', label: '内容', minWidth: '280px' },
  { key: 'entityType', label: '类型', width: '110px' },
  { key: 'movieCount', label: '作品数', width: '100px' },
  { key: 'createdAt', label: '收藏时间', width: '170px' },
  { key: 'actions', label: '操作', width: '90px' },
]

watch([currentPage, pageSize, () => filters.value.entityType], loadFavorites, { immediate: true })

async function loadFavorites() {
  loading.value = true
  error.value = ''

  try {
    const params = new URLSearchParams({
      page: String(currentPage.value),
      limit: String(pageSize.value),
    })
    if (filters.value.entityType)
      params.append('entityType', filters.value.entityType)

    const response = await fetchApi<{
      success: boolean
      data: Favorite[]
      meta: { total: number, page: number, limit: number, totalPages: number }
    }>(`/favorites?${params}`)

    favorites.value = response.data || []
    setMeta({ total: response.meta.total, totalPages: response.meta.totalPages })
    await loadEntityDetails()
  }
  catch (e: any) {
    error.value = e.message || '加载失败'
    console.error('Failed to load favorites:', e)
  }
  finally {
    loading.value = false
  }
}

async function loadEntityDetails() {
  const detailsMap = new Map<string, EntityDetails>()
  const actorIds = favorites.value.filter(f => f.entityType === 'actor').map(f => f.entityId)
  const publisherIds = favorites.value.filter(f => f.entityType === 'publisher').map(f => f.entityId)

  for (const id of actorIds) {
    try {
      const response = await fetchApi<{ data: any }>(`/admin/actors/${id}`)
      detailsMap.set(id, {
        id: response.data.id,
        name: response.data.name,
        slug: response.data.slug,
        avatar: response.data.avatar,
        movieCount: response.data.movieCount,
      })
    }
    catch (e) {
      console.error(`Failed to load actor ${id}:`, e)
    }
  }

  for (const id of publisherIds) {
    try {
      const response = await fetchApi<{ data: any }>(`/admin/publishers/${id}`)
      detailsMap.set(id, {
        id: response.data.id,
        name: response.data.name,
        slug: response.data.slug,
        logo: response.data.logo,
        movieCount: response.data.movieCount,
      })
    }
    catch (e) {
      console.error(`Failed to load publisher ${id}:`, e)
    }
  }

  entityDetailsMap.value = detailsMap
}

function getEntityDetails(entityId: string): EntityDetails | null {
  return entityDetailsMap.value.get(entityId) || null
}

function getEntityTypeName(type: string): string {
  return ({ actor: '演员', publisher: '厂商', movie: '电影', comic: '漫画' } as Record<string, string>)[type] || type
}

function handleUnfavorited(favoriteId: string) {
  favorites.value = favorites.value.filter(f => f.id !== favoriteId)
  if (favorites.value.length === 0 && currentPage.value > 1)
    goToPage(currentPage.value - 1)
}

function openFavoriteDetails(favorite: Favorite) {
  selectedFavorite.value = favorite
  favoriteDrawerOpen.value = true
}

function closeFavoriteDetails() {
  favoriteDrawerOpen.value = false
  selectedFavorite.value = null
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h2 class="text-2xl font-bold tracking-tight">
          我的收藏
        </h2>
        <p class="mt-1 text-sm text-muted-foreground">
          管理您收藏的演员、厂商和内容
        </p>
      </div>
      <div class="flex items-center gap-3">
        <label class="sr-only" for="favorite-type-filter">收藏类型</label>
        <select id="favorite-type-filter" v-model="filters.entityType" class="h-9 rounded-md border border-border bg-background px-3 text-sm transition-colors hover:border-primary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15" @change="applyFilters">
          <option value="">
            全部类型
          </option>
          <option value="actor">
            演员
          </option>
          <option value="publisher">
            厂商
          </option>
          <option value="movie">
            电影
          </option>
          <option value="comic">
            漫画
          </option>
        </select>
        <span class="text-sm text-muted-foreground">共 {{ totalItems }} 个收藏</span>
      </div>
    </div>

    <div v-if="error" class="rounded-lg border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive" role="alert">
      {{ error }}
    </div>

    <DataTable
      :data="favorites"
      :columns="favoriteTableColumns"
      :loading="loading"
      min-width="760px"
      empty-message="暂无收藏"
      @row-click="openFavoriteDetails"
    >
      <template #cell-entity="{ item }">
        <div class="flex items-center gap-3">
          <img v-if="getEntityDetails(item.entityId)?.avatar" :src="getEntityDetails(item.entityId)!.avatar" :alt="getEntityDetails(item.entityId)?.name" class="h-9 w-9 rounded-full border border-border object-cover">
          <img v-else-if="getEntityDetails(item.entityId)?.logo" :src="getEntityDetails(item.entityId)!.logo" :alt="getEntityDetails(item.entityId)?.name" class="h-9 w-9 rounded-md border border-border object-contain p-1">
          <div v-else class="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground">
            {{ getEntityDetails(item.entityId)?.name?.charAt(0) || '?' }}
          </div>
          <div class="min-w-0">
            <div class="truncate font-medium">
              {{ getEntityDetails(item.entityId)?.name || '加载中...' }}
            </div>
            <div class="truncate font-mono text-xs text-muted-foreground">
              {{ item.entityId }}
            </div>
          </div>
        </div>
      </template>
      <template #cell-entityType="{ item }">
        <span class="inline-flex items-center rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-medium">{{ getEntityTypeName(item.entityType) }}</span>
      </template>
      <template #cell-movieCount="{ item }">
        <span class="text-sm text-muted-foreground">{{ getEntityDetails(item.entityId)?.movieCount ?? '-' }}</span>
      </template>
      <template #cell-createdAt="{ item }">
        <span class="text-xs text-muted-foreground">{{ formatDateTime(item.createdAt) }}</span>
      </template>
      <template #cell-actions="{ item }">
        <div class="flex justify-end" @click.stop>
          <FavoriteButton :entity-type="item.entityType" :entity-id="item.entityId" compact @unfavorited="handleUnfavorited(item.id)" />
        </div>
      </template>
    </DataTable>

    <Pagination
      v-if="loading || totalItems > 0"
      :current-page="currentPage"
      :total-pages="totalPages"
      :total="totalItems"
      :loading="loading"
      :page-size="pageSize"
      :page-sizes="[12, 24, 48]"
      layout="total, sizes, prev, pager, next, jumper"
      @update:current-page="goToPage"
      @update:page-size="updatePageSize"
    />

    <DetailDrawer
      :open="favoriteDrawerOpen && !!selectedFavorite"
      :title="selectedFavorite ? (getEntityDetails(selectedFavorite.entityId)?.name || getEntityTypeName(selectedFavorite.entityType)) : '收藏详情'"
      :description="selectedFavorite?.entityId || ''"
      width="sm"
      @update:open="$event ? undefined : closeFavoriteDetails()"
    >
      <div v-if="selectedFavorite" class="space-y-5">
        <div class="flex items-center gap-4 rounded-xl border border-border bg-muted/30 p-4">
          <img
            v-if="getEntityDetails(selectedFavorite.entityId)?.avatar || getEntityDetails(selectedFavorite.entityId)?.logo"
            :src="getEntityDetails(selectedFavorite.entityId)?.avatar || getEntityDetails(selectedFavorite.entityId)?.logo"
            :alt="getEntityDetails(selectedFavorite.entityId)?.name || selectedFavorite.entityId"
            class="h-16 w-16 rounded-xl border border-border bg-background object-cover"
          >
          <div v-else class="flex h-16 w-16 items-center justify-center rounded-xl bg-primary/10 text-xl font-semibold text-primary">
            {{ getEntityDetails(selectedFavorite.entityId)?.name?.charAt(0) || '?' }}
          </div>
          <div class="min-w-0">
            <p class="truncate font-semibold">
              {{ getEntityDetails(selectedFavorite.entityId)?.name || '内容详情' }}
            </p>
            <p class="mt-1 text-sm text-muted-foreground">
              {{ getEntityTypeName(selectedFavorite.entityType) }}
            </p>
          </div>
        </div>

        <dl class="divide-y divide-border rounded-xl border border-border">
          <div class="flex items-center justify-between gap-4 px-4 py-3">
            <dt class="text-sm text-muted-foreground">
              内容类型
            </dt>
            <dd class="text-sm font-medium">
              {{ getEntityTypeName(selectedFavorite.entityType) }}
            </dd>
          </div>
          <div class="flex items-center justify-between gap-4 px-4 py-3">
            <dt class="text-sm text-muted-foreground">
              内容 ID
            </dt>
            <dd class="break-all text-right font-mono text-xs">
              {{ selectedFavorite.entityId }}
            </dd>
          </div>
          <div class="flex items-center justify-between gap-4 px-4 py-3">
            <dt class="text-sm text-muted-foreground">
              作品数
            </dt>
            <dd class="text-sm font-medium">
              {{ getEntityDetails(selectedFavorite.entityId)?.movieCount ?? '-' }}
            </dd>
          </div>
          <div class="flex items-center justify-between gap-4 px-4 py-3">
            <dt class="text-sm text-muted-foreground">
              收藏时间
            </dt>
            <dd class="text-sm">
              {{ formatDateTime(selectedFavorite.createdAt) }}
            </dd>
          </div>
        </dl>
      </div>
    </DetailDrawer>
  </div>
</template>

