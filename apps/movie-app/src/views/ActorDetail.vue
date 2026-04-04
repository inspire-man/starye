<script setup lang="ts">
import type { ActorDetail } from '../types'
import { onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import ActorRelations from '../components/ActorRelations.vue'
import { actorApi } from '../lib/api-client'

const route = useRoute()
const loading = ref(true)
const actor = ref<ActorDetail | null>(null)
const error = ref('')

async function fetchActorDetail() {
  loading.value = true
  error.value = ''
  try {
    const slug = route.params.slug as string
    const response = await actorApi.getActorDetail(slug)

    if (response.success && response.data) {
      actor.value = response.data
    }
    else {
      error.value = '女优信息未找到'
    }
  }
  catch (err) {
    console.error('Failed to fetch actor detail:', err)
    error.value = '加载失败，请稍后再试'
  }
  finally {
    loading.value = false
  }
}

function formatDate(timestamp?: number) {
  if (!timestamp)
    return '未知'
  return new Date(timestamp * 1000).toLocaleDateString('zh-CN')
}

onMounted(() => {
  fetchActorDetail()
})
</script>

<template>
  <div class="actor-detail-page">
    <div class="container">
      <!-- 加载中 -->
      <div v-if="loading" class="loading">
        加载中...
      </div>

      <!-- 错误 -->
      <div v-else-if="error" class="error">
        {{ error }}
      </div>

      <!-- 女优详情 -->
      <div v-else-if="actor" class="actor-detail">
        <!-- 头部 -->
        <div class="actor-header">
          <div class="actor-cover">
            <img
              v-if="actor.avatar"
              :src="actor.avatar"
              :alt="actor.name"
            >
            <div v-else class="cover-placeholder">
              {{ actor.name[0] }}
            </div>
          </div>

          <div class="actor-info">
            <h1 class="actor-name">
              {{ actor.name }}
            </h1>

            <div v-if="!actor.hasDetailsCrawled" class="info-notice">
              <p>详细信息待补全</p>
            </div>

            <div v-else class="info-grid">
              <div v-if="actor.nationality" class="info-item">
                <span class="label">国籍</span>
                <span class="value">{{ actor.nationality }}</span>
              </div>

              <div v-if="actor.birthDate" class="info-item">
                <span class="label">生日</span>
                <span class="value">{{ formatDate(actor.birthDate) }}</span>
              </div>

              <div v-if="actor.height" class="info-item">
                <span class="label">身高</span>
                <span class="value">{{ actor.height }} cm</span>
              </div>

              <div v-if="actor.measurements" class="info-item">
                <span class="label">三围</span>
                <span class="value">{{ actor.measurements }}</span>
              </div>

              <div v-if="actor.cupSize" class="info-item">
                <span class="label">罩杯</span>
                <span class="value">{{ actor.cupSize }}</span>
              </div>

              <div v-if="actor.bloodType" class="info-item">
                <span class="label">血型</span>
                <span class="value">{{ actor.bloodType }}</span>
              </div>

              <div v-if="actor.debutDate" class="info-item">
                <span class="label">出道日期</span>
                <span class="value">{{ formatDate(actor.debutDate) }}</span>
              </div>

              <div v-if="actor.isActive !== undefined" class="info-item">
                <span class="label">状态</span>
                <span class="value">{{ actor.isActive ? '活跃' : '已引退' }}</span>
              </div>
            </div>

            <div v-if="actor.bio" class="actor-bio">
              <h3>简介</h3>
              <p>{{ actor.bio }}</p>
            </div>
          </div>
        </div>

        <!-- 作品列表 -->
        <div class="movies-section">
          <h2 class="section-title">
            作品列表 ({{ actor.movieCount }})
          </h2>

          <div v-if="actor.relatedMovies.length === 0" class="empty">
            暂无作品
          </div>

          <div v-else class="movies-grid">
            <RouterLink
              v-for="movie in actor.relatedMovies"
              :key="movie.id"
              :to="`/movie/${movie.code}`"
              class="movie-card"
            >
              <div class="movie-cover">
                <img
                  v-if="movie.coverImage"
                  :src="movie.coverImage"
                  :alt="movie.title"
                >
                <div v-else class="cover-placeholder">
                  {{ movie.title[0] }}
                </div>
              </div>
              <div class="movie-info">
                <h3 class="movie-title">
                  {{ movie.title }}
                </h3>
                <p class="movie-code">
                  {{ movie.code }}
                </p>
                <p v-if="movie.releaseDate" class="movie-date">
                  {{ formatDate(movie.releaseDate) }}
                </p>
              </div>
            </RouterLink>
          </div>
        </div>

        <!-- 合作关系 -->
        <ActorRelations
          v-if="actor.id"
          :actor-id="actor.id"
          :actor-name="actor.name"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.actor-detail-page {
  padding: 2rem 0;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1rem;
}

.loading,
.error {
  text-align: center;
  padding: 2rem;
  color: #666;
}

.error {
  color: #dc2626;
}

.actor-header {
  display: grid;
  grid-template-columns: 250px 1fr;
  gap: 2rem;
  margin-bottom: 3rem;
}

.actor-cover {
  aspect-ratio: 3 / 4;
  background: #f3f4f6;
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.actor-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cover-placeholder {
  font-size: 4rem;
  font-weight: bold;
  color: #9ca3af;
}

.actor-name {
  font-size: 2rem;
  font-weight: bold;
  margin-bottom: 1.5rem;
}

.info-notice {
  padding: 1rem;
  background: #fef3c7;
  border-radius: 8px;
  color: #92400e;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.label {
  font-size: 0.875rem;
  color: #6b7280;
}

.value {
  font-size: 1rem;
  font-weight: 500;
}

.actor-bio {
  padding: 1rem;
  background: #f9fafb;
  border-radius: 8px;
}

.actor-bio h3 {
  font-size: 1.125rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.actor-bio p {
  color: #4b5563;
  line-height: 1.6;
}

.section-title {
  font-size: 1.5rem;
  font-weight: 600;
  margin-bottom: 1.5rem;
}

.empty {
  text-align: center;
  padding: 2rem;
  color: #6b7280;
}

.movies-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 1.5rem;
}

.movie-card {
  display: flex;
  flex-direction: column;
  text-decoration: none;
  color: inherit;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
  transition: transform 0.2s, box-shadow 0.2s;
}

.movie-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.movie-cover {
  aspect-ratio: 2 / 3;
  background: #f3f4f6;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.movie-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.movie-info {
  padding: 0.75rem;
}

.movie-title {
  font-size: 0.875rem;
  font-weight: 600;
  margin-bottom: 0.25rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.movie-code {
  font-size: 0.75rem;
  color: #6b7280;
  margin-bottom: 0.25rem;
}

.movie-date {
  font-size: 0.75rem;
  color: #9ca3af;
}

@media (max-width: 768px) {
  .actor-header {
    grid-template-columns: 1fr;
  }

  .actor-cover {
    max-width: 250px;
    margin: 0 auto;
  }
}
</style>
