<script setup lang="ts">
import type { NavItem } from './components/BottomNavigation.vue'
import { ToastContainer } from '@starye/ui'
import { computed, onMounted, ref } from 'vue'
import { RouterLink, RouterView, useRouter } from 'vue-router'
import BottomNavigation from './components/BottomNavigation.vue'
import DrawerFooter from './components/DrawerFooter.vue'
import Header from './components/Header.vue'
import MobileDrawer from './components/MobileDrawer.vue'
import { useDownloadList } from './composables/useDownloadList'
import { useDrawer } from './composables/useDrawer'
import { useMobileDetect } from './composables/useMobileDetect'
import { useUserStore } from './stores/user'

const userStore = useUserStore()
const router = useRouter()
const { isMobile } = useMobileDetect()
const { isOpen: drawerOpen, open: openDrawer, close: closeDrawer } = useDrawer()
const { stats: downloadStats } = useDownloadList()

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
  <div class="ui-app-shell min-h-screen bg-background text-foreground">
    <Header
      @open-drawer="handleOpenDrawer"
      @open-search="handleOpenSearch"
    />

    <main
      class="main-content mx-auto w-full max-w-[96rem] px-4 py-6 sm:px-6"
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

    <ToastContainer />
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
  gap: var(--ui-space-6);
}

.menu-group {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-1);
}

.menu-section-title {
  font-size: 12px;
  font-weight: 600;
  color: hsl(var(--muted-foreground));
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: var(--ui-space-2) var(--ui-space-3) var(--ui-space-1);
}

.menu-item {
  display: flex;
  align-items: center;
  gap: var(--ui-space-3);
  padding: var(--ui-space-3);
  border-radius: var(--ui-radius-md);
  color: hsl(var(--foreground));
  text-decoration: none;
  transition: background-color var(--ui-motion-fast) ease, color var(--ui-motion-fast) ease, transform var(--ui-motion-fast) ease;
  font-size: 15px;
}

.menu-item:hover {
  background: hsl(var(--accent));
  color: hsl(var(--accent-foreground));
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
  background: hsl(var(--primary) / 0.12);
  color: hsl(var(--primary));
}
</style>

<style>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
