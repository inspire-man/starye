<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useUserStore } from '../stores/user'

const userStore = useUserStore()
const mobileMenuOpen = ref(false)
</script>

<template>
  <header class="sticky top-0 z-50 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60 border-b border-border shadow-sm">
    <div class="container mx-auto px-4 max-w-7xl">
      <div class="flex items-center justify-between h-14 sm:h-16">
        <!-- Logo + 桌面导航 -->
        <div class="flex items-center gap-6">
          <RouterLink to="/" class="text-xl font-bold text-primary hover:text-primary/80 transition">
            漫画
          </RouterLink>

          <nav class="hidden md:flex items-center gap-1">
            <RouterLink
              to="/"
              class="px-3 py-1.5 rounded-md text-sm font-medium text-foreground/70 hover:text-foreground hover:bg-muted transition-colors"
              active-class="text-foreground bg-muted"
              exact
            >
              首页
            </RouterLink>
            <RouterLink
              to="/search"
              class="px-3 py-1.5 rounded-md text-sm font-medium text-foreground/70 hover:text-foreground hover:bg-muted transition-colors"
              active-class="text-foreground bg-muted"
            >
              搜索
            </RouterLink>
            <RouterLink
              v-if="userStore.user"
              to="/favorites"
              class="px-3 py-1.5 rounded-md text-sm font-medium text-foreground/70 hover:text-foreground hover:bg-muted transition-colors"
              active-class="text-foreground bg-muted"
            >
              收藏
            </RouterLink>
          </nav>
        </div>

        <!-- 右侧操作区 -->
        <div class="flex items-center gap-2 sm:gap-3">
          <!-- 移动端搜索图标 -->
          <RouterLink to="/search" class="md:hidden p-2 rounded-md text-foreground/70 hover:text-foreground hover:bg-muted transition-colors">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-4.35-4.35m0 0A7 7 0 1 0 4.65 4.65a7 7 0 0 0 12 12Z" />
            </svg>
          </RouterLink>

          <!-- 未登录 -->
          <button
            v-if="!userStore.user && !userStore.loading"
            class="bg-primary hover:bg-primary/90 text-primary-foreground px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-sm font-medium transition-colors"
            @click="userStore.signIn"
          >
            登录
          </button>

          <!-- 已登录 -->
          <div v-else-if="userStore.user" class="flex items-center gap-2">
            <!-- R18 状态标签（仅桌面） -->
            <span
              v-if="!userStore.user.isR18Verified"
              class="hidden sm:inline text-xs px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full font-medium"
              title="部分 R18 内容已隐藏"
            >
              🔒 SFW
            </span>
            <span
              v-else
              class="hidden sm:inline text-xs px-2 py-0.5 bg-red-50 text-red-700 border border-red-200 rounded-full font-medium"
              title="已验证 R18 访问权限"
            >
              🔞 R18
            </span>

            <RouterLink to="/profile" class="flex items-center gap-2 hover:opacity-80 transition">
              <img
                v-if="userStore.user.image"
                :src="userStore.user.image"
                :alt="userStore.user.name"
                class="w-8 h-8 rounded-full ring-2 ring-border"
              >
              <div v-else class="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-semibold">
                {{ userStore.user.name[0].toUpperCase() }}
              </div>
              <span class="hidden md:inline text-sm font-medium">{{ userStore.user.name }}</span>
            </RouterLink>

            <button
              class="hidden sm:flex text-muted-foreground hover:text-destructive px-2 py-1.5 rounded-md text-sm transition-colors"
              @click="userStore.signOut"
            >
              退出
            </button>
          </div>

          <!-- 移动端汉堡菜单 -->
          <button
            class="md:hidden p-2 rounded-md text-foreground/70 hover:text-foreground hover:bg-muted transition-colors"
            @click="mobileMenuOpen = !mobileMenuOpen"
          >
            <svg v-if="!mobileMenuOpen" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
            <svg v-else class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <!-- 移动端下拉菜单 -->
      <div v-if="mobileMenuOpen" class="md:hidden border-t border-border py-3 space-y-1" @click="mobileMenuOpen = false">
        <RouterLink to="/" class="block px-3 py-2 rounded-md text-sm font-medium hover:bg-muted transition-colors" exact active-class="bg-muted text-foreground">
          首页
        </RouterLink>
        <RouterLink to="/search" class="block px-3 py-2 rounded-md text-sm font-medium hover:bg-muted transition-colors" active-class="bg-muted text-foreground">
          搜索
        </RouterLink>
        <RouterLink v-if="userStore.user" to="/favorites" class="block px-3 py-2 rounded-md text-sm font-medium hover:bg-muted transition-colors" active-class="bg-muted text-foreground">
          我的收藏
        </RouterLink>
        <RouterLink v-if="userStore.user" to="/profile" class="block px-3 py-2 rounded-md text-sm font-medium hover:bg-muted transition-colors" active-class="bg-muted text-foreground">
          个人中心
        </RouterLink>
        <button
          v-if="userStore.user"
          class="w-full text-left px-3 py-2 rounded-md text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
          @click="userStore.signOut"
        >
          退出登录
        </button>
      </div>
    </div>
  </header>
</template>
