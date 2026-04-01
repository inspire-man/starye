<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import ToastContainer from '@/components/ToastContainer.vue'
import { useResourceGuard } from '@/composables/useResourceGuard'
import { signOut, useSession } from '@/lib/auth-client'

const { t, locale } = useI18n()
const session = useSession()
const { canAccessComics, canAccessMovies, canAccessGlobal } = useResourceGuard()

// 移动端检测
const isMobile = ref(false)
function updateMobileState() {
  isMobile.value = window.innerWidth <= 768
}

onMounted(() => {
  updateMobileState()
  window.addEventListener('resize', updateMobileState)
})

onUnmounted(() => {
  window.removeEventListener('resize', updateMobileState)
})

// 侧边栏状态
// 移动端使用抽屉模式（默认关闭），桌面端使用折叠模式（默认展开）
const sidebarCollapsed = ref(false)
const mobileDrawerOpen = ref(false)

// 菜单展开状态
const expandedMenus = ref<Set<string>>(new Set(['movies', 'comics']))

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

function toggleMenu(menuKey: string) {
  if (expandedMenus.value.has(menuKey)) {
    expandedMenus.value.delete(menuKey)
  }
  else {
    expandedMenus.value.add(menuKey)
  }
}

function handleMenuItemClick() {
  // 移动端点击菜单项后关闭抽屉
  if (isMobile.value) {
    closeMobileDrawer()
  }
}

function toggleSidebar() {
  if (isMobile.value) {
    mobileDrawerOpen.value = !mobileDrawerOpen.value
  }
  else {
    sidebarCollapsed.value = !sidebarCollapsed.value
  }
}

function closeMobileDrawer() {
  mobileDrawerOpen.value = false
}

const menuItems = computed(() => [
  {
    key: 'home',
    path: '/',
    label: t('dashboard.overview'),
    icon: 'home',
    show: true,
  },
  {
    key: 'comics',
    label: '漫画管理',
    icon: 'book',
    show: canAccessComics.value,
    children: [
      {
        path: '/comics',
        label: '漫画列表',
        show: canAccessComics.value,
      },
    ],
  },
  {
    key: 'movies',
    label: '电影管理',
    icon: 'film',
    show: canAccessMovies.value,
    children: [
      {
        path: '/movies',
        label: '电影列表',
        show: canAccessMovies.value,
      },
      {
        path: '/actors',
        label: '演员管理',
        show: canAccessMovies.value,
      },
      {
        path: '/publishers',
        label: '厂商管理',
        show: canAccessMovies.value,
      },
    ],
  },
  {
    key: 'crawlers',
    label: '爬虫监控',
    icon: 'activity',
    show: canAccessComics.value || canAccessMovies.value,
    children: [
      {
        path: '/crawlers',
        label: '爬虫列表',
        show: canAccessComics.value || canAccessMovies.value,
      },
      {
        path: '/name-mapping-management',
        label: '名字映射管理',
        show: canAccessMovies.value,
      },
      {
        path: '/mapping-quality-report',
        label: '映射质量报告',
        show: canAccessMovies.value,
      },
    ],
  },
  {
    key: 'audit',
    label: '审计日志',
    icon: 'clipboard',
    show: canAccessGlobal.value,
    children: [
      {
        path: '/audit-logs',
        label: '日志列表',
        show: canAccessGlobal.value,
      },
    ],
  },
  {
    key: 'r18',
    label: 'R18 白名单',
    icon: 'shield',
    show: canAccessGlobal.value,
    children: [
      {
        path: '/r18-whitelist',
        label: '白名单列表',
        show: canAccessGlobal.value,
      },
    ],
  },
  {
    key: 'blog',
    label: '博客管理',
    icon: 'file-text',
    show: canAccessGlobal.value,
    children: [
      {
        path: '/posts',
        label: '文章列表',
        show: canAccessGlobal.value,
      },
    ],
  },
  {
    key: 'user-management',
    label: '用户管理',
    icon: 'users',
    show: canAccessGlobal.value,
    children: [
      {
        path: '/users',
        label: '用户列表',
        show: canAccessGlobal.value,
      },
    ],
  },
  {
    key: 'settings',
    label: '设置',
    icon: 'settings',
    show: true,
    children: [
      {
        path: '/settings',
        label: '系统设置',
        show: true,
      },
    ],
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
    <!-- 移动端遮罩 -->
    <div
      v-if="isMobile && mobileDrawerOpen"
      class="fixed inset-0 bg-black/50 z-40 transition-opacity"
      @click="closeMobileDrawer"
    />

    <!-- Sidebar（桌面端固定，移动端抽屉） -->
    <aside
      class="bg-background border-r flex flex-col transition-all duration-300"
      :class="[
        isMobile
          ? ['fixed inset-y-0 left-0 z-50 w-64', mobileDrawerOpen ? 'translate-x-0' : '-translate-x-full']
          : ['fixed inset-y-0 z-10', sidebarCollapsed ? 'w-16' : 'w-64'],
      ]"
    >
      <div class="h-14 flex items-center justify-between px-4 border-b">
        <span v-if="!sidebarCollapsed" class="font-bold tracking-tight text-lg">
          {{ t('dashboard.admin_console') }}
        </span>
        <button
          class="p-1 rounded-lg hover:bg-muted transition-colors"
          :title="sidebarCollapsed ? '展开侧边栏' : '折叠侧边栏'"
          @click="toggleSidebar"
        >
          <svg
            class="w-5 h-5 transition-transform"
            :class="{ 'rotate-180': sidebarCollapsed }"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
      </div>

      <nav class="flex-1 p-2 space-y-1 overflow-y-auto">
        <template v-for="item in menuItems" :key="item.key">
          <!-- 有子菜单的项 -->
          <div v-if="item.children" class="space-y-1">
            <button
              class="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium hover:bg-muted transition-colors"
              :class="{ 'justify-center': sidebarCollapsed }"
              :title="sidebarCollapsed ? item.label : ''"
              @click="toggleMenu(item.key)"
            >
              <span class="text-lg shrink-0">
                {{ getIcon(item.icon) }}
              </span>
              <span v-if="!sidebarCollapsed" class="flex-1 text-left">{{ item.label }}</span>
              <svg
                v-if="!sidebarCollapsed"
                class="w-4 h-4 transition-transform shrink-0"
                :class="{ 'rotate-90': expandedMenus.has(item.key) }"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>

            <!-- 子菜单 -->
            <div
              v-if="!sidebarCollapsed"
              v-show="expandedMenus.has(item.key)"
              class="space-y-1 pl-4"
            >
              <RouterLink
                v-for="child in item.children.filter(c => c.show)"
                :key="child.path"
                :to="child.path"
                class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-muted"
                active-class=""
                :exact-active-class="child.path === '/' ? 'bg-muted text-primary' : ''"
                :class="{ 'bg-muted text-primary': child.path !== '/' && $route.path.startsWith(child.path) }"
                @click="handleMenuItemClick"
              >
                <span class="w-1 h-1 rounded-full bg-current" />
                {{ child.label }}
              </RouterLink>
            </div>
          </div>

          <!-- 无子菜单的项 -->
          <RouterLink
            v-else
            :to="item.path!"
            class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-muted"
            :class="{ 'justify-center': sidebarCollapsed }"
            active-class=""
            :exact-active-class="item.path === '/' ? 'bg-muted text-primary' : ''"
            :title="sidebarCollapsed ? item.label : ''"
            @click="handleMenuItemClick"
          >
            <span class="text-lg shrink-0">
              {{ getIcon(item.icon) }}
            </span>
            <span v-if="!sidebarCollapsed">{{ item.label }}</span>
          </RouterLink>
        </template>
      </nav>

      <div class="p-2 space-y-1 border-t">
        <button
          class="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-sm font-medium hover:bg-muted transition-colors"
          :class="{ 'justify-center': sidebarCollapsed }"
          :title="sidebarCollapsed ? (locale === 'zh' ? 'English' : '简体中文') : ''"
          @click="toggleLocale"
        >
          <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>
          <span v-if="!sidebarCollapsed">{{ locale === 'zh' ? 'English' : '简体中文' }}</span>
        </button>
        <button
          class="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
          :class="{ 'justify-center': sidebarCollapsed }"
          :title="sidebarCollapsed ? t('dashboard.sign_out') : ''"
          @click="handleLogout"
        >
          <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
          <span v-if="!sidebarCollapsed">{{ t('dashboard.sign_out') }}</span>
        </button>
      </div>
    </aside>

    <!-- Content -->
    <main
      class="flex-1 p-4 md:p-8 transition-all duration-300"
      :class="isMobile ? 'ml-0' : (sidebarCollapsed ? 'ml-16' : 'ml-64')"
    >
      <div class="mb-6 md:mb-8 flex items-center justify-between gap-4">
        <!-- 移动端汉堡菜单 -->
        <button
          v-if="isMobile"
          class="p-2 rounded-lg hover:bg-muted transition-colors"
          @click="toggleSidebar"
        >
          <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>

        <h1 class="text-xl md:text-2xl font-bold tracking-tight">
          {{ t('dashboard.dashboard') }}
        </h1>

        <div v-if="session.data" class="flex items-center gap-2">
          <span class="text-sm text-muted-foreground hidden md:inline">{{ t('dashboard.welcome') }}, {{ session.data.user.name }}</span>
          <img :src="session.data.user.image || `https://ui-avatars.com/api/?name=${session.data.user.name}`" class="w-8 h-8 rounded-full border bg-background">
        </div>
      </div>

      <RouterView />
    </main>

    <!-- Toast 通知容器 -->
    <ToastContainer />
  </div>
</template>
