<script setup lang="ts">
import { error, success } from '@starye/ui'
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { api } from '@/lib/api'

const { t } = useI18n()
const token = ref('')

function save() {
  success('配置已保存')
}

// TorrServer 系统默认地址配置
const torrServerUrl = ref('')
const torrServerSaving = ref(false)
const torrServerTesting = ref(false)
const torrServerStatus = ref<'idle' | 'connected' | 'failed'>('idle')
const torrServerVersion = ref('')

onMounted(async () => {
  try {
    const res = await api.admin.getSettings()
    const row = res.data?.find(s => s.key === 'torrserver.default_url')
    if (row)
      torrServerUrl.value = row.value
  }
  catch {
    // 读取失败不影响页面
  }
})

async function saveTorrServerUrl() {
  const url = torrServerUrl.value.trim()
  if (!url) {
    error('请输入 TorrServer 地址')
    return
  }
  try {
    // 仅用于验证 URL 格式，结果不需要使用
    const parsed = new URL(url)
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      error('URL 格式不正确，请以 http:// 或 https:// 开头')
      return
    }
  }
  catch {
    error('URL 格式不正确，请以 http:// 或 https:// 开头')
    return
  }

  torrServerSaving.value = true
  try {
    await api.admin.updateSettings([{ key: 'torrserver.default_url', value: url }])
    success('TorrServer 默认地址已保存')
  }
  catch (e: any) {
    error(`保存失败: ${e.message}`)
  }
  finally {
    torrServerSaving.value = false
  }
}

async function testTorrServerConnection() {
  const url = torrServerUrl.value.trim()
  if (!url) {
    error('请先输入 TorrServer 地址')
    return
  }

  torrServerTesting.value = true
  torrServerStatus.value = 'idle'
  torrServerVersion.value = ''

  try {
    const res = await fetch(`${url.replace(/\/+$/, '')}/echo`, {
      signal: AbortSignal.timeout(5000),
    })
    if (res.ok) {
      torrServerVersion.value = await res.text()
      torrServerStatus.value = 'connected'
      success(`已连接到 TorrServer ${torrServerVersion.value}`)
    }
    else {
      torrServerStatus.value = 'failed'
      error(`连接失败：HTTP ${res.status}`)
    }
  }
  catch (e: any) {
    torrServerStatus.value = 'failed'
    if (e.name === 'TimeoutError') {
      error('连接超时，请检查地址和网络')
    }
    else {
      error(`连接失败：${e.message}`)
    }
  }
  finally {
    torrServerTesting.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <h1 class="text-2xl font-bold">
      {{ t('dashboard.system_settings') }}
    </h1>

    <!-- 管理权限 Token -->
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
        {{ t('dashboard.save_config') }}
      </button>
    </div>

    <!-- TorrServer 系统默认地址 -->
    <div class="max-w-md space-y-4 p-6 border rounded-xl bg-card">
      <div>
        <h2 class="text-lg font-semibold">
          TorrServer 默认地址
        </h2>
        <p class="mt-1 text-sm text-muted-foreground">
          配置一个共享 TorrServer 实例，未自定义的用户将自动使用此地址进行磁力链接在线播放。
        </p>
      </div>

      <div class="space-y-2">
        <label class="text-sm font-medium">服务地址</label>
        <input
          v-model="torrServerUrl"
          type="url"
          class="w-full px-3 py-2 border rounded-md bg-background focus:ring-2 focus:ring-primary focus:outline-none"
          placeholder="http://localhost:8090"
        >
        <p class="text-xs text-muted-foreground">
          TorrServer HTTP 地址，默认端口 8090。启动时建议加 <code class="px-1 rounded bg-muted">--cors</code> 参数。
        </p>
      </div>

      <!-- 连接状态指示 -->
      <div v-if="torrServerStatus !== 'idle'" class="flex items-center gap-2 text-sm">
        <div
          class="w-2.5 h-2.5 rounded-full shrink-0"
          :class="{
            'bg-green-500': torrServerStatus === 'connected',
            'bg-red-500': torrServerStatus === 'failed',
          }"
        />
        <span v-if="torrServerStatus === 'connected'" class="text-green-600 dark:text-green-400">
          已连接 — {{ torrServerVersion }}
        </span>
        <span v-else class="text-red-600 dark:text-red-400">
          连接失败
        </span>
      </div>

      <!-- 操作按钮 -->
      <div class="flex gap-3">
        <button
          :disabled="torrServerTesting"
          class="flex-1 px-4 py-2 border rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted"
          @click="testTorrServerConnection"
        >
          <span v-if="torrServerTesting" class="inline-flex items-center gap-1.5">
            <span class="inline-block w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
            测试中...
          </span>
          <span v-else>测试连接</span>
        </button>

        <button
          :disabled="torrServerSaving"
          class="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          @click="saveTorrServerUrl"
        >
          {{ torrServerSaving ? '保存中...' : '保存' }}
        </button>
      </div>
    </div>
  </div>
</template>
