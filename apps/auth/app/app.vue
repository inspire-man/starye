<script setup lang="ts">
import { ConfigProvider } from 'radix-vue'

const useIdFunction = () => useId()
</script>

<template>
  <NuxtLayout>
    <ConfigProvider :use-id="useIdFunction">
      <NuxtPage />
    </ConfigProvider>
  </NuxtLayout>
</template>
