<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import SkeletonCard from '@/components/SkeletonCard.vue'
import { useErrorHandler } from '@/composables/useErrorHandler'
import { api } from '@/lib/api'

const { t } = useI18n()
const router = useRouter()
const { handleError } = useErrorHandler()

interface Stats {
  comics: number
  movies: number
  actors: number
  publishers: number
  users: number
  crawling: {
    movies: number
    comics: number
  }
  pending: {
    actors: number
    publishers: number
  }
}

const stats = ref<Stats>({
  comics: 0,
  movies: 0,
  actors: 0,
  publishers: 0,
  users: 0,
  crawling: { movies: 0, comics: 0 },
  pending: { actors: 0, publishers: 0 },
})

const loading = ref(true)

onMounted(async () => {
  try {
    const res = await api.admin.getStats()
    stats.value = res
  }
  catch (e) {
    handleError(e, '加载统计数据失败')
  }
  finally {
    loading.value = false
  }
})

function navigateTo(path: string) {
  router.push(path)
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold tracking-tight">
        {{ t('dashboard.overview') }}
      </h1>
      <p class="text-muted-foreground mt-1">
        {{ t('dashboard.welcome_back') }}. {{ t('dashboard.system_operational') }}
      </p>
    </div>

    <!-- 内容统计 -->
    <div>
      <h2 class="text-lg font-semibold mb-3">
        内容统计
      </h2>
      <div v-if="loading" class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <SkeletonCard v-for="i in 4" :key="i" variant="stat" />
      </div>
      <div v-else class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <!-- 漫画 -->
        <div
          class="p-6 border rounded-xl bg-card shadow-sm hover:shadow-md transition-all cursor-pointer hover:border-primary"
          @click="navigateTo('/comics')"
        >
          <div class="flex items-center justify-between">
            <div class="text-sm font-medium text-muted-foreground">
              总漫画数
            </div>
            <span class="text-2xl">📚</span>
          </div>
          <div class="text-3xl font-bold mt-2">
            {{ loading ? '...' : stats.comics.toLocaleString() }}
          </div>
          <p class="text-xs text-muted-foreground mt-2">
            点击查看漫画列表
          </p>
        </div>

        <!-- 电影 -->
        <div
          class="p-6 border rounded-xl bg-card shadow-sm hover:shadow-md transition-all cursor-pointer hover:border-primary"
          @click="navigateTo('/movies')"
        >
          <div class="flex items-center justify-between">
            <div class="text-sm font-medium text-muted-foreground">
              总电影数
            </div>
            <span class="text-2xl">🎬</span>
          </div>
          <div class="text-3xl font-bold mt-2">
            {{ loading ? '...' : stats.movies.toLocaleString() }}
          </div>
          <p class="text-xs text-muted-foreground mt-2">
            点击查看电影列表
          </p>
        </div>

        <!-- 女优 -->
        <div
          class="p-6 border rounded-xl bg-card shadow-sm hover:shadow-md transition-all cursor-pointer hover:border-primary"
          @click="navigateTo('/actors')"
        >
          <div class="flex items-center justify-between">
            <div class="text-sm font-medium text-muted-foreground">
              女优数量
            </div>
            <span class="text-2xl">⭐</span>
          </div>
          <div class="text-3xl font-bold mt-2">
            {{ loading ? '...' : stats.actors.toLocaleString() }}
          </div>
          <p class="text-xs text-muted-foreground mt-2">
            点击查看女优列表
          </p>
        </div>

        <!-- 厂商 -->
        <div
          class="p-6 border rounded-xl bg-card shadow-sm hover:shadow-md transition-all cursor-pointer hover:border-primary"
          @click="navigateTo('/publishers')"
        >
          <div class="flex items-center justify-between">
            <div class="text-sm font-medium text-muted-foreground">
              厂商数量
            </div>
            <span class="text-2xl">🏢</span>
          </div>
          <div class="text-3xl font-bold mt-2">
            {{ loading ? '...' : stats.publishers.toLocaleString() }}
          </div>
          <p class="text-xs text-muted-foreground mt-2">
            点击查看厂商列表
          </p>
        </div>
      </div>
    </div>

    <!-- 爬取状态 -->
    <div>
      <h2 class="text-lg font-semibold mb-3">
        爬取状态
      </h2>
      <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <!-- 爬取中的电影 -->
        <div class="p-6 border rounded-xl bg-card shadow-sm">
          <div class="flex items-center justify-between">
            <div class="text-sm font-medium text-muted-foreground">
              爬取中的电影
            </div>
            <span class="text-2xl">⏳</span>
          </div>
          <div class="text-3xl font-bold mt-2 text-orange-600">
            {{ loading ? '...' : stats.crawling.movies.toLocaleString() }}
          </div>
          <p class="text-xs text-muted-foreground mt-2">
            部分播放源未完成
          </p>
        </div>

        <!-- 爬取中的漫画 -->
        <div class="p-6 border rounded-xl bg-card shadow-sm">
          <div class="flex items-center justify-between">
            <div class="text-sm font-medium text-muted-foreground">
              爬取中的漫画
            </div>
            <span class="text-2xl">⏳</span>
          </div>
          <div class="text-3xl font-bold mt-2 text-orange-600">
            {{ loading ? '...' : stats.crawling.comics.toLocaleString() }}
          </div>
          <p class="text-xs text-muted-foreground mt-2">
            部分章节未完成
          </p>
        </div>

        <!-- 待爬取的女优 -->
        <div
          class="p-6 border rounded-xl bg-card shadow-sm hover:shadow-md transition-all cursor-pointer hover:border-yellow-500"
          @click="navigateTo('/actors')"
        >
          <div class="flex items-center justify-between">
            <div class="text-sm font-medium text-muted-foreground">
              待爬取女优详情
            </div>
            <span class="text-2xl">📝</span>
          </div>
          <div class="text-3xl font-bold mt-2 text-yellow-600">
            {{ loading ? '...' : stats.pending.actors.toLocaleString() }}
          </div>
          <p class="text-xs text-muted-foreground mt-2">
            点击查看待爬取列表
          </p>
        </div>

        <!-- 待爬取的厂商 -->
        <div
          class="p-6 border rounded-xl bg-card shadow-sm hover:shadow-md transition-all cursor-pointer hover:border-yellow-500"
          @click="navigateTo('/publishers')"
        >
          <div class="flex items-center justify-between">
            <div class="text-sm font-medium text-muted-foreground">
              待爬取厂商详情
            </div>
            <span class="text-2xl">📝</span>
          </div>
          <div class="text-3xl font-bold mt-2 text-yellow-600">
            {{ loading ? '...' : stats.pending.publishers.toLocaleString() }}
          </div>
          <p class="text-xs text-muted-foreground mt-2">
            点击查看待爬取列表
          </p>
        </div>
      </div>
    </div>

    <!-- 系统信息 -->
    <div>
      <h2 class="text-lg font-semibold mb-3">
        系统信息
      </h2>
      <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <!-- 用户数 -->
        <div
          class="p-6 border rounded-xl bg-card shadow-sm hover:shadow-md transition-all cursor-pointer hover:border-primary"
          @click="navigateTo('/users')"
        >
          <div class="flex items-center justify-between">
            <div class="text-sm font-medium text-muted-foreground">
              注册用户
            </div>
            <span class="text-2xl">👥</span>
          </div>
          <div class="text-3xl font-bold mt-2">
            {{ loading ? '...' : stats.users.toLocaleString() }}
          </div>
          <p class="text-xs text-muted-foreground mt-2">
            点击查看用户列表
          </p>
        </div>

        <!-- 爬虫监控 -->
        <div
          class="p-6 border rounded-xl bg-card shadow-sm hover:shadow-md transition-all cursor-pointer hover:border-primary"
          @click="navigateTo('/crawlers')"
        >
          <div class="flex items-center justify-between">
            <div class="text-sm font-medium text-muted-foreground">
              爬虫监控
            </div>
            <span class="text-2xl">🤖</span>
          </div>
          <div class="text-3xl font-bold mt-2 text-green-600">
            运行中
          </div>
          <p class="text-xs text-muted-foreground mt-2">
            点击查看爬虫状态
          </p>
        </div>

        <!-- 审计日志 -->
        <div
          class="p-6 border rounded-xl bg-card shadow-sm hover:shadow-md transition-all cursor-pointer hover:border-primary"
          @click="navigateTo('/audit-logs')"
        >
          <div class="flex items-center justify-between">
            <div class="text-sm font-medium text-muted-foreground">
              审计日志
            </div>
            <span class="text-2xl">📋</span>
          </div>
          <div class="text-3xl font-bold mt-2">
            查看
          </div>
          <p class="text-xs text-muted-foreground mt-2">
            点击查看操作日志
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
