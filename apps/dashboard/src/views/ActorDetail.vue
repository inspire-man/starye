<script setup lang="ts">
/**
 * 女优详情页
 *
 * 功能：
 * - 显示女优基本信息
 * - 别名管理（添加、删除）
 * - 基本信息编辑
 * - 合作关系图谱
 */

import type { Actor } from '@/lib/api'
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ActorRelationGraph from '@/components/ActorRelationGraph.vue'
import CrawlStatusTag from '@/components/CrawlStatusTag.vue'
import FavoriteButton from '@/components/FavoriteButton.vue'
import { fetchApi } from '@/lib/api'
import { useSession } from '@/lib/auth-client'
import { formatDateTime } from '@/lib/date-utils'

useSession()

const route = useRoute()
const router = useRouter()

const actorId = computed(() => route.params.id as string)
const actor = ref<Actor | null>(null)
const loading = ref(true)
const error = ref('')

// 别名管理
const aliases = ref<string[]>([])
const newAlias = ref('')
const aliasLoading = ref(false)
const aliasError = ref('')

// 编辑模式
const isEditing = ref(false)
const editForm = ref({
  name: '',
  bio: '',
  nationality: '',
})
const updateLoading = ref(false)

async function loadActor() {
  loading.value = true
  error.value = ''

  try {
    const response = await fetchApi<{ data: Actor }>(`/admin/actors/${actorId.value}`)
    actor.value = response.data
    aliases.value = (actor.value?.aliases as string[]) || []

    // 初始化编辑表单
    if (actor.value) {
      editForm.value = {
        name: actor.value.name || '',
        bio: actor.value.bio || '',
        nationality: actor.value.nationality || '',
      }
    }
  }
  catch (e: any) {
    error.value = e.message || '加载失败'
    console.error('Failed to load actor:', e)
  }
  finally {
    loading.value = false
  }
}

async function addAlias() {
  if (!newAlias.value.trim()) {
    aliasError.value = '别名不能为空'
    return
  }

  aliasLoading.value = true
  aliasError.value = ''

  try {
    const response = await fetchApi<{ success: boolean, aliases: string[] }>(`/admin/actors/${actorId.value}/aliases`, {
      method: 'POST',
      body: JSON.stringify({ alias: newAlias.value.trim() }),
    })

    aliases.value = response.aliases || []
    newAlias.value = ''
  }
  catch (e: any) {
    aliasError.value = e.message || '添加失败'
    console.error('Failed to add alias:', e)
  }
  finally {
    aliasLoading.value = false
  }
}

async function removeAlias(alias: string) {
  // eslint-disable-next-line no-alert
  if (!confirm(`确定要删除别名 "${alias}" 吗？`)) {
    return
  }

  try {
    const response = await fetchApi<{ success: boolean, aliases: string[] }>(`/admin/actors/${actorId.value}/aliases/${encodeURIComponent(alias)}`, {
      method: 'DELETE',
    })
    aliases.value = response.aliases || []
  }
  catch (e: any) {
    aliasError.value = e.message || '删除失败'
    console.error('Failed to remove alias:', e)
  }
}

async function saveBasicInfo() {
  updateLoading.value = true

  try {
    await fetchApi(`/admin/actors/${actorId.value}`, {
      method: 'PATCH',
      body: JSON.stringify(editForm.value),
    })
    await loadActor()
    isEditing.value = false
  }
  catch (e: any) {
    error.value = e.message || '更新失败'
    console.error('Failed to update actor:', e)
  }
  finally {
    updateLoading.value = false
  }
}

function cancelEdit() {
  isEditing.value = false
  if (actor.value) {
    editForm.value = {
      name: actor.value.name || '',
      bio: actor.value.bio || '',
      nationality: actor.value.nationality || '',
    }
  }
}

function goBack() {
  router.push('/actors')
}

onMounted(() => {
  loadActor()
})
</script>

<template>
  <div class="actor-detail">
    <!-- 头部导航 -->
    <div class="header">
      <button class="back-button" @click="goBack">
        ← 返回列表
      </button>
      <h1 class="title">
        女优详情
      </h1>
      <div class="header-actions">
        <FavoriteButton
          v-if="actor?.id"
          entity-type="actor"
          :entity-id="actor?.id"
        />
      </div>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="loading">
      加载中...
    </div>

    <!-- 错误提示 -->
    <div v-else-if="error" class="error">
      {{ error }}
    </div>

    <!-- 详情内容 -->
    <div v-else-if="actor" class="content">
      <!-- 基本信息卡片 -->
      <div class="card">
        <div class="card-header">
          <h2>基本信息</h2>
          <button
            v-if="!isEditing"
            class="btn-edit"
            @click="isEditing = true"
          >
            编辑
          </button>
        </div>

        <div class="card-body">
          <!-- 头像 -->
          <div v-if="actor.avatar" class="avatar-section">
            <img :src="actor.avatar" :alt="actor.name" class="avatar">
          </div>

          <!-- 基本信息表单/显示 -->
          <div v-if="isEditing" class="form">
            <div class="form-group">
              <label>名称</label>
              <input
                v-model="editForm.name"
                type="text"
                class="form-input"
                placeholder="女优名称"
              >
            </div>

            <div class="form-group">
              <label>国籍</label>
              <input
                v-model="editForm.nationality"
                type="text"
                class="form-input"
                placeholder="国籍"
              >
            </div>

            <div class="form-group">
              <label>简介</label>
              <textarea
                v-model="editForm.bio"
                class="form-textarea"
                rows="4"
                placeholder="女优简介"
              />
            </div>

            <div class="form-actions">
              <button
                class="btn-primary"
                :disabled="updateLoading"
                @click="saveBasicInfo"
              >
                {{ updateLoading ? '保存中...' : '保存' }}
              </button>
              <button
                class="btn-secondary"
                :disabled="updateLoading"
                @click="cancelEdit"
              >
                取消
              </button>
            </div>
          </div>

          <!-- 信息显示 -->
          <div v-else class="info-grid">
            <div class="info-item">
              <span class="info-label">名称：</span>
              <span class="info-value">{{ actor.name }}</span>
            </div>

            <div class="info-item">
              <span class="info-label">Slug：</span>
              <span class="info-value">{{ actor.slug }}</span>
            </div>

            <div class="info-item">
              <span class="info-label">国籍：</span>
              <span class="info-value">{{ actor.nationality || '-' }}</span>
            </div>

            <div class="info-item">
              <span class="info-label">作品数量：</span>
              <span class="info-value">{{ actor.movieCount || 0 }}</span>
            </div>

            <div class="info-item">
              <span class="info-label">爬取状态：</span>
              <CrawlStatusTag
                :has-details-crawled="actor.hasDetailsCrawled"
                :source-url="actor.sourceUrl"
                :crawl-failure-count="actor.crawlFailureCount"
              />
            </div>

            <div class="info-item">
              <span class="info-label">创建时间：</span>
              <span class="info-value">{{ formatDateTime(actor.createdAt) }}</span>
            </div>

            <div v-if="actor.bio" class="info-item full-width">
              <span class="info-label">简介：</span>
              <p class="info-value bio">
                {{ actor.bio }}
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- 别名管理卡片 -->
      <div class="card">
        <div class="card-header">
          <h2>别名管理</h2>
          <span class="badge">{{ aliases.length }} 个别名</span>
        </div>

        <div class="card-body">
          <!-- 添加别名 -->
          <div class="alias-input-group">
            <input
              v-model="newAlias"
              type="text"
              class="form-input"
              placeholder="输入新别名"
              @keyup.enter="addAlias"
            >
            <button
              class="btn-primary"
              :disabled="aliasLoading || !newAlias.trim()"
              @click="addAlias"
            >
              {{ aliasLoading ? '添加中...' : '添加' }}
            </button>
          </div>

          <!-- 错误提示 -->
          <div v-if="aliasError" class="error-message">
            {{ aliasError }}
          </div>

          <!-- 别名列表 -->
          <div v-if="aliases.length > 0" class="alias-list">
            <div
              v-for="alias in aliases"
              :key="alias"
              class="alias-item"
            >
              <span class="alias-name">{{ alias }}</span>
              <button
                class="btn-remove"
                @click="removeAlias(alias)"
              >
                删除
              </button>
            </div>
          </div>

          <!-- 空状态 -->
          <div v-else class="empty-state">
            暂无别名
          </div>
        </div>
      </div>

      <!-- 合作关系图谱卡片 -->
      <div class="card">
        <div class="card-header">
          <h2>合作关系图谱</h2>
          <span class="badge">查看高频合作伙伴</span>
        </div>

        <div class="card-body graph-card-body">
          <ActorRelationGraph
            v-if="actor.id"
            :actor-id="actor.id"
            :actor-name="actor.name"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.actor-detail {
  padding: 24px;
  max-width: 1200px;
  margin: 0 auto;
}

.header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
}

.header-actions {
  margin-left: auto;
}

.back-button {
  padding: 8px 16px;
  background: #f3f4f6;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.back-button:hover {
  background: #e5e7eb;
}

.title {
  font-size: 24px;
  font-weight: 600;
  margin: 0;
}

.loading,
.error {
  padding: 48px;
  text-align: center;
  color: #6b7280;
}

.error {
  color: #dc2626;
}

.content {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.card {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  border-bottom: 1px solid #e5e7eb;
  background: #f9fafb;
}

.card-header h2 {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
}

.badge {
  padding: 4px 12px;
  background: #e0e7ff;
  color: #4338ca;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.btn-edit {
  padding: 6px 16px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: background 0.2s;
}

.btn-edit:hover {
  background: #2563eb;
}

.card-body {
  padding: 24px;
}

.avatar-section {
  margin-bottom: 24px;
  text-align: center;
}

.avatar {
  width: 150px;
  height: 150px;
  border-radius: 50%;
  object-fit: cover;
  border: 3px solid #e5e7eb;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-group label {
  font-size: 14px;
  font-weight: 500;
  color: #374151;
}

.form-input,
.form-textarea {
  padding: 10px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  transition: border-color 0.2s;
}

.form-input:focus,
.form-textarea:focus {
  outline: none;
  border-color: #3b82f6;
}

.form-textarea {
  resize: vertical;
  font-family: inherit;
}

.form-actions {
  display: flex;
  gap: 12px;
  margin-top: 8px;
}

.btn-primary {
  padding: 10px 24px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: background 0.2s;
}

.btn-primary:hover:not(:disabled) {
  background: #2563eb;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  padding: 10px 24px;
  background: white;
  color: #374151;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-secondary:hover:not(:disabled) {
  background: #f3f4f6;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.info-item.full-width {
  grid-column: 1 / -1;
}

.info-label {
  font-size: 13px;
  color: #6b7280;
  font-weight: 500;
}

.info-value {
  font-size: 14px;
  color: #111827;
}

.info-value.bio {
  line-height: 1.6;
  white-space: pre-wrap;
}

.alias-input-group {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.alias-input-group .form-input {
  flex: 1;
}

.error-message {
  padding: 12px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 6px;
  color: #dc2626;
  font-size: 14px;
  margin-bottom: 16px;
}

.alias-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.alias-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
}

.alias-name {
  font-size: 14px;
  color: #111827;
}

.btn-remove {
  padding: 6px 12px;
  background: transparent;
  color: #dc2626;
  border: 1px solid #dc2626;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s;
}

.btn-remove:hover {
  background: #dc2626;
  color: white;
}

.empty-state {
  padding: 48px;
  text-align: center;
  color: #9ca3af;
  font-size: 14px;
}

.graph-card-body {
  padding: 0;
}

@media (max-width: 768px) {
  .info-grid {
    grid-template-columns: 1fr;
  }

  .alias-input-group {
    flex-direction: column;
  }
}
</style>
