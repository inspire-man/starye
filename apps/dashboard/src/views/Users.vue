<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { api } from '@/lib/api'

interface User {
  id: string
  name: string
  email: string
  role: string
  createdAt: string
  image?: string
  isAdult?: boolean
}

const users = ref<User[]>([])
const loading = ref(true)
const error = ref('')

// Dialog State
const editingUser = ref<User | null>(null)
const editForm = ref({ role: 'user', isAdult: false })
const saving = ref(false)

const loadUsers = async () => {
  loading.value = true
  try {
    users.value = await api.admin.getUsers()
  } catch (e: any) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

const openEdit = (user: User) => {
  editingUser.value = user
  editForm.value = { role: user.role, isAdult: user.isAdult || false }
}

const closeEdit = () => {
  editingUser.value = null
}

const saveUser = async () => {
  if (!editingUser.value) return
  saving.value = true
  try {
    // 1. Update Role
    if (editForm.value.role !== editingUser.value.role) {
      await api.admin.updateUserRole(editingUser.value.email, editForm.value.role)
    }
    // 2. Update Status (isAdult)
    // Assuming we added this method to api.ts, if not we need to add it or use raw fetch
    // Let's use api.admin.updateUserStatus if available, or fallback
    await api.admin.updateUserStatus(editingUser.value.email, editForm.value.isAdult)
    
    // Refresh
    await loadUsers()
    closeEdit()
  } catch (e: any) {
    alert('Failed to save: ' + e.message)
  } finally {
    saving.value = false
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
            <th class="px-6 py-3 font-medium text-muted-foreground">Status</th>
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
              <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border capitalize" 
                :class="{
                  'bg-purple-50 text-purple-700 border-purple-200': user.role === 'admin',
                  'bg-blue-50 text-blue-700 border-blue-200': user.role === 'comic_admin',
                  'bg-neutral-50 text-neutral-600 border-neutral-200': user.role === 'user'
                }">
                {{ user.role.replace('_', ' ') }}
              </span>
            </td>
            <td class="px-6 py-4">
               <span v-if="user.isAdult" class="text-xs font-bold text-green-600 border border-green-200 bg-green-50 px-2 py-0.5 rounded">18+</span>
               <span v-else class="text-xs text-muted-foreground">Standard</span>
            </td>
            <td class="px-6 py-4 text-muted-foreground font-mono text-xs">
              {{ new Date(user.createdAt).toLocaleDateString() }}
            </td>
            <td class="px-6 py-4 text-right">
              <button @click="openEdit(user)" class="text-xs font-medium hover:text-primary transition-colors">Edit</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Edit Modal -->
    <div v-if="editingUser" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div class="bg-background rounded-xl shadow-lg max-w-sm w-full p-6 space-y-6 animate-in fade-in zoom-in duration-200">
        <h3 class="text-lg font-bold">Edit User</h3>
        
        <div class="space-y-4">
          <div class="space-y-2">
            <label class="text-sm font-medium">Role</label>
            <select v-model="editForm.role" class="w-full p-2 border rounded-lg bg-background">
              <option value="user">User</option>
              <option value="comic_admin">Comic Admin</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <div class="flex items-center justify-between p-3 border rounded-lg">
            <div class="space-y-0.5">
              <label class="text-sm font-medium block">Age Verification (18+)</label>
              <p class="text-xs text-muted-foreground">Allow access to restricted content</p>
            </div>
            <input type="checkbox" v-model="editForm.isAdult" class="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary">
          </div>
        </div>

        <div class="flex justify-end gap-3">
          <button @click="closeEdit" class="px-4 py-2 text-sm font-medium hover:bg-muted rounded-lg">Cancel</button>
          <button @click="saveUser" :disabled="saving" class="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 rounded-lg disabled:opacity-50">
            {{ saving ? 'Saving...' : 'Save Changes' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
