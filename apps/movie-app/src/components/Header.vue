<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { useMobileDetect } from '../composables/useMobileDetect'
import { useUserStore } from '../stores/user'

// Emits 定义
const emit = defineEmits<{
  openDrawer: []
  openSearch: []
}>()
const userStore = useUserStore()
const { isMobile } = useMobileDetect()

function handleMenuClick() {
  emit('openDrawer')
}

function handleSearchClick() {
  emit('openSearch')
}
</script>

<template>
  <header class="sticky top-0 z-50 bg-gray-800 shadow-lg border-b border-gray-700">
    <div class="container mx-auto px-4 max-w-7xl">
      <div class="flex items-center justify-between h-16">
        <!-- 左侧：汉堡菜单 + Logo + 桌面端导航 -->
        <div class="flex items-center space-x-4 md:space-x-8">
          <!-- 移动端汉堡菜单 -->
          <button
            v-if="isMobile"
            class="text-gray-300 hover:text-white p-2 rounded-md transition-colors"
            aria-label="打开菜单"
            @click="handleMenuClick"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <RouterLink to="/" class="text-2xl font-bold text-primary-400 hover:text-primary-300 transition">
            影库
          </RouterLink>

          <!-- 桌面端导航 -->
          <nav class="hidden md:flex space-x-2">
            <RouterLink to="/" class="text-gray-300 hover:text-white hover:bg-gray-700 px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200">
              首页
            </RouterLink>
            <RouterLink to="/actors" class="text-gray-300 hover:text-white hover:bg-gray-700 px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200">
              女优
            </RouterLink>
            <RouterLink to="/publishers" class="text-gray-300 hover:text-white hover:bg-gray-700 px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200">
              厂商
            </RouterLink>
            <RouterLink to="/search" class="text-gray-300 hover:text-white hover:bg-gray-700 px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200">
              搜索
            </RouterLink>
          </nav>
        </div>

        <!-- 右侧：搜索 + 用户信息 -->
        <div class="flex items-center space-x-2 md:space-x-4">
          <!-- 移动端搜索按钮 -->
          <button
            v-if="isMobile"
            class="text-gray-300 hover:text-white p-2 rounded-md transition-colors"
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
            class="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-md text-sm font-medium transition"
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
              <div v-else class="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center text-white text-sm font-medium">
                {{ userStore.user.name[0].toUpperCase() }}
              </div>
              <span class="text-sm font-medium text-gray-300 hidden md:inline">{{ userStore.user.name }}</span>
            </RouterLink>

            <button
              class="hidden md:inline-flex text-gray-300 hover:text-red-400 px-3 py-2 rounded-md text-sm font-medium transition"
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
