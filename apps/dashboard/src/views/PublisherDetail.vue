<script setup lang="ts">
/**
 * 厂商详情页
 *
 * 功能：
 * - 显示厂商基本信息
 * - 基本信息编辑
 * - 收藏功能
 */

import type { Publisher } from '@/lib/api'
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import CrawlStatusTag from '@/components/CrawlStatusTag.vue'
import FavoriteButton from '@/components/FavoriteButton.vue'
import { fetchApi } from '@/lib/api'
import { useSession } from '@/lib/auth-client'
import { formatDateTime } from '@/lib/date-utils'

useSession()

const route = useRoute()
const router = useRouter()

const publisherId = computed(() => route.params.id as string)
const publisher = ref<Publisher | null>(null)
const loading = ref(true)
const error = ref('')
const parentPublisherSlug = ref<string | null>(null)

// 编辑模式
const isEditing = ref(false)
const editForm = ref({
  name: '',
  website: '',
  country: '',
})
const updateLoading = ref(false)

async function loadPublisher() {
  loading.value = true
  error.value = ''

  try {
    const response = await fetchApi<{ data: Publisher }>(`/admin/publishers/${publisherId.value}`)
    publisher.value = response.data

    // 初始化编辑表单
    if (publisher.value) {
      editForm.value = {
        name: publisher.value.name || '',
        website: publisher.value.website || '',
        country: publisher.value.country || '',
      }
    }

    // 查找母公司 slug
    if (publisher.value?.parentPublisher) {
      try {
        const parentResponse = await fetchApi<{ data: Publisher[] }>(`/admin/publishers?search=${encodeURIComponent(publisher.value.parentPublisher)}`)
        if (parentResponse.data && parentResponse.data.length > 0) {
          parentPublisherSlug.value = parentResponse.data[0].slug
        }
      }
      catch (e) {
        console.error('Failed to find parent publisher:', e)
      }
    }
  }
  catch (e: any) {
    error.value = e.message || '加载失败'
    console.error('Failed to load publisher:', e)
  }
  finally {
    loading.value = false
  }
}

function goToParentPublisher() {
  if (parentPublisherSlug.value) {
    router.push(`/publishers/${parentPublisherSlug.value}`)
  }
}

async function saveBasicInfo() {
  updateLoading.value = true

  try {
    await fetchApi(`/admin/publishers/${publisherId.value}`, {
      method: 'PATCH',
      body: JSON.stringify(editForm.value),
    })
    await loadPublisher()
    isEditing.value = false
  }
  catch (e: any) {
    error.value = e.message || '更新失败'
    console.error('Failed to update publisher:', e)
  }
  finally {
    updateLoading.value = false
  }
}

function cancelEdit() {
  isEditing.value = false
  if (publisher.value) {
    editForm.value = {
      name: publisher.value.name || '',
      website: publisher.value.website || '',
      country: publisher.value.country || '',
    }
  }
}

function goBack() {
  router.push('/publishers')
}

onMounted(() => {
  loadPublisher()
})
</script>

<template>
  <div class="publisher-detail">
    <!-- 头部导航 -->
    <div class="header">
      <button class="back-button" @click="goBack">
        ← 返回列表
      </button>
      <h1 class="title">
        厂商详情
      </h1>
      <div class="header-actions">
        <FavoriteButton
          v-if="publisher?.id"
          entity-type="publisher"
          :entity-id="publisher.id"
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
    <div v-else-if="publisher" class="content">
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
          <!-- Logo -->
          <div v-if="publisher.logo" class="logo-section">
            <img :src="publisher.logo" :alt="publisher.name" class="logo">
          </div>

          <!-- 基本信息表单/显示 -->
          <div v-if="isEditing" class="form">
            <div class="form-group">
              <label>名称</label>
              <input
                v-model="editForm.name"
                type="text"
                class="form-input"
                placeholder="厂商名称"
              >
            </div>

            <div class="form-group">
              <label>国家</label>
              <input
                v-model="editForm.country"
                type="text"
                class="form-input"
                placeholder="国家"
              >
            </div>

            <div class="form-group">
              <label>官网</label>
              <input
                v-model="editForm.website"
                type="text"
                class="form-input"
                placeholder="官网 URL"
              >
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
              <span class="info-value">{{ publisher.name }}</span>
            </div>

            <div class="info-item">
              <span class="info-label">Slug：</span>
              <span class="info-value">{{ publisher.slug }}</span>
            </div>

            <div class="info-item">
              <span class="info-label">国家：</span>
              <span class="info-value">{{ publisher.country || '-' }}</span>
            </div>

            <div class="info-item">
              <span class="info-label">作品数量：</span>
              <span class="info-value">{{ publisher.movieCount || 0 }}</span>
            </div>

            <div class="info-item">
              <span class="info-label">爬取状态：</span>
              <CrawlStatusTag
                :has-details-crawled="publisher.hasDetailsCrawled"
                :source-url="publisher.sourceUrl"
                :crawl-failure-count="publisher.crawlFailureCount"
              />
            </div>

            <div class="info-item">
              <span class="info-label">创建时间：</span>
              <span class="info-value">{{ formatDateTime(publisher.createdAt) }}</span>
            </div>

            <div v-if="publisher.website" class="info-item full-width">
              <span class="info-label">官网：</span>
              <a :href="publisher.website" target="_blank" rel="noopener noreferrer" class="info-link">
                {{ publisher.website }}
              </a>
            </div>

            <!-- 社交媒体链接 -->
            <div v-if="publisher.twitter" class="info-item">
              <span class="info-label">Twitter：</span>
              <a :href="publisher.twitter" target="_blank" rel="noopener noreferrer" class="info-link">
                {{ publisher.twitter }}
              </a>
            </div>

            <div v-if="publisher.instagram" class="info-item">
              <span class="info-label">Instagram：</span>
              <a :href="publisher.instagram" target="_blank" rel="noopener noreferrer" class="info-link">
                {{ publisher.instagram }}
              </a>
            </div>

            <div v-if="publisher.wikiUrl" class="info-item">
              <span class="info-label">SeesaaWiki：</span>
              <a :href="publisher.wikiUrl" target="_blank" rel="noopener noreferrer" class="info-link">
                查看 Wiki 页面 →
              </a>
            </div>

            <!-- 公司关系 -->
            <div v-if="publisher.parentPublisher" class="info-item">
              <span class="info-label">母公司：</span>
              <button
                v-if="parentPublisherSlug"
                class="parent-link"
                @click="goToParentPublisher"
              >
                {{ publisher.parentPublisher }} →
              </button>
              <span v-else class="info-value">{{ publisher.parentPublisher }}</span>
            </div>

            <div v-if="publisher.brandSeries && publisher.brandSeries.length > 0" class="info-item full-width">
              <span class="info-label">旗下品牌系列：</span>
              <div class="brand-list">
                <span v-for="brand in publisher.brandSeries" :key="brand" class="brand-tag">
                  {{ brand }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.publisher-detail {
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

.logo-section {
  margin-bottom: 24px;
  text-align: center;
}

.logo {
  max-width: 200px;
  max-height: 100px;
  object-fit: contain;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 12px;
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

.form-input {
  padding: 10px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  transition: border-color 0.2s;
}

.form-input:focus {
  outline: none;
  border-color: #3b82f6;
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

.info-link {
  font-size: 14px;
  color: #3b82f6;
  text-decoration: none;
  word-break: break-all;
  transition: color 0.2s;
}

.info-link:hover {
  color: #2563eb;
  text-decoration: underline;
}

.brand-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 4px;
}

.brand-tag {
  padding: 4px 12px;
  background: #e0e7ff;
  color: #4338ca;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 500;
}

.parent-link {
  padding: 0;
  background: none;
  border: none;
  color: #3b82f6;
  font-size: 14px;
  cursor: pointer;
  transition: color 0.2s;
  text-align: left;
}

.parent-link:hover {
  color: #2563eb;
  text-decoration: underline;
}

@media (max-width: 768px) {
  .info-grid {
    grid-template-columns: 1fr;
  }
}
</style>
