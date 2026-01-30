<script setup lang="ts">
import { signOut, useSession } from '~/lib/auth-client'

const { locale, setLocale } = useI18n()
const session = useSession()
const router = useRouter()
const route = useRoute()

async function handleLogout() {
  await signOut()
  router.push('/login')
}

const userRole = computed(() => session.value.data?.user?.role)
const config = useRuntimeConfig()
const adminUrl = computed(() => config.public.adminUrl)

// Mobile menu state
const mobileMenuOpen = ref(false)

function closeMobileMenu() {
  mobileMenuOpen.value = false
}

// Navigation items
const navItems = [
  { name: '首页', path: '/', icon: '🏠' },
  { name: '影片库', path: '/movies', icon: '🎬' },
  { name: '女优', path: '/actors', icon: '⭐' },
  { name: '厂商', path: '/publishers', icon: '🏢' },
]

function isActive(path: string) {
  if (path === '/') {
    return route.path === '/'
  }
  return route.path.startsWith(path)
}
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 text-white antialiased flex flex-col">
    <!-- Header -->
    <header class="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-xl border-b border-white/10">
      <div class="container mx-auto px-4 h-16 flex items-center justify-between">
        <!-- Logo -->
        <NuxtLink to="/" class="font-black text-xl tracking-tight flex items-center gap-2 hover:text-purple-400 transition-colors">
          <span class="text-2xl">🎬</span>
          <span class="hidden sm:inline">STARYE MOVIE</span>
          <span class="sm:hidden">STARYE</span>
        </NuxtLink>

        <!-- Desktop Navigation -->
        <nav class="hidden md:flex items-center gap-1">
          <NuxtLink
            v-for="item in navItems"
            :key="item.path"
            :to="item.path"
            class="px-4 py-2 rounded-lg text-sm font-medium transition-all" :class="[
              isActive(item.path)
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                : 'text-slate-300 hover:bg-white/5 hover:text-white',
            ]"
          >
            <span class="mr-1.5">{{ item.icon }}</span>
            {{ item.name }}
          </NuxtLink>
        </nav>

        <!-- Right Actions -->
        <div class="flex items-center gap-3">
          <!-- Language Switcher -->
          <button
            class="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
            @click="setLocale(locale === 'zh' ? 'en' : 'zh')"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" /><path d="M2 12h20" /></svg>
            {{ locale === 'zh' ? 'EN' : '中文' }}
          </button>

          <!-- User Menu -->
          <template v-if="session.data">
            <a
              v-if="userRole === 'admin'"
              :href="adminUrl"
              class="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-300 hover:text-purple-200 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 rounded-lg transition-colors"
              target="_blank"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></svg>
              Admin
            </a>

            <NuxtLink to="/profile" class="hidden sm:flex items-center gap-2 px-3 py-1.5 text-sm font-medium hover:bg-white/10 rounded-lg transition-colors">
              <img
                :src="session.data.user.image || `https://ui-avatars.com/api/?name=${session.data.user.name}`"
                class="w-6 h-6 rounded-full border border-white/20"
                :alt="session.data.user.name"
              >
              <span class="text-slate-200">{{ session.data.user.name }}</span>
            </NuxtLink>

            <button
              class="hidden sm:flex items-center justify-center w-9 h-9 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
              title="退出登录"
              @click="handleLogout"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" x2="9" y1="12" y2="12" /></svg>
            </button>
          </template>

          <template v-else>
            <NuxtLink to="/login" class="px-4 py-2 text-sm font-medium bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors">
              登录
            </NuxtLink>
          </template>

          <!-- Mobile Menu Button -->
          <button
            class="md:hidden flex items-center justify-center w-10 h-10 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            @click="mobileMenuOpen = !mobileMenuOpen"
          >
            <svg v-if="!mobileMenuOpen" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" x2="20" y1="12" y2="12" /><line x1="4" x2="20" y1="6" y2="6" /><line x1="4" x2="20" y1="18" y2="18" /></svg>
            <svg v-else xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
          </button>
        </div>
      </div>

      <!-- Mobile Menu -->
      <div
        v-if="mobileMenuOpen"
        class="md:hidden border-t border-white/10 bg-slate-950/95 backdrop-blur-xl"
      >
        <nav class="container mx-auto px-4 py-4 space-y-1">
          <NuxtLink
            v-for="item in navItems"
            :key="item.path"
            :to="item.path"
            class="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all" :class="[
              isActive(item.path)
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                : 'text-slate-300 hover:bg-white/5 hover:text-white',
            ]"
            @click="closeMobileMenu"
          >
            <span class="text-xl">{{ item.icon }}</span>
            {{ item.name }}
          </NuxtLink>

          <div class="pt-4 mt-4 border-t border-white/10 space-y-2">
            <button
              class="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-slate-300 hover:bg-white/5 hover:text-white rounded-lg transition-colors"
              @click="setLocale(locale === 'zh' ? 'en' : 'zh')"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" /><path d="M2 12h20" /></svg>
              {{ locale === 'zh' ? 'English' : '中文' }}
            </button>

            <template v-if="session.data">
              <a
                v-if="userRole === 'admin'"
                :href="adminUrl"
                target="_blank"
                class="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-purple-300 bg-purple-500/20 border border-purple-500/30 rounded-lg"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></svg>
                管理后台
              </a>

              <button
                class="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                @click="handleLogout"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" x2="9" y1="12" y2="12" /></svg>
                退出登录
              </button>
            </template>
          </div>
        </nav>
      </div>
    </header>

    <!-- Main Content -->
    <main class="flex-1">
      <slot />
    </main>

    <!-- Footer -->
    <footer class="border-t border-white/10 py-8 bg-slate-950/50">
      <div class="container mx-auto px-4 text-center text-sm text-slate-400">
        <p>&copy; 2026 Starye Movie. All rights reserved.</p>
      </div>
    </footer>
  </div>
</template>
