<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { getAdminToken, setAdminToken } from '@/lib/api'

const { t } = useI18n()
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
      {{ t('dashboard.system_settings') }}
    </h1>

    <div class="max-w-md space-y-4 p-6 border rounded-xl bg-card">
      <h2 class="text-lg font-semibold">
        {{ t('dashboard.admin_access_permissions') }}
      </h2>
      <p class="text-sm text-muted-foreground">
        {{ t('dashboard.enter_service_token') }}
      </p>

      <div class="space-y-2">
        <label class="text-sm font-medium">{{ t('dashboard.service_token') }}</label>
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
        {{ saved ? t('dashboard.saved') : t('dashboard.save_config') }}
      </button>
    </div>
  </div>
</template>
