<script setup lang="ts">
import type { PublisherDetail } from '../types'
import { onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { publisherApi } from '../lib/api-client'

const route = useRoute()
const loading = ref(true)
const publisher = ref<PublisherDetail | null>(null)
const error = ref('')

async function fetchPublisherDetail() {
  loading.value = true
  error.value = ''
  try {
    const slug = route.params.slug as string
    const response = await publisherApi.getPublisherDetail(slug)

    if (response.success && response.data) {
      publisher.value = response.data
    }
    else {
      error.value = '厂商信息未找到'
    }
  }
  catch (err) {
    console.error('Failed to fetch publisher detail:', err)
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
  fetchPublisherDetail()
})
</script>

<template>
  <div class="ui-public-page publisher-detail-page">
    <div class="container">
      <!-- 加载中 -->
      <div v-if="loading" class="loading">
        加载中...
      </div>

      <!-- 错误 -->
      <div v-else-if="error" class="error">
        {{ error }}
      </div>

      <!-- 厂商详情 -->
      <div v-else-if="publisher" class="publisher-detail">
        <!-- 头部 -->
        <div class="publisher-header">
          <div class="publisher-logo-large">
            <img
              v-if="publisher.logo"
              :src="publisher.logo"
              :alt="publisher.name"
            >
            <div v-else class="logo-placeholder">
              {{ publisher.name[0] }}
            </div>
          </div>

          <div class="publisher-info">
            <h1 class="publisher-name">
              {{ publisher.name }}
            </h1>

            <div v-if="!publisher.hasDetailsCrawled" class="info-notice">
              <p>详细信息待补全</p>
            </div>

            <div v-else class="info-grid">
              <div v-if="publisher.country" class="info-item">
                <span class="label">国家</span>
                <span class="value">{{ publisher.country }}</span>
              </div>

              <div v-if="publisher.foundedYear" class="info-item">
                <span class="label">成立年份</span>
                <span class="value">{{ publisher.foundedYear }}</span>
              </div>

              <div v-if="publisher.website" class="info-item">
                <span class="label">官网</span>
                <a :href="publisher.website" target="_blank" class="value link">
                  访问网站
                </a>
              </div>
            </div>

            <div v-if="publisher.description" class="publisher-description">
              <h3>简介</h3>
              <p>{{ publisher.description }}</p>
            </div>
          </div>
        </div>

        <!-- 作品列表 -->
        <div class="movies-section">
          <h2 class="section-title">
            作品列表 ({{ publisher.movieCount }})
          </h2>

          <div v-if="publisher.relatedMovies.length === 0" class="empty">
            暂无作品
          </div>

          <div v-else class="movies-grid">
            <RouterLink
              v-for="movie in publisher.relatedMovies"
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
      </div>
    </div>
  </div>
</template>

<style scoped>
.publisher-detail-page {
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
  color: hsl(var(--muted-foreground));
}

.error {
  color: hsl(var(--status-danger));
}

.publisher-header {
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: 2rem;
  margin-bottom: 3rem;
}

.publisher-logo-large {
  aspect-ratio: 16 / 9;
  background: hsl(var(--muted));
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
}

.publisher-logo-large img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.logo-placeholder {
  font-size: 4rem;
  font-weight: bold;
  color: hsl(var(--muted-foreground));
}

.publisher-name {
  font-size: 2rem;
  font-weight: bold;
  margin-bottom: 1.5rem;
}

.info-notice {
  padding: 1rem;
  background: hsl(var(--status-warning-soft));
  border-radius: 8px;
  color: hsl(var(--status-warning));
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
  color: hsl(var(--muted-foreground));
}

.value {
  font-size: 1rem;
  font-weight: 500;
}

.link {
  color: hsl(var(--status-info));
  text-decoration: underline;
}

.publisher-description {
  padding: 1rem;
  background: hsl(var(--card));
  border-radius: 8px;
}

.publisher-description h3 {
  font-size: 1.125rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.publisher-description p {
  color: hsl(var(--foreground));
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
  color: hsl(var(--muted-foreground));
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
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
  overflow: hidden;
  transition: transform 0.2s, box-shadow 0.2s;
}

.movie-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--ui-surface-shadow-hover);
}

.movie-cover {
  aspect-ratio: 2 / 3;
  background: hsl(var(--muted));
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.movie-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: right center;
}

.cover-placeholder {
  font-size: 3rem;
  font-weight: bold;
  color: hsl(var(--muted-foreground));
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
  color: hsl(var(--muted-foreground));
  margin-bottom: 0.25rem;
}

.movie-date {
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
}

@media (max-width: 768px) {
  .publisher-header {
    grid-template-columns: 1fr;
  }

  .publisher-logo-large {
    max-width: 300px;
    margin: 0 auto;
  }
}
</style>

<style scoped>
.publisher-detail-page {
  padding: 0;
}

.publisher-detail-page .loading,
.publisher-detail-page .error,
.publisher-detail-page .empty {
  color: hsl(var(--muted-foreground));
}

.publisher-detail-page .error {
  color: hsl(var(--status-danger));
}

.publisher-detail-page .publisher-logo-large,
.publisher-detail-page .movie-cover {
  border: 1px solid hsl(var(--border));
  background: hsl(var(--muted));
}

.publisher-detail-page .publisher-logo-large {
  border-radius: var(--ui-radius-lg);
  box-shadow: var(--ui-surface-shadow);
}

.publisher-detail-page .logo-placeholder,
.publisher-detail-page .cover-placeholder {
  color: hsl(var(--muted-foreground));
}

.publisher-detail-page .info-notice {
  border: 1px solid hsl(var(--status-warning) / 0.22);
  border-radius: var(--ui-radius-md);
  background: hsl(var(--status-warning-soft));
  color: hsl(var(--status-warning));
}

.publisher-detail-page .label,
.publisher-detail-page .movie-code,
.publisher-detail-page .movie-date {
  color: hsl(var(--muted-foreground));
}

.publisher-detail-page .link {
  color: hsl(var(--primary));
}

.publisher-detail-page .publisher-description {
  border: 1px solid hsl(var(--border));
  border-radius: var(--ui-radius-md);
  background: hsl(var(--muted) / 0.5);
}

.publisher-detail-page .publisher-description p {
  color: hsl(var(--muted-foreground));
}

.publisher-detail-page .movie-card {
  border-color: hsl(var(--border));
  border-radius: var(--ui-radius-lg);
  background: hsl(var(--card));
  box-shadow: var(--ui-surface-shadow);
}

.publisher-detail-page .movie-card:hover {
  border-color: hsl(var(--primary) / 0.4);
  box-shadow: var(--ui-surface-shadow-hover);
}

.publisher-detail-page .movie-title {
  color: hsl(var(--foreground));
}

.publisher-detail-page .movie-info {
  padding: var(--ui-space-3);
}
</style>
