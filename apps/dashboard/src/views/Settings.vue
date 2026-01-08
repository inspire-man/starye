<script setup lang="ts">
import { ref } from 'vue'
import { getAdminToken, setAdminToken } from '@/lib/api'

const token = ref(getAdminToken())
const saved = ref(false)

function save() {
  setAdminToken(token.value)
  saved.value = true
  setTimeout(() => (saved.value = false), 2000)
}
</script>

<template>
  <div class="space-y-6">
    <h1 class="text-2xl font-bold">
      系统设置
    </h1>

    <div class="max-w-md space-y-4 p-6 border rounded-xl bg-card">
      <h2 class="text-lg font-semibold">
        管理员访问权限
      </h2>
      <p class="text-sm text-muted-foreground">
        请输入 Service Token (CRAWLER_SECRET) 以启用完整管理功能。
      </p>

      <div class="space-y-2">
        <label class="text-sm font-medium">Service Token</label>
        <input
          v-model="token"
          type="password"
          class="w-full px-3 py-2 border rounded-md bg-background focus:ring-2 focus:ring-primary focus:outline-none"
          placeholder="crawler_sk_..."
        >
      </div>

      <button
        class="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
        @click="save"
      >
        {{ saved ? '已保存' : '保存配置' }}
      </button>
    </div>
  </div>
</template>
