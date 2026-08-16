<script setup lang="ts">
import { ToastContainer } from '@starye/ui'
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
  <div class="ui-app-shell min-h-screen bg-background text-foreground">
    <Header />
    <main class="mx-auto w-full max-w-[96rem]">
      <RouterView />
    </main>
    <ToastContainer />
  </div>
</template>
