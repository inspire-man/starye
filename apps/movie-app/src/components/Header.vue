<script setup lang="ts">
import { RouterLink, useRouter } from 'vue-router'
import { useMobileDetect } from '../composables/useMobileDetect'
import { useUserStore } from '../stores/user'
import SearchBar from './SearchBar.vue'

// Emits 定义
const emit = defineEmits<{
  openDrawer: []
  openSearch: []
}>()

const router = useRouter()

const userStore = useUserStore()
const { isMobile } = useMobileDetect()

function handleMenuClick() {
  emit('openDrawer')
}

function handleSearchClick() {
  emit('openSearch')
  router.push('/search')
}
</script>

<template>
  <header class="sticky top-0 z-50 border-b border-border bg-background/92 shadow-sm backdrop-blur supports-backdrop-filter:bg-background/78">
    <div class="mx-auto w-full max-w-[96rem] px-4 sm:px-6">
      <div class="flex h-16 items-center justify-between gap-4">
        <!-- 左侧：汉堡菜单 + Logo + 桌面端导航 -->
        <div class="flex min-w-0 items-center gap-3 md:gap-7">
          <!-- 移动端汉堡菜单 -->
          <button
            v-if="isMobile"
            class="rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="打开菜单"
            @click="handleMenuClick"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <RouterLink to="/" class="shrink-0 text-xl font-bold tracking-tight text-primary transition hover:text-primary/80 sm:text-2xl">
            影库
          </RouterLink>

          <!-- 桌面端导航 -->
          <nav class="hidden items-center gap-1 md:flex">
            <RouterLink to="/" class="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" active-class="bg-muted text-foreground" exact>
              首页
            </RouterLink>
            <RouterLink to="/actors" class="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" active-class="bg-muted text-foreground">
              女优
            </RouterLink>
            <RouterLink to="/publishers" class="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" active-class="bg-muted text-foreground">
              厂商
            </RouterLink>
            <RouterLink to="/profile" class="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" active-class="bg-muted text-foreground">
              我的
            </RouterLink>
          </nav>
        </div>

        <!-- 右侧：搜索 + 用户信息 -->
        <div class="flex shrink-0 items-center gap-2 md:gap-4">
          <!-- 桌面端搜索框 -->
          <div class="hidden md:block w-64">
            <SearchBar />
          </div>

          <!-- 移动端搜索按钮 -->
          <button
            v-if="isMobile"
            class="rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="搜索"
            @click="handleSearchClick"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>

          <!-- 用户信息 -->
          <button
            v-if="!userStore.user"
            class="ui-public-button ui-public-button-primary"
            @click="userStore.signIn"
          >
            登录
          </button>

          <div v-else class="flex items-center space-x-3">
            <div class="hidden md:flex items-center gap-2 mr-2">
              <span v-if="!userStore.user.isR18Verified" class="text-xs px-2 py-0.5 bg-amber-900/30 text-amber-300 border border-amber-700 rounded-full font-medium" title="部分 R18 内容已隐藏">
                🔒 SFW
              </span>
              <span v-else class="text-xs px-2 py-0.5 bg-red-900/30 text-red-300 border border-red-700 rounded-full font-medium" title="已验证 R18 访问权限">
                🔞 R18
              </span>
            </div>
            <RouterLink to="/profile" class="flex items-center space-x-2 hover:opacity-80 transition">
              <img
                v-if="userStore.user.image"
                :src="userStore.user.image"
                :alt="userStore.user.name"
                class="w-8 h-8 rounded-full"
              >
              <div v-else class="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">
                {{ userStore.user.name[0].toUpperCase() }}
              </div>
              <span class="hidden text-sm font-medium text-muted-foreground md:inline">{{ userStore.user.name }}</span>
            </RouterLink>

            <button
              class="hidden rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive md:inline-flex"
              @click="userStore.signOut"
            >
              退出
            </button>
          </div>
        </div>
      </div>
    </div>
  </header>
</template>
