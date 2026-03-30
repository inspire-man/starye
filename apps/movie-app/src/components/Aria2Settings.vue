<template>
  <div class="aria2-settings">
    <h3 class="settings-title">Aria2 连接设置</h3>

    <!-- 配置向导提示（首次使用） -->
    <div v-if="showWizard" class="wizard-banner">
      <div class="wizard-icon">💡</div>
      <div class="wizard-content">
        <p class="wizard-title">首次使用指南</p>
        <p class="wizard-text">
          请先配置 Aria2 RPC 连接信息。如果 Aria2 在本机运行，通常使用
          <code>http://localhost:6800/jsonrpc</code>
        </p>
        <button class="wizard-close" @click="showWizard = false">
          知道了
        </button>
      </div>
    </div>

    <!-- 配置表单 -->
    <div class="settings-form">
      <!-- RPC URL -->
      <div class="form-group">
        <label for="rpc-url" class="form-label">RPC URL</label>
        <input
          id="rpc-url"
          v-model="formData.rpcUrl"
          type="url"
          class="form-input"
          placeholder="http://localhost:6800/jsonrpc"
          :disabled="isTestingConnection"
        >
        <p v-if="urlError" class="form-error">{{ urlError }}</p>
        <p class="form-hint">
          Aria2 JSON-RPC 地址（默认端口 6800）
        </p>
      </div>

      <!-- 密钥（可选） -->
      <div class="form-group">
        <label for="rpc-secret" class="form-label">密钥（可选）</label>
        <input
          id="rpc-secret"
          v-model="formData.secret"
          type="password"
          class="form-input"
          placeholder="留空表示无密钥"
          :disabled="isTestingConnection"
        >
        <p class="form-hint">
          如果 Aria2 配置了 <code>rpc-secret</code>，请在此填入
        </p>
      </div>

      <!-- 使用代理 -->
      <div class="form-group checkbox-group">
        <label class="checkbox-label">
          <input
            v-model="formData.useProxy"
            type="checkbox"
            class="checkbox-input"
            :disabled="isTestingConnection"
          >
          <span>通过服务器代理（解决跨域问题）</span>
        </label>
        <p class="form-hint">
          如果浏览器无法直接访问 Aria2（跨域或网络隔离），可启用此选项
        </p>
      </div>

      <!-- 操作按钮 -->
      <div class="form-actions">
        <button
          class="btn btn-test"
          :disabled="!canTest || isTestingConnection"
          @click="handleTestConnection"
        >
          <span v-if="isTestingConnection" class="loading-spinner"></span>
          {{ isTestingConnection ? '测试中...' : '测试连接' }}
        </button>

        <button
          class="btn btn-save"
          :disabled="!canSave || isSaving"
          @click="handleSave"
        >
          <span v-if="isSaving" class="loading-spinner"></span>
          {{ isSaving ? '保存中...' : '保存配置' }}
        </button>
      </div>
    </div>

    <!-- 连接状态指示器 -->
    <div class="connection-status">
      <div class="status-indicator" :class="statusClass">
        <div class="status-dot"></div>
        <span class="status-text">{{ statusText }}</span>
      </div>

      <div v-if="aria2Version" class="version-info">
        Aria2 版本: {{ aria2Version }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useAria2 } from '../composables/useAria2'
import type { Aria2Config } from '../composables/useAria2'

const {
  config,
  isConnected,
  version,
  loadConfig,
  saveConfig,
  testConnection,
} = useAria2()

// 表单数据
const formData = ref<Aria2Config>({
  rpcUrl: '',
  secret: '',
  useProxy: false,
})

const showWizard = ref(false)
const isTestingConnection = ref(false)
const isSaving = ref(false)
const urlError = ref('')

// 连接状态
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

const aria2Version = computed(() => {
  return version.value?.version
})

// 是否可以测试连接
const canTest = computed(() => {
  return formData.value.rpcUrl.trim() !== ''
})

// 是否可以保存
const canSave = computed(() => {
  return formData.value.rpcUrl.trim() !== ''
})

/**
 * 验证 URL 格式
 */
function validateUrl(): boolean {
  urlError.value = ''

  const url = formData.value.rpcUrl.trim()
  if (!url) {
    urlError.value = '请输入 RPC URL'
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

/**
 * 测试连接
 */
async function handleTestConnection() {
  if (!validateUrl())
    return

  isTestingConnection.value = true

  // 临时更新配置用于测试
  await saveConfig(formData.value)
  const success = await testConnection()

  isTestingConnection.value = false

  if (!success) {
    urlError.value = '连接失败，请检查 URL 和密钥是否正确'
  }
}

/**
 * 保存配置
 */
async function handleSave() {
  if (!validateUrl())
    return

  isSaving.value = true

  try {
    await saveConfig(formData.value)
  }
  catch (error) {
    console.error('保存失败', error)
  }
  finally {
    isSaving.value = false
  }
}

/**
 * 初始化
 */
onMounted(async () => {
  await loadConfig()

  if (config.value) {
    formData.value = {
      rpcUrl: config.value.rpcUrl,
      secret: config.value.secret,
      useProxy: config.value.useProxy,
    }
  }
  else {
    // 首次使用，显示向导
    showWizard.value = true
  }
})
</script>

<style scoped>
.aria2-settings {
  padding: 24px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.settings-title {
  margin: 0 0 16px 0;
  font-size: 20px;
  font-weight: 600;
  color: #333;
}

/* 配置向导 */
.wizard-banner {
  display: flex;
  gap: 12px;
  padding: 16px;
  margin-bottom: 24px;
  background: #e3f2fd;
  border-radius: 8px;
  border: 1px solid #90caf9;
}

.wizard-icon {
  font-size: 24px;
}

.wizard-content {
  flex: 1;
}

.wizard-title {
  margin: 0 0 4px 0;
  font-weight: 600;
  color: #1976d2;
}

.wizard-text {
  margin: 0 0 12px 0;
  font-size: 14px;
  color: #555;
  line-height: 1.5;
}

.wizard-text code {
  padding: 2px 6px;
  background: rgba(0, 0, 0, 0.1);
  border-radius: 4px;
  font-family: monospace;
  font-size: 13px;
}

.wizard-close {
  padding: 4px 12px;
  background: #1976d2;
  color: #fff;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
}

.wizard-close:hover {
  background: #1565c0;
}

/* 表单 */
.settings-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-label {
  font-weight: 500;
  color: #333;
  font-size: 14px;
}

.form-input {
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  transition: border-color 0.2s;
}

.form-input:focus {
  outline: none;
  border-color: #1976d2;
}

.form-input:disabled {
  background: #f5f5f5;
  cursor: not-allowed;
}

.form-hint {
  margin: 0;
  font-size: 12px;
  color: #999;
}

.form-error {
  margin: 0;
  font-size: 12px;
  color: #f44336;
}

/* 复选框 */
.checkbox-group {
  padding: 12px 0;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.checkbox-input {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.checkbox-input:disabled {
  cursor: not-allowed;
}

/* 按钮 */
.form-actions {
  display: flex;
  gap: 12px;
  margin-top: 8px;
}

.btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 16px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-test {
  background: #fff;
  color: #1976d2;
  border: 1px solid #1976d2;
}

.btn-test:hover:not(:disabled) {
  background: #e3f2fd;
}

.btn-save {
  background: #1976d2;
  color: #fff;
}

.btn-save:hover:not(:disabled) {
  background: #1565c0;
}

.loading-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 连接状态 */
.connection-status {
  margin-top: 24px;
  padding-top: 24px;
  border-top: 1px solid #eee;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  transition: background-color 0.3s;
}

.status-indicator.connected .status-dot {
  background: #4caf50;
  box-shadow: 0 0 6px rgba(76, 175, 80, 0.6);
}

.status-indicator.connecting .status-dot {
  background: #ff9800;
  animation: pulse 1.5s ease-in-out infinite;
}

.status-indicator.disconnected .status-dot {
  background: #9e9e9e;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.status-text {
  font-weight: 500;
  color: #555;
}

.version-info {
  font-size: 12px;
  color: #999;
}

/* 深色模式 */
@media (prefers-color-scheme: dark) {
  .aria2-settings {
    background: #1e1e1e;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }

  .settings-title {
    color: #eee;
  }

  .form-label {
    color: #ddd;
  }

  .form-input {
    background: #2a2a2a;
    border-color: #444;
    color: #eee;
  }

  .form-input:disabled {
    background: #1a1a1a;
  }

  .wizard-banner {
    background: #1a3a52;
    border-color: #2e5f7e;
  }

  .wizard-title {
    color: #64b5f6;
  }

  .wizard-text {
    color: #ccc;
  }

  .status-text {
    color: #ccc;
  }

  .connection-status {
    border-top-color: #333;
  }
}

/* 移动端适配 */
@media (max-width: 768px) {
  .aria2-settings {
    padding: 16px;
  }

  .form-actions {
    flex-direction: column;
  }

  .btn {
    width: 100%;
  }
}
</style>
