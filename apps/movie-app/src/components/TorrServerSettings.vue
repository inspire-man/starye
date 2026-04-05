<script setup lang="ts">
import type { TorrServerConfig } from '../composables/useTorrServer'
import { computed, onMounted, ref } from 'vue'
import { useTorrServer } from '../composables/useTorrServer'

const {
  config,
  isConnected,
  serverVersion,
  isLoading,
  loadConfig,
  saveConfig,
  testConnection,
} = useTorrServer()

const formData = ref<TorrServerConfig>({
  serverUrl: 'http://localhost:8090',
})

const isTestingConnection = ref(false)
const urlError = ref('')

const statusClass = computed(() => {
  if (isConnected.value)
    return 'connected'
  if (isTestingConnection.value)
    return 'connecting'
  return 'disconnected'
})

const statusText = computed(() => {
  if (isConnected.value)
    return '已连接'
  if (isTestingConnection.value)
    return '连接中...'
  return '未连接'
})

const canTest = computed(() => formData.value.serverUrl.trim() !== '')

function validateUrl(): boolean {
  urlError.value = ''
  const url = formData.value.serverUrl.trim()
  if (!url) {
    urlError.value = '请输入 TorrServer 地址'
    return false
  }
  try {
    const parsed = new URL(url)
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      urlError.value = 'URL 必须以 http:// 或 https:// 开头'
      return false
    }
  }
  catch {
    urlError.value = 'URL 格式不正确'
    return false
  }
  return true
}

async function handleTestConnection() {
  if (!validateUrl())
    return

  isTestingConnection.value = true
  saveConfig(formData.value)
  await testConnection()
  isTestingConnection.value = false
}

async function handleSave() {
  if (!validateUrl())
    return
  saveConfig(formData.value)
}

onMounted(() => {
  loadConfig()
  if (config.value) {
    formData.value = { serverUrl: config.value.serverUrl }
  }
})
</script>

<template>
  <div class="space-y-6">
    <h3 class="text-lg font-bold text-white">
      TorrServer 连接设置
    </h3>

    <!-- 说明 -->
    <div class="bg-teal-900/30 border border-teal-700/50 rounded-lg p-4">
      <p class="text-teal-300 text-sm font-medium mb-1">
        💡 关于 TorrServer
      </p>
      <p class="text-gray-400 text-sm leading-relaxed">
        TorrServer 可将磁力链接实时转为 HTTP 视频流，在浏览器中直接播放。
        需要先在本地或服务器上部署
        <a
          href="https://github.com/YouROK/TorrServer"
          target="_blank"
          rel="noopener noreferrer"
          class="text-teal-400 hover:underline"
        >TorrServer</a>，
        默认端口为 8090。
      </p>
    </div>

    <!-- 配置表单 -->
    <div class="space-y-4">
      <div>
        <label for="torrserver-url" class="block text-sm font-medium text-gray-300 mb-2">
          服务地址
        </label>
        <input
          id="torrserver-url"
          v-model="formData.serverUrl"
          type="url"
          class="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:border-teal-500 focus:outline-none transition-colors"
          placeholder="http://localhost:8090"
          :disabled="isTestingConnection"
        >
        <p v-if="urlError" class="mt-1.5 text-xs text-red-400">
          {{ urlError }}
        </p>
        <p class="mt-1.5 text-xs text-gray-500">
          TorrServer HTTP 地址（默认端口 8090）。如遇 CORS 问题，请使用 <code class="px-1 py-0.5 bg-gray-800 rounded text-gray-400">--cors</code> 参数启动 TorrServer
        </p>
      </div>

      <!-- 操作按钮 -->
      <div class="flex gap-3">
        <button
          :disabled="!canTest || isTestingConnection"
          class="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border border-teal-600 text-teal-400 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:bg-teal-600/10"
          @click="handleTestConnection"
        >
          <span v-if="isTestingConnection" class="inline-block w-4 h-4 border-2 border-teal-400 border-t-transparent rounded-full animate-spin" />
          {{ isTestingConnection ? '测试中...' : '测试连接' }}
        </button>

        <button
          :disabled="!canTest || isLoading"
          class="flex-1 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
          @click="handleSave"
        >
          保存配置
        </button>
      </div>
    </div>

    <!-- 连接状态 -->
    <div class="pt-4 border-t border-gray-700">
      <div class="flex items-center gap-2 mb-2">
        <div
          class="w-2.5 h-2.5 rounded-full transition-colors"
          :class="{
            'bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]': statusClass === 'connected',
            'bg-yellow-500 animate-pulse': statusClass === 'connecting',
            'bg-gray-500': statusClass === 'disconnected',
          }"
        />
        <span class="text-sm font-medium text-gray-300">
          {{ statusText }}
        </span>
      </div>
      <p v-if="serverVersion" class="text-xs text-gray-500">
        TorrServer 版本: {{ serverVersion }}
      </p>
    </div>
  </div>
</template>
