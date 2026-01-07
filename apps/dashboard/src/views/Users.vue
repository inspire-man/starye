<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { api } from '@/lib/api'

// Define local user type or import from shared
interface User {
  id: string
  name: string
  email: string
  role: string
  createdAt: string
  image?: string
}

const users = ref<User[]>([])
const loading = ref(true)
const error = ref('')

const loadUsers = async () => {
  loading.value = true
  try {
    // We need to add getUsers to api client first, but for now let's use fetchApi directly or assume it exists
    // Let's update api.ts next. For now, use generic fetch.
    users.value = await api.admin.getUsers()
  } catch (e: any) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

onMounted(loadUsers)
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-xl font-bold">User Management</h2>
      <button @click="loadUsers" class="p-2 hover:bg-muted rounded-lg">
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"></path><path d="M21 3v5h-5"></path></svg>
      </button>
    </div>

    <div v-if="loading" class="space-y-2">
       <div v-for="i in 5" :key="i" class="h-12 bg-muted rounded-lg animate-pulse"></div>
    </div>

    <div v-else-if="error" class="p-4 bg-red-50 text-red-600 rounded-lg">
      {{ error }}
    </div>

    <div v-else class="bg-card border rounded-xl overflow-hidden shadow-sm">
      <table class="w-full text-sm text-left">
        <thead class="bg-muted/30 border-b">
          <tr>
            <th class="px-6 py-3 font-medium text-muted-foreground">User</th>
            <th class="px-6 py-3 font-medium text-muted-foreground">Role</th>
            <th class="px-6 py-3 font-medium text-muted-foreground">Joined</th>
            <th class="px-6 py-3 font-medium text-muted-foreground text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="user in users" :key="user.id" class="border-b last:border-0 hover:bg-muted/5">
            <td class="px-6 py-4">
              <div class="flex items-center gap-3">
                <img :src="user.image || `https://ui-avatars.com/api/?name=${user.name}`" class="w-8 h-8 rounded-full" />
                <div>
                  <div class="font-medium">{{ user.name }}</div>
                  <div class="text-xs text-muted-foreground">{{ user.email }}</div>
                </div>
              </div>
            </td>
            <td class="px-6 py-4">
              <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border" 
                :class="user.role === 'admin' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-neutral-50 text-neutral-600 border-neutral-200'">
                {{ user.role }}
              </span>
            </td>
            <td class="px-6 py-4 text-muted-foreground font-mono text-xs">
              {{ new Date(user.createdAt).toLocaleDateString() }}
            </td>
            <td class="px-6 py-4 text-right">
              <button class="text-xs font-medium hover:text-primary transition-colors">Edit</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
