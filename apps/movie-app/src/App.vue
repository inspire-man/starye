<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterView } from 'vue-router'
import Header from './components/Header.vue'
import { useUserStore } from './stores/user'

const userStore = useUserStore()

onMounted(() => {
  userStore.fetchUser()
})
</script>

<template>
  <div class="min-h-screen bg-gray-900">
    <Header />
    <main class="container mx-auto px-4 py-6 max-w-7xl">
      <RouterView />
    </main>
  </div>
</template>
