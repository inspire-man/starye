<script setup lang="ts">
import { useSession, signOut } from '~/lib/auth-client'

const session = useSession()
const router = useRouter()

const handleLogout = async () => {
  await signOut()
  router.push('/login')
}

const userRole = computed(() => session.value.data?.user?.role)
</script>

<template>
  <div class="min-h-screen bg-background text-foreground antialiased flex flex-col">
    <header class="sticky top-0 z-50 bg-background/80 backdrop-blur border-b">
      <div class="container mx-auto px-4 h-16 flex items-center justify-between">
        <NuxtLink to="/" class="font-bold text-xl tracking-tight">STARYE</NuxtLink>

        <nav class="flex items-center gap-4">
          <template v-if="session.data">
            <NuxtLink
              v-if="userRole === 'admin'"
              to="/dashboard"
              class="text-sm font-medium text-primary hover:underline"
              target="_blank"
            >
              Admin
            </NuxtLink>

            <NuxtLink to="/profile" class="flex items-center gap-2 text-sm font-medium hover:bg-muted px-3 py-1.5 rounded-full transition-colors">
              <img
                :src="session.data.user.image || `https://ui-avatars.com/api/?name=${session.data.user.name}`"
                class="w-6 h-6 rounded-full"
              />
              <span>{{ session.data.user.name }}</span>
            </NuxtLink>
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
      &copy; 2026 Starye Project. All rights reserved.
    </footer>
  </div>
</template>
