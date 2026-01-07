<script setup lang="ts">
import { ref } from 'vue'

// Temporary placeholder data
const users = ref([
  { id: '1', name: 'Admin User', email: 'admin@example.com', role: 'admin', createdAt: '2023-01-01' },
  { id: '2', name: 'Test User', email: 'user@example.com', role: 'user', createdAt: '2023-01-02' },
])
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-xl font-bold">User Management</h2>
      <button class="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium">
        Invite User
      </button>
    </div>

    <div class="bg-card border rounded-xl overflow-hidden">
      <table class="w-full text-sm text-left">
        <thead class="bg-muted/50 border-b">
          <tr>
            <th class="px-6 py-3 font-medium">Name</th>
            <th class="px-6 py-3 font-medium">Email</th>
            <th class="px-6 py-3 font-medium">Role</th>
            <th class="px-6 py-3 font-medium">Joined</th>
            <th class="px-6 py-3 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="user in users" :key="user.id" class="border-b last:border-0 hover:bg-muted/5">
            <td class="px-6 py-4 font-medium">{{ user.name }}</td>
            <td class="px-6 py-4 text-muted-foreground">{{ user.email }}</td>
            <td class="px-6 py-4">
              <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium" 
                :class="user.role === 'admin' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'">
                {{ user.role }}
              </span>
            </td>
            <td class="px-6 py-4 text-muted-foreground">{{ user.createdAt }}</td>
            <td class="px-6 py-4">
              <button class="text-xs text-primary hover:underline">Edit</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
