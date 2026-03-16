<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { useUserStore } from '../stores/user'

const userStore = useUserStore()
</script>

<template>
  <header class="sticky top-0 z-50 bg-white shadow-sm border-b border-gray-200">
    <div class="container mx-auto px-4 max-w-7xl">
      <div class="flex items-center justify-between h-16">
        <div class="flex items-center space-x-8">
          <RouterLink to="/" class="text-2xl font-bold text-primary-600 hover:text-primary-700 transition">
            漫画
          </RouterLink>

          <nav class="hidden md:flex space-x-4">
            <RouterLink to="/" class="text-gray-700 hover:text-primary-600 px-3 py-2 rounded-md text-sm font-medium transition">
              首页
            </RouterLink>
            <RouterLink to="/search" class="text-gray-700 hover:text-primary-600 px-3 py-2 rounded-md text-sm font-medium transition">
              搜索
            </RouterLink>
          </nav>
        </div>

        <div class="flex items-center space-x-4">
          <button
            v-if="!userStore.user"
            class="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-md text-sm font-medium transition"
            @click="userStore.signIn"
          >
            登录
          </button>

          <div v-else class="flex items-center space-x-3">
            <div class="hidden md:flex items-center gap-2 mr-2">
              <span v-if="!userStore.user.isR18Verified" class="text-xs px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full font-medium" title="部分 R18 内容已隐藏">
                🔒 SFW
              </span>
              <span v-else class="text-xs px-2 py-0.5 bg-red-50 text-red-700 border border-red-200 rounded-full font-medium" title="已验证 R18 访问权限">
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
              <span class="text-sm font-medium text-gray-700 hidden md:inline">{{ userStore.user.name }}</span>
            </RouterLink>

            <button
              class="text-gray-700 hover:text-red-600 px-3 py-2 rounded-md text-sm font-medium transition"
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
