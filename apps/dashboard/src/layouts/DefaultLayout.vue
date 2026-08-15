<script setup lang="ts">
import type { Component } from 'vue'
import { Breadcrumbs, ToastContainer } from '@starye/ui'
import {
  Activity,
  BookOpen,
  Building2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileText,
  Film,
  Globe2,
  Home,
  LogOut,
  Menu,
  Settings,
  ShieldAlert,
  Theater,
  Users,
} from 'lucide-vue-next'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useResourceGuard } from '@/composables/useResourceGuard'
import { signOut, useSession } from '@/lib/auth-client'

const { t, locale } = useI18n()
const session = useSession()
const route = useRoute()
const router = useRouter()
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

const iconMap: Record<string, Component> = {
  'home': Home,
  'book': BookOpen,
  'film': Film,
  'activity': Activity,
  'users': Users,
  'building': Building2,
  'clipboard': ClipboardList,
  'file-text': FileText,
  'shield': ShieldAlert,
  'settings': Settings,
  'tavern': Theater,
}

function getIcon(iconName: string): Component {
  return iconMap[iconName] || Home
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
        label: '爬虫监控',
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
    key: 'tavern',
    label: '角色模拟 (Tavern)',
    icon: 'tavern',
    show: canAccessGlobal.value,
    path: '/tavern/',
    isExternal: true,
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

const breadcrumbItems = computed(() => {
  const currentPath = route.path.replace(/\/$/, '') || '/'
  if (currentPath === '/')
    return [{ label: t('dashboard.overview') }]

  const parent = menuItems.value.find(item => item.children?.some(child => currentPath === child.path || currentPath.startsWith(`${child.path}/`)))
  const child = parent?.children?.find(item => currentPath === item.path || currentPath.startsWith(`${item.path}/`))

  if (child) {
    const items = [{ label: t('dashboard.overview'), to: '/' }, { label: child.label }]
    if (currentPath !== child.path) {
      items[1] = { label: child.label, to: child.path }
      items.push({ label: currentPath.startsWith('/posts/') ? '文章编辑' : currentPath.startsWith('/actors/') ? '演员详情' : currentPath.startsWith('/publishers/') ? '厂商详情' : '详情' })
    }
    return items
  }

  const routeLabels: Record<string, string> = {
    '/favorites': '我的收藏',
  }
  return [{ label: t('dashboard.overview'), to: '/' }, { label: routeLabels[currentPath] ?? t('dashboard.dashboard') }]
})

function navigateBreadcrumb(to: string): void {
  router.push(to)
}

function navigateBreadcrumbBack(): void {
  const fallback = breadcrumbItems.value.at(-2)?.to ?? '/'
  router.push(fallback)
}

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
  <div class="dashboard-shell flex min-h-screen bg-muted/40">
    <!-- 移动端遮罩 -->
    <div
      v-if="isMobile && mobileDrawerOpen"
      class="dashboard-mobile-backdrop fixed inset-0 bg-black/50 z-40 transition-opacity"
      @click="closeMobileDrawer"
    />

    <!-- Sidebar（桌面端固定，移动端抽屉） -->
    <aside
      class="dashboard-sidebar bg-background border-r flex flex-col transition-all duration-300"
      :class="[
        isMobile
          ? ['fixed inset-y-0 left-0 z-50 w-64', mobileDrawerOpen ? 'translate-x-0' : '-translate-x-full']
          : ['fixed inset-y-0 z-10', sidebarCollapsed ? 'w-16' : 'w-64'],
      ]"
    >
      <div class="dashboard-sidebar-header h-14 flex items-center justify-between px-4 border-b">
        <span v-if="!sidebarCollapsed" class="font-bold tracking-tight text-lg">
          {{ t('dashboard.admin_console') }}
        </span>
        <button
          class="dashboard-sidebar-toggle p-1 rounded-lg hover:bg-muted transition-colors"
          :title="sidebarCollapsed ? '展开侧边栏' : '折叠侧边栏'"
          @click="toggleSidebar"
        >
          <ChevronLeft
            :size="20"
            class="transition-transform"
            :class="{ 'rotate-180': sidebarCollapsed }"
            aria-hidden="true"
          />
        </button>
      </div>

      <nav class="dashboard-sidebar-nav flex-1 p-2 space-y-1 overflow-y-auto">
        <template v-for="item in menuItems" :key="item.key">
          <!-- 有子菜单的项 -->
          <div v-if="item.children" class="space-y-1">
            <button
              class="dashboard-menu-group w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium hover:bg-muted transition-colors"
              :class="{ 'justify-center': sidebarCollapsed }"
              :title="sidebarCollapsed ? item.label : ''"
              @click="toggleMenu(item.key)"
            >
              <component :is="getIcon(item.icon)" :size="18" class="shrink-0" aria-hidden="true" />
              <span v-if="!sidebarCollapsed" class="flex-1 text-left">{{ item.label }}</span>
              <ChevronRight
                v-if="!sidebarCollapsed"
                :size="16"
                class="transition-transform shrink-0"
                :class="{ 'rotate-90': expandedMenus.has(item.key) }"
                aria-hidden="true"
              />
            </button>

            <!-- 子菜单 -->
            <div
              v-if="!sidebarCollapsed"
              v-show="expandedMenus.has(item.key)"
              class="dashboard-submenu space-y-1 pl-4"
            >
              <RouterLink
                v-for="child in item.children.filter(c => c.show)"
                :key="child.path"
                :to="child.path"
                class="dashboard-menu-link flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-muted"
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
          <component
            :is="item.isExternal ? 'a' : 'RouterLink'"
            v-else
            :to="!item.isExternal ? item.path : undefined"
            :href="item.isExternal ? item.path : undefined"
            :target="item.isExternal ? '_blank' : undefined"
            rel="noopener noreferrer"
            class="dashboard-menu-link flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-muted"
            :class="{ 'justify-center': sidebarCollapsed }"
            active-class=""
            :exact-active-class="!item.isExternal && item.path === '/' ? 'bg-muted text-primary' : ''"
            :title="sidebarCollapsed ? item.label : ''"
            @click="!item.isExternal ? handleMenuItemClick() : undefined"
          >
            <component :is="getIcon(item.icon)" :size="18" class="shrink-0" aria-hidden="true" />
            <span v-if="!sidebarCollapsed">{{ item.label }}</span>
          </component>
        </template>
      </nav>

      <div class="dashboard-sidebar-footer p-2 space-y-1 border-t">
        <button
          class="dashboard-sidebar-action flex items-center gap-3 px-3 py-2 w-full rounded-lg text-sm font-medium hover:bg-muted transition-colors"
          :class="{ 'justify-center': sidebarCollapsed }"
          :title="sidebarCollapsed ? (locale === 'zh' ? 'English' : '简体中文') : ''"
          @click="toggleLocale"
        >
          <Globe2 :size="16" class="shrink-0" aria-hidden="true" />
          <span v-if="!sidebarCollapsed">{{ locale === 'zh' ? 'English' : '简体中文' }}</span>
        </button>
        <button
          class="dashboard-sidebar-action dashboard-sidebar-action-danger flex items-center gap-3 px-3 py-2 w-full rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
          :class="{ 'justify-center': sidebarCollapsed }"
          :title="sidebarCollapsed ? t('dashboard.sign_out') : ''"
          @click="handleLogout"
        >
          <LogOut :size="16" class="shrink-0" aria-hidden="true" />
          <span v-if="!sidebarCollapsed">{{ t('dashboard.sign_out') }}</span>
        </button>
      </div>
    </aside>

    <!-- Content -->
    <main
      class="dashboard-main flex-1 transition-all duration-300"
      :class="isMobile ? 'ml-0' : (sidebarCollapsed ? 'ml-16' : 'ml-64')"
    >
      <div class="dashboard-content-header flex items-center justify-between gap-4">
        <!-- 移动端汉堡菜单 -->
        <button
          v-if="isMobile"
          class="dashboard-mobile-menu p-2 rounded-lg hover:bg-muted transition-colors"
          type="button"
          aria-label="打开菜单"
          title="打开菜单"
          @click="toggleSidebar"
        >
          <Menu :size="22" aria-hidden="true" />
        </button>

        <div class="page-heading min-w-0 flex-1">
          <Breadcrumbs
            :items="breadcrumbItems"
            @navigate="navigateBreadcrumb"
            @back="navigateBreadcrumbBack"
          />
        </div>

        <div v-if="session.data" class="dashboard-user flex items-center gap-2">
          <span class="dashboard-user-welcome text-sm text-muted-foreground hidden md:inline">{{ t('dashboard.welcome') }}, {{ session.data.user.name }}</span>
          <img :src="session.data.user.image || `https://ui-avatars.com/api/?name=${session.data.user.name}`" class="dashboard-user-avatar w-8 h-8 rounded-full border bg-background">
        </div>
      </div>

      <RouterView />
    </main>

    <!-- Toast 通知容器 -->
    <ToastContainer />
  </div>
</template>
