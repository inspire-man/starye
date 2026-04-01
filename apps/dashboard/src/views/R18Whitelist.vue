<script setup lang="ts">
import type { User } from 'better-auth'
import { onMounted, ref } from 'vue'
import SkeletonTable from '@/components/SkeletonTable.vue'
import { handleError } from '@/composables/useErrorHandler'
import { success, warning } from '@/composables/useToast'
import { api } from '@/lib/api'

const users = ref<User[]>([])
const allUsers = ref<User[]>([])
const loading = ref(true)

// Add to whitelist dialog
const showAddDialog = ref(false)
const addForm = ref({ email: '' })
const adding = ref(false)

async function loadWhitelist() {
  loading.value = true
  try {
    const response = await api.admin.getR18Whitelist()
    if (response.success) {
      users.value = response.data
    }
  }
  catch (e: unknown) {
    handleError(e, '加载 R18 白名单失败')
  }
  finally {
    loading.value = false
  }
}

async function loadAllUsers() {
  try {
    allUsers.value = await api.admin.getUsers()
  }
  catch (e) {
    handleError(e, '加载用户列表失败')
  }
}

function openAddDialog() {
  showAddDialog.value = true
  addForm.value.email = ''
}

function closeAddDialog() {
  showAddDialog.value = false
  addForm.value.email = ''
}

async function addUser() {
  if (!addForm.value.email) {
    warning('请输入用户邮箱')
    return
  }

  adding.value = true
  try {
    await api.admin.addToR18Whitelist(undefined, addForm.value.email)
    await loadWhitelist()
    closeAddDialog()
    success('已添加到 R18 白名单')
  }
  catch (e: unknown) {
    handleError(e, '添加到 R18 白名单失败')
  }
  finally {
    adding.value = false
  }
}

async function removeUser(userId: string, userName: string) {
  // eslint-disable-next-line no-alert
  if (!confirm(`确定要移除 "${userName}" 的 R18 访问权限吗？`)) {
    return
  }

  try {
    await api.admin.removeFromR18Whitelist(userId)
    await loadWhitelist()
    success(`已移除 ${userName} 的 R18 访问权限`)
  }
  catch (e: unknown) {
    handleError(e, '移除 R18 白名单失败')
  }
}

onMounted(() => {
  loadWhitelist()
  loadAllUsers()
})
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <div>
        <h2 class="text-xl font-bold">
          R18 白名单管理
        </h2>
        <p class="text-sm text-muted-foreground mt-1">
          管理用户的 R18 内容访问权限
        </p>
      </div>
      <div class="flex gap-3">
        <button class="p-2 hover:bg-muted rounded-lg" @click="loadWhitelist">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /></svg>
        </button>
        <button
          class="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90"
          @click="openAddDialog"
        >
          ➕ 添加用户
        </button>
      </div>
    </div>

    <SkeletonTable v-if="loading" :rows="10" :columns="4" />

    <div v-else-if="users.length === 0" class="p-12 text-center text-muted-foreground">
      <div class="text-4xl mb-4">
        🔞
      </div>
      <p class="text-lg font-medium mb-1">
        暂无白名单用户
      </p>
      <p class="text-sm">
        点击 "添加用户" 按钮来授予 R18 内容访问权限
      </p>
    </div>

    <div v-else class="bg-card border rounded-xl overflow-hidden shadow-sm">
      <table class="w-full text-sm text-left">
        <thead class="bg-muted/30 border-b">
          <tr>
            <th class="px-6 py-3 font-medium text-muted-foreground">
              用户
            </th>
            <th class="px-6 py-3 font-medium text-muted-foreground">
              邮箱
            </th>
            <th class="px-6 py-3 font-medium text-muted-foreground">
              授权时间
            </th>
            <th class="px-6 py-3 font-medium text-muted-foreground text-right">
              操作
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="user in users" :key="user.id" class="border-b last:border-0 hover:bg-muted/5">
            <td class="px-6 py-4">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-full bg-red-100 text-red-700 flex items-center justify-center font-bold text-lg">
                  🔞
                </div>
                <div class="font-medium">
                  {{ user.name }}
                </div>
              </div>
            </td>
            <td class="px-6 py-4 text-muted-foreground font-mono text-xs">
              {{ user.email }}
            </td>
            <td class="px-6 py-4 text-muted-foreground text-xs">
              {{ new Date(user.updatedAt).toLocaleString('zh-CN') }}
            </td>
            <td class="px-6 py-4 text-right">
              <button
                class="text-xs font-medium text-red-600 hover:text-red-700 transition-colors"
                @click="removeUser(user.id, user.name)"
              >
                移除
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Add User Dialog -->
    <div v-if="showAddDialog" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div class="bg-background rounded-xl shadow-lg max-w-md w-full p-6 space-y-6 animate-in fade-in zoom-in duration-200">
        <h3 class="text-lg font-bold">
          添加到 R18 白名单
        </h3>

        <div class="space-y-4">
          <div class="space-y-2">
            <label class="text-sm font-medium">用户邮箱</label>
            <input
              v-model="addForm.email"
              type="email"
              placeholder="user@example.com"
              class="w-full p-2 border rounded-lg bg-background"
              @keyup.enter="addUser"
            >
            <p class="text-xs text-muted-foreground">
              输入要授予 R18 访问权限的用户邮箱地址
            </p>
          </div>

          <div class="p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <div class="flex items-start gap-2">
              <span class="text-lg shrink-0">⚠️</span>
              <div class="text-xs text-amber-900">
                <p class="font-medium mb-1">
                  重要提示
                </p>
                <p class="text-amber-800">
                  授予 R18 权限后，用户将能够浏览和访问所有成人内容。请确保用户已满 18 周岁。
                </p>
              </div>
            </div>
          </div>
        </div>

        <div class="flex justify-end gap-3">
          <button
            class="px-4 py-2 text-sm font-medium hover:bg-muted rounded-lg"
            @click="closeAddDialog"
          >
            取消
          </button>
          <button
            :disabled="adding || !addForm.email"
            class="px-4 py-2 text-sm font-medium bg-red-600 text-white hover:bg-red-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            @click="addUser"
          >
            {{ adding ? '添加中...' : '🔞 授予权限' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
