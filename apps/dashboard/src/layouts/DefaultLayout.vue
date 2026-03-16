<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useResourceGuard } from '@/composables/useResourceGuard'
import { signOut, useSession } from '@/lib/auth-client'

const { t, locale } = useI18n()
const session = useSession()
const { canAccessComics, canAccessMovies, canAccessGlobal } = useResourceGuard()

const iconMap: Record<string, string> = {
  'home': '🏠',
  'book': '📚',
  'film': '🎬',
  'activity': '📊',
  'users': '👥',
  'building': '🏢',
  'clipboard': '📋',
  'file-text': '📄',
  'shield': '🔞',
  'settings': '⚙️',
}

function getIcon(iconName: string) {
  return iconMap[iconName] || '•'
}

const menuItems = computed(() => [
  {
    path: '/',
    label: t('dashboard.overview'),
    icon: 'home',
    show: true,
  },
  {
    path: '/comics',
    label: t('dashboard.comics'),
    icon: 'book',
    show: canAccessComics.value,
  },
  {
    path: '/movies',
    label: '电影管理',
    icon: 'film',
    show: canAccessMovies.value,
  },
  {
    path: '/crawlers',
    label: '爬虫监控',
    icon: 'activity',
    show: canAccessComics.value || canAccessMovies.value,
  },
  {
    path: '/actors',
    label: '演员管理',
    icon: 'users',
    show: canAccessMovies.value,
  },
  {
    path: '/publishers',
    label: '厂商管理',
    icon: 'building',
    show: canAccessMovies.value,
  },
  {
    path: '/audit-logs',
    label: '审计日志',
    icon: 'clipboard',
    show: canAccessGlobal.value,
  },
  {
    path: '/r18-whitelist',
    label: 'R18 白名单',
    icon: 'shield',
    show: canAccessGlobal.value,
  },
  {
    path: '/posts',
    label: t('dashboard.posts'),
    icon: 'file-text',
    show: canAccessGlobal.value,
  },
  {
    path: '/users',
    label: t('dashboard.users'),
    icon: 'users',
    show: canAccessGlobal.value,
  },
  {
    path: '/settings',
    label: t('dashboard.settings'),
    icon: 'settings',
    show: true,
  },
].filter(item => item.show))

function toggleLocale() {
  const newLocale = locale.value === 'zh' ? 'en' : 'zh'
  locale.value = newLocale
  localStorage.setItem('starye_i18n', newLocale)
}

async function handleLogout() {
  try {
    await signOut()
    window.location.href = '/auth/login'
  }
  catch (error) {
    console.error('登出失败:', error)
  }
}
</script>

<template>
  <div class="flex min-h-screen bg-muted/40">
    <!-- Sidebar -->
    <aside class="w-64 bg-background border-r flex flex-col fixed inset-y-0 z-10">
      <div class="h-14 flex items-center px-6 border-b font-bold tracking-tight text-lg">
        {{ t('dashboard.admin_console') }}
      </div>

      <nav class="flex-1 p-4 space-y-1">
        <RouterLink
          v-for="item in menuItems"
          :key="item.path"
          :to="item.path"
          class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-muted"
          active-class=""
          :exact-active-class="item.path === '/' ? 'bg-muted text-primary' : ''"
          :class="{ 'bg-muted text-primary': item.path !== '/' && $route.path.startsWith(item.path) }"
        >
          <span class="text-lg">
            {{ getIcon(item.icon) }}
          </span>
          {{ item.label }}
        </RouterLink>
      </nav>

      <div class="p-4 space-y-2 border-t">
        <button class="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-sm font-medium hover:bg-muted transition-colors" @click="toggleLocale">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>
          {{ locale === 'zh' ? 'English' : '简体中文' }}
        </button>
        <button class="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors" @click="handleLogout">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
          {{ t('dashboard.sign_out') }}
        </button>
      </div>
    </aside>

    <!-- Content -->
    <main class="flex-1 ml-64 p-8">
      <div class="mb-8 flex items-center justify-between">
        <h1 class="text-2xl font-bold tracking-tight">
          {{ t('dashboard.dashboard') }}
        </h1>
        <div v-if="session.data" class="flex items-center gap-2">
          <span class="text-sm text-muted-foreground">{{ t('dashboard.welcome') }}, {{ session.data.user.name }}</span>
          <img :src="session.data.user.image || `https://ui-avatars.com/api/?name=${session.data.user.name}`" class="w-8 h-8 rounded-full border bg-background">
        </div>
      </div>

      <RouterView />
    </main>
  </div>
</template>
