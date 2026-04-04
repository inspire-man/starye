<script setup lang="ts">
import { signOut, useSession } from '~/lib/auth-client'

const session = useSession()
const { t } = useI18n()
const route = useRoute()
const user = computed(() => session.value.data?.user)

async function handleLogout() {
  try {
    await signOut()
    // 登出成功后刷新页面或重定向
    window.location.href = '/blog/'
  }
  catch (error) {
    console.error('登出失败:', error)
  }
}

function getLoginUrl() {
  const currentPath = route.fullPath
  return `/auth/login?redirect=${encodeURIComponent(`/blog${currentPath}`)}`
}
</script>

<template>
  <div class="min-h-screen bg-background font-sans text-foreground antialiased">
    <header class="border-b p-4">
      <nav class="container mx-auto flex items-center justify-between">
        <h1 class="text-xl font-bold">
          <NuxtLink to="/">
            Starye Blog
          </NuxtLink>
        </h1>
        <div class="flex gap-4 items-center">
          <NuxtLink to="/" class="hover:text-primary transition-colors text-sm">
            首页
          </NuxtLink>
          <NuxtLink to="/archive" class="hover:text-primary transition-colors text-sm">
            归档
          </NuxtLink>
          <NuxtLink to="/search" class="hover:text-primary transition-colors text-sm flex items-center gap-1">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-4.35-4.35m0 0A7 7 0 1 0 4.65 4.65a7 7 0 0 0 12 12Z" />
            </svg>
            搜索
          </NuxtLink>
          <NuxtLink to="/series/ts-fullstack-ai-chronicle" class="hover:text-primary transition-colors text-sm">
            TypeScript 全栈 AI 实录
          </NuxtLink>

          <div v-if="user" class="flex items-center gap-2">
            <img v-if="user.image" :src="user.image" alt="User Avatar" class="w-8 h-8 rounded-full border">
            <span class="text-sm font-medium">{{ user.name }}</span>
            <button
              class="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
              @click="handleLogout"
            >
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              {{ t('dashboard.sign_out') }}
            </button>
          </div>
          <div v-else>
            <a
              :href="getLoginUrl()"
              class="text-sm font-bold px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90"
            >
              Login
            </a>
          </div>
        </div>
      </nav>
    </header>
    <main class="container mx-auto p-4">
      <slot />
    </main>
  </div>
</template>
