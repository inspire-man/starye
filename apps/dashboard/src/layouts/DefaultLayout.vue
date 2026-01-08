<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { signOut, useSession } from '@/lib/auth-client'

const router = useRouter()
const { t, locale } = useI18n()
const session = useSession() // Don't destructure data immediately if types are ambiguous

function toggleLocale() {
  const newLocale = locale.value === 'zh' ? 'en' : 'zh'
  locale.value = newLocale
  localStorage.setItem('starye_i18n', newLocale)
}

async function handleLogout() {
  await signOut({
    fetchOptions: {
      onSuccess: () => {
        router.push('/login')
      },
    },
  })
}
</script>

<template>
  <div class="flex min-h-screen bg-muted/40">
    <!-- Sidebar -->
    <aside class="w-64 bg-background border-r flex flex-col fixed inset-y-0 z-10">
      <div class="h-14 flex items-center px-6 border-b font-bold tracking-tight text-lg">
        {{ t('dashboard.admin_console') }}
      </div>

      <nav class="flex-1 p-4 space-y-1">
        <RouterLink to="/" class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-muted" active-class="" exact-active-class="bg-muted text-primary">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
          {{ t('dashboard.overview') }}
        </RouterLink>
        <RouterLink to="/comics" class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-muted" active-class="bg-muted text-primary">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>
          {{ t('dashboard.comics') }}
        </RouterLink>
        <RouterLink to="/users" class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-muted" active-class="bg-muted text-primary">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
          {{ t('dashboard.users') }}
        </RouterLink>
        <RouterLink to="/settings" class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-muted" active-class="bg-muted text-primary">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
          {{ t('dashboard.settings') }}
        </RouterLink>
      </nav>

      <div class="p-4 space-y-2 border-t">
        <button class="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-sm font-medium hover:bg-muted transition-colors" @click="toggleLocale">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>
          {{ locale === 'zh' ? 'English' : '简体中文' }}
        </button>
        <button class="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors" @click="handleLogout">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
          {{ t('dashboard.sign_out') }}
        </button>
      </div>
    </aside>

    <!-- Content -->
    <main class="flex-1 ml-64 p-8">
      <div class="mb-8 flex items-center justify-between">
        <h1 class="text-2xl font-bold tracking-tight">
          {{ t('dashboard.dashboard') }}
        </h1>
        <div v-if="session.data" class="flex items-center gap-2">
          <span class="text-sm text-muted-foreground">{{ t('dashboard.welcome') }}, {{ session.data.user.name }}</span>
          <img :src="session.data.user.image || `https://ui-avatars.com/api/?name=${session.data.user.name}`" class="w-8 h-8 rounded-full border bg-background">
        </div>
      </div>

      <RouterView />
    </main>
  </div>
</template>
