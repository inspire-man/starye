<script setup lang="ts">
import { useSession, signOut } from '~/lib/auth-client'

const session = useSession()
const router = useRouter()

const userRole = computed(() => session.value.data?.user?.role)
const isAdult = computed(() => session.value.data?.user?.isAdult)

// Redirect if not logged in
watchEffect(() => {
  if (session.value === null) { // Explicit null check (undefined means loading)
    router.push('/login')
  }
})

const handleLogout = async () => {
  await signOut({
    fetchOptions: {
      onSuccess: () => {
        router.push('/login')
      }
    }
  })
}
</script>

<template>
  <div v-if="session" class="container mx-auto py-10 px-4 max-w-2xl">
    <div class="flex items-center gap-6 mb-10">
      <img
        :src="session.data?.user.image || `https://ui-avatars.com/api/?name=${session.data?.user.name}`"
        class="w-24 h-24 rounded-full border-4 border-background shadow-lg"
      />
      <div>
        <h1 class="text-3xl font-bold">{{ session.data?.user.name }}</h1>
        <p class="text-muted-foreground">{{ session.data?.user.email }}</p>
        <div class="flex gap-2 mt-2">
          <span class="px-2 py-0.5 bg-secondary text-secondary-foreground text-xs rounded uppercase font-bold tracking-wider">
            {{ userRole }}
          </span>
          <span v-if="isAdult" class="px-2 py-0.5 bg-green-500/10 text-green-600 text-xs rounded font-bold border border-green-200">
            18+ Verified
          </span>
        </div>
      </div>
    </div>

    <!-- RBAC Menu -->
    <div class="grid gap-6">
      <section v-if="userRole === 'admin'" class="p-6 bg-card rounded-xl border shadow-sm">
        <h2 class="font-bold mb-4 flex items-center gap-2">
          <svg class="w-5 h-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
          Admin Console
        </h2>
        <div class="grid grid-cols-2 gap-4">
          <a href="/dashboard/" target="_blank" class="p-4 bg-muted/50 hover:bg-muted rounded-lg text-center transition-colors">
            <span class="block font-bold">Content Dashboard</span>
            <span class="text-xs text-muted-foreground">Manage comics & chapters</span>
          </a>
          <div class="p-4 bg-muted/50 rounded-lg text-center opacity-50 cursor-not-allowed">
            <span class="block font-bold">User Manager</span>
            <span class="text-xs text-muted-foreground">Coming Soon</span>
          </div>
        </div>
      </section>

      <!-- Age Verification Section -->
      <section class="p-6 bg-card rounded-xl border shadow-sm">
        <h2 class="font-bold mb-4">Content Settings</h2>

        <div v-if="!isAdult" class="flex items-start gap-4">
          <div class="p-3 bg-yellow-500/10 text-yellow-600 rounded-lg">
            <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
          </div>
          <div>
            <h3 class="font-medium">Age Verification Required</h3>
            <p class="text-sm text-muted-foreground mt-1 mb-4">
              To access restricted content (R18), your account needs to be verified by an administrator.
            </p>
            <div class="px-4 py-3 bg-muted text-muted-foreground rounded-lg text-sm">
              Status: <span class="font-bold">Unverified</span>. Please contact support or an admin.
            </div>
          </div>
        </div>

        <div v-else class="flex items-center gap-4 text-green-600">
           <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
           <span class="font-medium">Your age has been verified. Access to R18 content is enabled.</span>
        </div>
      </section>

      <button @click="handleLogout" class="w-full py-3 text-red-600 hover:bg-red-50 rounded-xl transition-colors font-medium">
        Sign Out
      </button>
    </div>
  </div>
</template>
