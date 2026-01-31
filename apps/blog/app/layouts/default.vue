<script setup lang="ts">
import { useSession } from '~/lib/auth-client'

const session = useSession()
const { t } = useI18n()
const user = computed(() => session.value.data?.user)

function handleLogout() {
  // Redirect to login after logout or just refresh
  window.location.href = '/api/auth/sign-out'
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
          <NuxtLink to="/" class="hover:underline">
            Home
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
            <NuxtLink
              to="/login"
              class="text-sm font-bold px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90"
            >
              Login
            </NuxtLink>
          </div>
        </div>
      </nav>
    </header>
    <main class="container mx-auto p-4">
      <slot />
    </main>
  </div>
</template>
