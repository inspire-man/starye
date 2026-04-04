<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterView } from 'vue-router'
import { ToastContainer } from '@starye/ui'
import Header from './components/Header.vue'
import { useUserStore } from './stores/user'

const userStore = useUserStore()

onMounted(() => {
  userStore.fetchUser()
})
</script>

<template>
  <div class="min-h-screen bg-background">
    <Header />
    <main class="container mx-auto px-4 py-6 max-w-7xl">
      <RouterView />
    </main>
    <ToastContainer />
  </div>
</template>
