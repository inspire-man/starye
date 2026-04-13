<script setup lang="ts">
import type { NavItem } from './components/BottomNavigation.vue'
import { computed, onMounted, ref } from 'vue'
import { RouterLink, RouterView, useRouter } from 'vue-router'
import BottomNavigation from './components/BottomNavigation.vue'
import DrawerFooter from './components/DrawerFooter.vue'
import Header from './components/Header.vue'
import MobileDrawer from './components/MobileDrawer.vue'
import { useDownloadList } from './composables/useDownloadList'
import { useDrawer } from './composables/useDrawer'
import { useMobileDetect } from './composables/useMobileDetect'
import { useToast } from './composables/useToast'
import { useUserStore } from './stores/user'

const userStore = useUserStore()
const router = useRouter()
const { isMobile } = useMobileDetect()
const { isOpen: drawerOpen, open: openDrawer, close: closeDrawer } = useDrawer()
const { stats: downloadStats } = useDownloadList()
const { toast } = useToast()

// 搜索模式状态
const isSearchMode = ref(false)

// 底部导航配置
const bottomNavItems = computed<NavItem[]>(() => [
  {
    path: '/',
    icon: '🏠',
    label: '首页',
  },
  {
    path: '/new-releases',
    icon: '✨',
    label: '新片',
  },
  {
    path: '/actors',
    icon: '👥',
    label: '女优',
  },
  {
    path: '/profile',
    icon: '👤',
    label: '我的',
    badge: downloadStats.value.total > 0 ? downloadStats.value.total : undefined,
  },
])

// 抽屉菜单配置
const drawerMenuItems = computed(() => [
  {
    section: '浏览',
    items: [
      {
        path: '/publishers',
        icon: '🏢',
        label: '厂商列表',
      },
    ],
  },
  {
    section: '我的',
    items: [
      {
        path: '/favorites',
        icon: '⭐',
        label: '收藏夹',
      },
    ],
  },
  {
    section: '其他',
    items: [
      { path: '/help', icon: '📖', label: '帮助' },
      { path: '/about', icon: 'ℹ️', label: '关于' },
    ],
  },
])

// 处理抽屉打开
function handleOpenDrawer() {
  openDrawer()
}

// 处理搜索打开
function handleOpenSearch() {
  isSearchMode.value = true
  // 如果不在搜索页，导航到搜索页
  if (router.currentRoute.value.path !== '/search') {
    router.push('/search')
  }
}

// 处理抽屉菜单项点击
function handleDrawerMenuClick() {
  closeDrawer()
}

onMounted(() => {
  userStore.fetchUser()
})
</script>

<template>
  <div class="min-h-screen bg-gray-900">
    <Header
      @open-drawer="handleOpenDrawer"
      @open-search="handleOpenSearch"
    />

    <main
      class="container mx-auto px-4 py-6 max-w-7xl main-content"
      :class="{ 'with-bottom-nav': isMobile }"
    >
      <RouterView />
    </main>

    <!-- 移动端底部导航 -->
    <BottomNavigation
      v-if="isMobile"
      :items="bottomNavItems"
    />

    <!-- 移动端抽屉菜单 -->
    <MobileDrawer
      v-model="drawerOpen"
      title="菜单"
      size="80vw"
    >
      <!-- 菜单内容 -->
      <nav class="drawer-menu">
        <div
          v-for="group in drawerMenuItems"
          :key="group.section"
          class="menu-group"
        >
          <div class="menu-section-title">
            {{ group.section }}
          </div>
          <RouterLink
            v-for="item in group.items"
            :key="item.path"
            :to="item.path"
            class="menu-item"
            @click="handleDrawerMenuClick"
          >
            <span class="menu-icon">{{ item.icon }}</span>
            <span class="menu-label">{{ item.label }}</span>
          </RouterLink>
        </div>
      </nav>

      <!-- 底部插槽 -->
      <template #footer>
        <DrawerFooter />
      </template>
    </MobileDrawer>

    <!-- 全局 Toast -->
    <Teleport to="body">
      <Transition name="toast">
        <div
          v-if="toast.show"
          class="fixed top-6 left-1/2 -translate-x-1/2 z-[9999] px-5 py-3 rounded-xl shadow-2xl text-sm font-medium backdrop-blur-sm"
          :class="{
            'bg-green-600/90 text-white': toast.type === 'success',
            'bg-red-600/90 text-white': toast.type === 'error',
            'bg-blue-600/90 text-white': toast.type === 'info',
          }"
        >
          {{ toast.message }}
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
/* 主内容区适配 */
.main-content.with-bottom-nav {
  padding-bottom: calc(64px + env(safe-area-inset-bottom, 0) + 1.5rem);
}

/* 抽屉菜单样式 */
.drawer-menu {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.menu-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.menu-section-title {
  font-size: 12px;
  font-weight: 600;
  color: rgb(156, 163, 175);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 8px 12px 4px;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 8px;
  color: rgb(229, 231, 235);
  text-decoration: none;
  transition: all 0.2s;
  font-size: 15px;
}

.menu-item:hover {
  background: rgb(55, 65, 81);
  color: white;
}

.menu-item:active {
  transform: scale(0.98);
}

.menu-icon {
  font-size: 20px;
  flex-shrink: 0;
  line-height: 1;
}

.menu-label {
  flex: 1;
  font-weight: 500;
}

/* 路由激活状态 */
.menu-item.router-link-active {
  background: rgba(59, 130, 246, 0.1);
  color: rgb(96, 165, 250);
}
</style>

<style>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translate(-50%, -20px);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
