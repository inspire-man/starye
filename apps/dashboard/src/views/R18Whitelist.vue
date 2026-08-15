<script setup lang="ts">
import type { User } from 'better-auth'
import { ConfirmDialog, DataTable, DetailDrawer, Pagination, SkeletonTable, success, usePagination, useToast } from '@starye/ui'
import { computed, onMounted, ref, watch } from 'vue'
import { handleError } from '@/composables/useErrorHandler'
import { api } from '@/lib/api'

const { warning: toastWarning } = useToast()
const users = ref<User[]>([])
const loading = ref(true)
const selectedUser = ref<User | null>(null)
const userDrawerOpen = ref(false)
const removeConfirmUser = ref<{ id: string, name: string } | null>(null)
const { currentPage, limit: pageSize, totalPages, total, setMeta, goToPage, updatePageSize } = usePagination(20)

const pagedUsers = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return users.value.slice(start, start + pageSize.value)
})

const tableColumns = [
  { key: 'user', label: '用户', minWidth: '260px' },
  { key: 'email', label: '邮箱', minWidth: '220px' },
  { key: 'updatedAt', label: '授权时间', width: '180px' },
  { key: 'actions', label: '操作', width: '100px' },
]

// Add to whitelist dialog
const showAddDialog = ref(false)
const addForm = ref({ email: '' })
const adding = ref(false)

function syncMeta() {
  const pages = Math.max(1, Math.ceil(users.value.length / pageSize.value))
  setMeta({ total: users.value.length, totalPages: pages })
  if (currentPage.value > pages)
    goToPage(pages)
}

async function loadWhitelist() {
  loading.value = true
  try {
    const response = await api.admin.getR18Whitelist()
    if (response.success) {
      users.value = response.data
      syncMeta()
    }
  }
  catch (e: unknown) {
    handleError(e, '加载 R18 白名单失败')
  }
  finally {
    loading.value = false
  }
}

function openAddDialog() {
  showAddDialog.value = true
  addForm.value.email = ''
}

function openUserDetails(user: User) {
  selectedUser.value = user
  userDrawerOpen.value = true
}

function closeUserDetails() {
  userDrawerOpen.value = false
  selectedUser.value = null
}

function closeAddDialog() {
  showAddDialog.value = false
  addForm.value.email = ''
}

async function addUser() {
  if (!addForm.value.email) {
    toastWarning('请输入用户邮箱')
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
  removeConfirmUser.value = { id: userId, name: userName }
}

async function confirmRemoveUser() {
  if (!removeConfirmUser.value)
    return

  const { id: userId, name: userName } = removeConfirmUser.value
  removeConfirmUser.value = null

  try {
    await api.admin.removeFromR18Whitelist(userId)
    await loadWhitelist()
    success(`已移除 ${userName} 的 R18 访问权限`)
  }
  catch (e: unknown) {
    handleError(e, '移除 R18 白名单失败')
  }
}

watch(pageSize, syncMeta)
onMounted(loadWhitelist)
</script>

<template>
  <div class="r18-whitelist-page dashboard-list-page">
    <div class="list-toolbar">
      <span class="list-toolbar-text">管理用户的 R18 内容访问权限</span>
      <div class="list-toolbar-group">
        <button class="list-toolbar-secondary" type="button" @click="loadWhitelist">
          刷新
        </button>
        <button class="list-toolbar-primary" type="button" @click="openAddDialog">
          添加用户
        </button>
      </div>
    </div>

    <SkeletonTable v-if="loading" :rows="10" :columns="4" action-width="100px" />

    <DataTable
      v-else
      :data="pagedUsers"
      :columns="tableColumns"
      min-width="760px"
      empty-message="暂无白名单用户"
      @row-click="openUserDetails"
    >
      <template #cell-user="{ item }">
        <div class="flex items-center gap-3">
          <div class="flex h-9 w-9 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-sm font-semibold text-primary">
            18+
          </div>
          <span class="font-medium">{{ item.name }}</span>
        </div>
      </template>
      <template #cell-email="{ item }">
        <span class="font-mono text-xs text-muted-foreground">{{ item.email }}</span>
      </template>
      <template #cell-updatedAt="{ item }">
        <span class="text-xs text-muted-foreground">{{ new Date(item.updatedAt).toLocaleString('zh-CN') }}</span>
      </template>
      <template #cell-actions="{ item }">
        <div class="flex justify-end" @click.stop>
          <button class="inline-flex h-8 items-center rounded-md border border-destructive/25 px-2.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10" type="button" @click="removeUser(item.id, item.name)">
            移除
          </button>
        </div>
      </template>
    </DataTable>

    <Pagination
      v-if="loading || total > 0"
      :current-page="currentPage"
      :total-pages="totalPages"
      :total="total"
      :loading="loading"
      :page-size="pageSize"
      :page-sizes="[10, 20, 50, 100]"
      layout="total, sizes, prev, pager, next, jumper"
      @update:current-page="goToPage"
      @update:page-size="updatePageSize"
    />

    <ConfirmDialog
      :open="!!removeConfirmUser"
      title="移除 R18 白名单"
      :message="removeConfirmUser ? `确定要移除「${removeConfirmUser.name}」的 R18 访问权限吗？` : ''"
      confirm-text="确认移除"
      cancel-text="取消"
      variant="danger"
      @update:open="!$event && (removeConfirmUser = null)"
      @confirm="confirmRemoveUser"
    />

    <DetailDrawer
      :open="userDrawerOpen && !!selectedUser"
      :title="selectedUser?.name || '用户详情'"
      :description="selectedUser?.email || ''"
      width="sm"
      @update:open="$event ? undefined : closeUserDetails()"
    >
      <div v-if="selectedUser" class="space-y-5">
        <div class="flex items-center gap-4 rounded-xl border border-border bg-muted/30 p-4">
          <div class="flex h-14 w-14 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-lg font-semibold text-primary">
            18+
          </div>
          <div class="min-w-0">
            <p class="truncate font-semibold">
              {{ selectedUser.name }}
            </p>
            <p class="mt-1 truncate text-sm text-muted-foreground">
              {{ selectedUser.email }}
            </p>
          </div>
        </div>

        <dl class="divide-y divide-border rounded-xl border border-border">
          <div class="flex items-center justify-between gap-4 px-4 py-3">
            <dt class="text-sm text-muted-foreground">
              用户 ID
            </dt>
            <dd class="break-all text-right font-mono text-xs">
              {{ selectedUser.id }}
            </dd>
          </div>
          <div class="flex items-center justify-between gap-4 px-4 py-3">
            <dt class="text-sm text-muted-foreground">
              授权时间
            </dt>
            <dd class="text-sm">
              {{ new Date(selectedUser.updatedAt).toLocaleString('zh-CN') }}
            </dd>
          </div>
        </dl>
      </div>

      <template #footer>
        <div class="flex justify-end">
          <button
            v-if="selectedUser"
            class="inline-flex h-9 items-center justify-center rounded-md border border-destructive/25 px-3 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
            type="button"
            @click.stop="removeUser(selectedUser.id, selectedUser.name)"
          >
            移除白名单
          </button>
        </div>
      </template>
    </DetailDrawer>

    <div v-if="showAddDialog" class="fixed inset-0 z-[1100] flex items-center justify-center bg-background/70 p-4 backdrop-blur-sm">
      <div class="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl">
        <h3 class="text-lg font-semibold">
          添加到 R18 白名单
        </h3>

        <div class="mt-5 space-y-4">
          <div class="space-y-2">
            <label class="text-sm font-medium">用户邮箱</label>
            <input v-model="addForm.email" type="email" placeholder="user@example.com" class="h-10 w-full rounded-md border border-border bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15" @keyup.enter="addUser">
            <p class="text-xs text-muted-foreground">
              输入要授予 R18 访问权限的用户邮箱地址
            </p>
          </div>

          <div class="rounded-lg border border-amber-200/70 bg-amber-50/70 p-3 text-xs text-amber-900">
            授予权限后，该用户可以浏览和访问成人内容，请确认其符合站点规则。
          </div>
        </div>

        <div class="mt-6 flex justify-end gap-2">
          <button class="inline-flex h-9 items-center rounded-md px-3 text-sm font-medium transition-colors hover:bg-muted" type="button" @click="closeAddDialog">
            取消
          </button>
          <button :disabled="adding || !addForm.email" class="inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50" type="button" @click="addUser">
            {{ adding ? '添加中...' : '授予权限' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
