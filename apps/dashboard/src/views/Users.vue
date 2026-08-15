<script setup lang="ts">
import { DataTable, DetailDrawer, Pagination, SkeletonTable, success, usePagination } from '@starye/ui'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { handleError } from '@/composables/useErrorHandler'
import { api } from '@/lib/api'

const { t } = useI18n()

interface User {
  id: string
  name: string
  email: string
  role: string
  createdAt: string
  image?: string | null
  isAdult?: boolean
}

const users = ref<User[]>([])
const loading = ref(true)
const { currentPage, limit: pageSize, totalPages, total, setMeta, goToPage, updatePageSize } = usePagination(20)

const pagedUsers = computed(() => {
  return users.value
})

const tableColumns = [
  { key: 'user', label: '用户', minWidth: '280px' },
  { key: 'role', label: '角色', width: '150px' },
  { key: 'status', label: '状态', width: '110px' },
  { key: 'createdAt', label: '加入时间', width: '150px' },
  { key: 'actions', label: '操作', width: '100px' },
]

// Drawer state
const editingUser = ref<User | null>(null)
const editForm = ref({ role: 'user', isAdult: false })
const saving = ref(false)

function syncMeta() {
  const pages = Math.max(1, Math.ceil(users.value.length / pageSize.value))
  setMeta({ total: users.value.length, totalPages: pages })
  if (currentPage.value > pages)
    goToPage(pages)
}

async function loadUsers() {
  loading.value = true
  try {
    const response = await api.admin.getUsers({
      page: currentPage.value,
      limit: pageSize.value,
    })
    if (Array.isArray(response)) {
      users.value = response
      syncMeta()
    }
    else {
      users.value = response.data
      setMeta({ total: response.meta.total, totalPages: response.meta.totalPages })
      if (currentPage.value > Math.max(1, response.meta.totalPages))
        goToPage(Math.max(1, response.meta.totalPages))
    }
  }
  catch (e: unknown) {
    handleError(e, '加载用户列表失败')
  }
  finally {
    loading.value = false
  }
}

function openEdit(user: User) {
  editingUser.value = user
  editForm.value = { role: user.role, isAdult: user.isAdult || false }
}

function closeEdit() {
  editingUser.value = null
}

async function saveUser() {
  if (!editingUser.value)
    return
  saving.value = true
  try {
    if (editForm.value.role !== editingUser.value.role)
      await api.admin.updateUserRole(editingUser.value.email, editForm.value.role)

    await api.admin.updateUserStatus(editingUser.value.email, editForm.value.isAdult)
    await loadUsers()
    closeEdit()
    success('用户信息更新成功')
  }
  catch (e: unknown) {
    handleError(e, '保存用户信息失败')
  }
  finally {
    saving.value = false
  }
}

watch([currentPage, pageSize], loadUsers, { immediate: true })
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h2 class="text-2xl font-bold tracking-tight">
          {{ t('dashboard.user_management') }}
        </h2>
        <p class="mt-1 text-sm text-muted-foreground">
          管理账号角色与内容访问状态
        </p>
      </div>
      <button class="inline-flex h-9 items-center justify-center rounded-md border border-border bg-background px-3 text-sm font-medium transition-colors hover:bg-muted" type="button" aria-label="刷新用户列表" @click="loadUsers">
        <svg class="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /></svg>
        刷新
      </button>
    </div>

    <SkeletonTable v-if="loading" :rows="10" :columns="5" />

    <DataTable
      v-else
      :data="pagedUsers"
      :columns="tableColumns"
      min-width="820px"
      empty-message="暂无用户"
      @row-click="openEdit"
    >
      <template #cell-user="{ item }">
        <div class="flex items-center gap-3">
          <img :src="item.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.name)}`" :alt="item.name" class="h-9 w-9 rounded-full border border-border object-cover">
          <div class="min-w-0">
            <div class="truncate font-medium text-foreground">
              {{ item.name }}
            </div>
            <div class="truncate text-xs text-muted-foreground">
              {{ item.email }}
            </div>
          </div>
        </div>
      </template>
      <template #cell-role="{ item }">
        <span class="inline-flex items-center rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-medium capitalize">
          {{ item.role === 'super_admin' ? 'Super Admin' : item.role === 'comic_admin' ? 'Comic Admin' : item.role === 'admin' ? 'Admin' : t('dashboard.user') }}
        </span>
      </template>
      <template #cell-status="{ item }">
        <span v-if="item.isAdult" class="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">18+</span>
        <span v-else class="text-xs text-muted-foreground">{{ t('dashboard.standard') }}</span>
      </template>
      <template #cell-createdAt="{ item }">
        <span class="font-mono text-xs text-muted-foreground">{{ new Date(item.createdAt).toLocaleDateString('zh-CN') }}</span>
      </template>
      <template #cell-actions="{ item }">
        <div class="flex justify-end" @click.stop>
          <button class="inline-flex h-8 items-center rounded-md border border-border px-2.5 text-xs font-medium transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary" type="button" @click="openEdit(item)">
            {{ t('dashboard.edit') }}
          </button>
        </div>
      </template>
    </DataTable>

    <Pagination
      v-if="total > 0"
      :current-page="currentPage"
      :total-pages="totalPages"
      :total="total"
      :page-size="pageSize"
      :page-sizes="[10, 20, 50, 100]"
      layout="total, sizes, prev, pager, next, jumper"
      @update:current-page="goToPage"
      @update:page-size="updatePageSize"
    />

    <DetailDrawer
      :open="!!editingUser"
      :title="t('dashboard.edit_user')"
      :description="editingUser?.email ?? ''"
      width="sm"
      @update:open="!$event && closeEdit()"
      @close="closeEdit"
    >
      <div class="space-y-6">
        <div class="space-y-4">
          <div class="space-y-2">
            <label class="text-sm font-medium">{{ t('dashboard.role') }}</label>
            <select v-model="editForm.role" class="h-10 w-full rounded-md border border-border bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15">
              <option value="user">
                {{ t('dashboard.user') }}
              </option>
              <option value="comic_admin">
                Comic Admin
              </option>
              <option value="admin">
                Admin
              </option>
              <option value="super_admin">
                Super Admin
              </option>
            </select>
          </div>

          <label class="flex items-center justify-between gap-4 rounded-lg border border-border bg-muted/30 p-4">
            <span>
              <span class="block text-sm font-medium">{{ t('dashboard.age_verification_18') }}</span>
              <span class="mt-1 block text-xs text-muted-foreground">{{ t('dashboard.allow_access_restricted') }}</span>
            </span>
            <input v-model="editForm.isAdult" type="checkbox" class="h-4 w-4 rounded border-border accent-primary">
          </label>
        </div>

        <div class="flex justify-end gap-2 border-t border-border pt-4">
          <button class="inline-flex h-9 items-center rounded-md px-3 text-sm font-medium transition-colors hover:bg-muted" type="button" @click="closeEdit">
            {{ t('dashboard.cancel') }}
          </button>
          <button :disabled="saving" class="inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50" type="button" @click="saveUser">
            {{ saving ? t('dashboard.saving_dots') : t('dashboard.save_changes') }}
          </button>
        </div>
      </div>
    </DetailDrawer>
  </div>
</template>
