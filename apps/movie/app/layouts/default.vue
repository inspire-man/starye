<script setup lang="ts">
import { signOut, useSession } from '~/lib/auth-client'

const { locale, setLocale } = useI18n()
const session = useSession()
const router = useRouter()

async function handleLogout() {
  await signOut()
  router.push('/login')
}

const userRole = computed(() => session.value.data?.user?.role)
const config = useRuntimeConfig()
const adminUrl = computed(() => config.public.adminUrl)
</script>

<template>
  <div class="min-h-screen bg-background text-foreground antialiased flex flex-col">
    <header class="sticky top-0 z-50 bg-background/80 backdrop-blur border-b">
      <div class="container mx-auto px-4 h-16 flex items-center justify-between">
        <NuxtLink to="/" class="font-bold text-xl tracking-tight">
          STARYE MOVIE
        </NuxtLink>

        <nav class="flex items-center gap-4">
          <a href="/" class="text-sm font-bold text-muted-foreground hover:text-primary transition-colors">
            Comic
          </a>

          <button
            class="text-sm font-medium hover:text-primary transition-colors"
            @click="setLocale(locale === 'zh' ? 'en' : 'zh')"
          >
            {{ locale === 'zh' ? 'EN' : '中文' }}
          </button>

          <template v-if="session.data">
            <a
              v-if="userRole === 'admin'"
              :href="adminUrl"
              class="text-sm font-medium text-primary hover:underline"
              target="_blank"
            >
              Admin
            </a>

            <NuxtLink to="/profile" class="flex items-center gap-2 text-sm font-medium hover:bg-muted px-3 py-1.5 rounded-full transition-colors">
              <img
                :src="session.data.user.image || `https://ui-avatars.com/api/?name=${session.data.user.name}`"
                class="w-6 h-6 rounded-full"
              >
              <span>{{ session.data.user.name }}</span>
            </NuxtLink>

            <button
              class="text-xs text-muted-foreground hover:text-destructive transition-colors ml-2"
              @click="handleLogout"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" x2="9" y1="12" y2="12" /></svg>
            </button>
          </template>

          <template v-else>
            <NuxtLink to="/login" class="text-sm font-medium hover:text-primary transition-colors">
              Login
            </NuxtLink>
          </template>
        </nav>
      </div>
    </header>
    <main class="flex-1">
      <slot />
    </main>

    <footer class="border-t py-8 text-center text-xs text-muted-foreground">
      &copy; 2026 Starye Movie. All rights reserved.
    </footer>
  </div>
</template>
