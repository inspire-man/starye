<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { api } from '@/lib/api'

const stats = ref({ comics: 0, users: 0, tasks: 0 })

onMounted(async () => {
  try {
    const res = await api.admin.getStats()
    stats.value = res
  } catch (e) {
    console.error(e)
  }
})
</script>

<template>
  <div class="space-y-4">
    <h1 class="text-2xl font-bold tracking-tight">Overview</h1>
    <p class="text-muted-foreground">Welcome back. System is operational.</p>
    
    <div class="grid gap-4 md:grid-cols-3">
      <div class="p-6 border rounded-xl bg-card shadow-sm">
        <div class="text-sm font-medium text-muted-foreground">Total Comics</div>
        <div class="text-2xl font-bold mt-1">{{ stats.comics }}</div>
      </div>
      <div class="p-6 border rounded-xl bg-card shadow-sm">
        <div class="text-sm font-medium text-muted-foreground">Total Users</div>
        <div class="text-2xl font-bold mt-1">{{ stats.users }}</div>
      </div>
      <div class="p-6 border rounded-xl bg-card shadow-sm opacity-50">
        <div class="text-sm font-medium text-muted-foreground">Pending Tasks</div>
        <div class="text-2xl font-bold mt-1">{{ stats.tasks }}</div>
      </div>
    </div>
  </div>
</template>
