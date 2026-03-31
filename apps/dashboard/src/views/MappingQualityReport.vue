<script setup lang="ts">
/**
 * 映射质量报告页面
 *
 * 功能：
 * - 显示女优/厂商映射覆盖率
 * - 显示映射冲突数量
 * - 显示失效映射数量
 * - 趋势图表
 * - 详细统计信息
 */

import { computed, onMounted, ref } from 'vue'
import { fetchApi } from '@/lib/api'

interface QualityMetrics {
  totalActors: number
  mappedActors: number
  unmappedActors: number
  totalPublishers: number
  mappedPublishers: number
  unmappedPublishers: number
  actorMappingCount: number
  publisherMappingCount: number
  conflictCount: number
  invalidMappingCount: number
  highPriorityUnmapped: number
}

const loading = ref(true)
const error = ref('')
const metrics = ref<QualityMetrics | null>(null)
const refreshing = ref(false)

// 计算覆盖率
const actorCoverage = computed(() => {
  if (!metrics.value || metrics.value.totalActors === 0)
    return 0
  return Math.round((metrics.value.mappedActors / metrics.value.totalActors) * 100)
})

const publisherCoverage = computed(() => {
  if (!metrics.value || metrics.value.totalPublishers === 0)
    return 0
  return Math.round((metrics.value.mappedPublishers / metrics.value.totalPublishers) * 100)
})

// 获取覆盖率等级
function getCoverageGrade(coverage: number) {
  if (coverage >= 95)
    return { grade: 'A+', color: '#10b981' }
  if (coverage >= 90)
    return { grade: 'A', color: '#3b82f6' }
  if (coverage >= 85)
    return { grade: 'B', color: '#f59e0b' }
  if (coverage >= 70)
    return { grade: 'C', color: '#f97316' }
  return { grade: 'D', color: '#dc2626' }
}

// 获取质量评分
const qualityScore = computed(() => {
  if (!metrics.value)
    return 0

  // 权重计算：
  // 女优覆盖率：40%
  // 厂商覆盖率：20%
  // 冲突率：20%（越少越好）
  // 失效率：20%（越少越好）

  const actorScore = actorCoverage.value * 0.4
  const publisherScore = publisherCoverage.value * 0.2

  const conflictRate = metrics.value.actorMappingCount > 0
    ? (metrics.value.conflictCount / metrics.value.actorMappingCount) * 100
    : 0
  const conflictScore = Math.max(0, 100 - conflictRate) * 0.2

  const invalidRate = metrics.value.actorMappingCount > 0
    ? (metrics.value.invalidMappingCount / metrics.value.actorMappingCount) * 100
    : 0
  const invalidScore = Math.max(0, 100 - invalidRate) * 0.2

  return Math.round(actorScore + publisherScore + conflictScore + invalidScore)
})

async function loadMetrics() {
  loading.value = true
  error.value = ''

  try {
    // 注意：这个端点需要在 API 中实现
    const response = await fetchApi<{ data: QualityMetrics }>('/admin/crawlers/mapping-quality')
    metrics.value = response.data
  }
  catch (e: any) {
    error.value = e.message || '加载失败'
    console.error('Failed to load quality metrics:', e)

    // 如果 API 不存在，显示模拟数据
    if (e.message?.includes('404')) {
      error.value = 'API 端点未实现。显示模拟数据以供预览。'

      // 模拟数据
      metrics.value = {
        totalActors: 5000,
        mappedActors: 4500,
        unmappedActors: 500,
        totalPublishers: 126,
        mappedPublishers: 15,
        unmappedPublishers: 111,
        actorMappingCount: 15000,
        publisherMappingCount: 126,
        conflictCount: 5,
        invalidMappingCount: 20,
        highPriorityUnmapped: 50,
      }
    }
  }
  finally {
    loading.value = false
  }
}

async function refreshMetrics() {
  refreshing.value = true
  await loadMetrics()
  refreshing.value = false
}

onMounted(() => {
  loadMetrics()
})
</script>

<template>
  <div class="mapping-quality-report">
    <!-- 头部 -->
    <div class="header">
      <h1 class="title">
        映射质量报告
      </h1>
      <button
        class="btn-primary"
        :disabled="refreshing"
        @click="refreshMetrics"
      >
        {{ refreshing ? '刷新中...' : '刷新数据' }}
      </button>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="loading">
      加载中...
    </div>

    <!-- 错误提示 -->
    <div v-else-if="error && !metrics" class="error">
      <p>{{ error }}</p>
      <button class="btn-primary" @click="loadMetrics">
        重试
      </button>
    </div>

    <!-- 报告内容 -->
    <div v-else-if="metrics" class="content">
      <!-- 错误提示（但有模拟数据） -->
      <div v-if="error" class="warning-banner">
        <p>⚠️ {{ error }}</p>
      </div>

      <!-- 总体质量评分 -->
      <div class="score-card">
        <h2>总体质量评分</h2>
        <div class="score-display">
          <div class="score-value" :style="{ color: getCoverageGrade(qualityScore).color }">
            {{ qualityScore }}
          </div>
          <div class="score-label">
            <span class="score-grade" :style="{ background: getCoverageGrade(qualityScore).color }">
              {{ getCoverageGrade(qualityScore).grade }}
            </span>
            <span class="score-text">分</span>
          </div>
        </div>
        <p class="score-description">
          基于覆盖率、冲突率和失效率的综合评分
        </p>
      </div>

      <!-- 覆盖率统计 -->
      <div class="stats-grid">
        <!-- 女优覆盖率 -->
        <div class="stat-card">
          <div class="stat-header">
            <h3>女优映射覆盖率</h3>
            <span
              class="stat-grade"
              :style="{ background: getCoverageGrade(actorCoverage).color }"
            >
              {{ getCoverageGrade(actorCoverage).grade }}
            </span>
          </div>

          <div class="stat-value">
            {{ actorCoverage }}%
          </div>

          <div class="progress-bar">
            <div
              class="progress-fill"
              :style="{
                width: `${actorCoverage}%`,
                background: getCoverageGrade(actorCoverage).color,
              }"
            />
          </div>

          <div class="stat-details">
            <div class="stat-item">
              <span class="label">总计：</span>
              <span class="value">{{ metrics.totalActors.toLocaleString() }}</span>
            </div>
            <div class="stat-item">
              <span class="label">已映射：</span>
              <span class="value success">{{ metrics.mappedActors.toLocaleString() }}</span>
            </div>
            <div class="stat-item">
              <span class="label">未映射：</span>
              <span class="value warning">{{ metrics.unmappedActors.toLocaleString() }}</span>
            </div>
            <div class="stat-item">
              <span class="label">高优先级未映射：</span>
              <span class="value error">{{ metrics.highPriorityUnmapped.toLocaleString() }}</span>
            </div>
          </div>
        </div>

        <!-- 厂商覆盖率 -->
        <div class="stat-card">
          <div class="stat-header">
            <h3>厂商映射覆盖率</h3>
            <span
              class="stat-grade"
              :style="{ background: getCoverageGrade(publisherCoverage).color }"
            >
              {{ getCoverageGrade(publisherCoverage).grade }}
            </span>
          </div>

          <div class="stat-value">
            {{ publisherCoverage }}%
          </div>

          <div class="progress-bar">
            <div
              class="progress-fill"
              :style="{
                width: `${publisherCoverage}%`,
                background: getCoverageGrade(publisherCoverage).color,
              }"
            />
          </div>

          <div class="stat-details">
            <div class="stat-item">
              <span class="label">总计：</span>
              <span class="value">{{ metrics.totalPublishers.toLocaleString() }}</span>
            </div>
            <div class="stat-item">
              <span class="label">已映射：</span>
              <span class="value success">{{ metrics.mappedPublishers.toLocaleString() }}</span>
            </div>
            <div class="stat-item">
              <span class="label">未映射：</span>
              <span class="value warning">{{ metrics.unmappedPublishers.toLocaleString() }}</span>
            </div>
          </div>

          <div class="note">
            注：SeesaaWiki 厂商页面较少，低覆盖率属正常现象
          </div>
        </div>
      </div>

      <!-- 质量问题统计 -->
      <div class="issues-grid">
        <div class="issue-card">
          <div class="issue-icon conflict">
            ⚠️
          </div>
          <div class="issue-content">
            <h4>映射冲突</h4>
            <div class="issue-value">
              {{ metrics.conflictCount }}
            </div>
            <p class="issue-description">
              多个 JavBus 名字映射到同一个 SeesaaWiki 页面
            </p>
          </div>
        </div>

        <div class="issue-card">
          <div class="issue-icon invalid">
            ❌
          </div>
          <div class="issue-content">
            <h4>失效映射</h4>
            <div class="issue-value">
              {{ metrics.invalidMappingCount }}
            </div>
            <p class="issue-description">
              映射的 URL 返回 404 或页面结构不符
            </p>
          </div>
        </div>

        <div class="issue-card">
          <div class="issue-icon success">
            ✅
          </div>
          <div class="issue-content">
            <h4>有效映射</h4>
            <div class="issue-value">
              {{ (metrics.actorMappingCount - metrics.invalidMappingCount).toLocaleString() }}
            </div>
            <p class="issue-description">
              可正常访问且数据完整的映射
            </p>
          </div>
        </div>
      </div>

      <!-- 建议和操作 -->
      <div class="recommendations-card">
        <h3>改进建议</h3>
        <ul class="recommendations-list">
          <li v-if="actorCoverage < 85" class="recommendation warning">
            <strong>女优覆盖率偏低</strong>：建议运行索引爬虫更新映射表，或人工补充高优先级女优映射
          </li>
          <li v-if="metrics.highPriorityUnmapped > 20" class="recommendation error">
            <strong>高优先级女优未映射过多</strong>：{{ metrics.highPriorityUnmapped }} 个作品数 > 50 的女优未映射，影响数据质量
          </li>
          <li v-if="metrics.conflictCount > 10" class="recommendation warning">
            <strong>映射冲突较多</strong>：检查并解决 {{ metrics.conflictCount }} 个冲突映射
          </li>
          <li v-if="metrics.invalidMappingCount > 50" class="recommendation warning">
            <strong>失效映射较多</strong>：{{ metrics.invalidMappingCount }} 个映射需要更新或删除
          </li>
          <li v-if="actorCoverage >= 90 && metrics.conflictCount < 10" class="recommendation success">
            <strong>映射质量良好</strong>：继续保持定期维护即可
          </li>
        </ul>

        <div class="action-buttons">
          <router-link to="/name-mapping-management" class="btn-primary">
            前往映射管理
          </router-link>
          <a
            href="https://github.com/your-repo/docs/name-mapping-maintenance-guide.md"
            target="_blank"
            class="btn-secondary"
          >
            查看维护指南
          </a>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mapping-quality-report {
  padding: 24px;
  max-width: 1400px;
  margin: 0 auto;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.title {
  font-size: 24px;
  font-weight: 600;
  margin: 0;
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
  text-decoration: none;
  display: inline-block;
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
  text-decoration: none;
  display: inline-block;
}

.btn-secondary:hover {
  background: #f3f4f6;
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

.warning-banner {
  padding: 16px;
  background: #fef3c7;
  border: 1px solid #fcd34d;
  border-radius: 8px;
  color: #92400e;
  margin-bottom: 24px;
}

.content {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.score-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 12px;
  padding: 32px;
  text-align: center;
}

.score-card h2 {
  margin: 0 0 24px;
  font-size: 20px;
  font-weight: 600;
  opacity: 0.9;
}

.score-display {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
}

.score-value {
  font-size: 72px;
  font-weight: 700;
  line-height: 1;
}

.score-label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: flex-start;
}

.score-grade {
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 24px;
  font-weight: 700;
  color: white;
}

.score-text {
  font-size: 18px;
  opacity: 0.9;
}

.score-description {
  margin: 0;
  font-size: 14px;
  opacity: 0.8;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 24px;
}

.stat-card {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 24px;
}

.stat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.stat-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #111827;
}

.stat-grade {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 700;
  color: white;
}

.stat-value {
  font-size: 48px;
  font-weight: 700;
  color: #111827;
  margin-bottom: 16px;
}

.progress-bar {
  height: 8px;
  background: #e5e7eb;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 16px;
}

.progress-fill {
  height: 100%;
  transition: width 0.3s ease;
}

.stat-details {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.stat-item {
  display: flex;
  justify-content: space-between;
  font-size: 14px;
}

.stat-item .label {
  color: #6b7280;
}

.stat-item .value {
  font-weight: 600;
  color: #111827;
}

.stat-item .value.success {
  color: #10b981;
}

.stat-item .value.warning {
  color: #f59e0b;
}

.stat-item .value.error {
  color: #dc2626;
}

.note {
  margin-top: 12px;
  padding: 8px;
  background: #fef3c7;
  border-radius: 4px;
  font-size: 12px;
  color: #92400e;
}

.issues-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 16px;
}

.issue-card {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 20px;
  display: flex;
  gap: 16px;
}

.issue-icon {
  font-size: 32px;
  flex-shrink: 0;
}

.issue-content h4 {
  margin: 0 0 8px;
  font-size: 14px;
  font-weight: 600;
  color: #6b7280;
}

.issue-value {
  font-size: 32px;
  font-weight: 700;
  color: #111827;
  margin-bottom: 4px;
}

.issue-description {
  margin: 0;
  font-size: 13px;
  color: #9ca3af;
  line-height: 1.4;
}

.recommendations-card {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 24px;
}

.recommendations-card h3 {
  margin: 0 0 16px;
  font-size: 18px;
  font-weight: 600;
}

.recommendations-list {
  margin: 0 0 24px;
  padding-left: 20px;
  list-style: none;
}

.recommendation {
  padding: 12px;
  border-left: 3px solid;
  margin-bottom: 12px;
  border-radius: 4px;
  font-size: 14px;
  line-height: 1.6;
}

.recommendation.success {
  background: #d1fae5;
  border-color: #10b981;
  color: #065f46;
}

.recommendation.warning {
  background: #fef3c7;
  border-color: #f59e0b;
  color: #92400e;
}

.recommendation.error {
  background: #fee2e2;
  border-color: #dc2626;
  color: #991b1b;
}

.recommendation strong {
  font-weight: 600;
}

.action-buttons {
  display: flex;
  gap: 12px;
}

@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }

  .issues-grid {
    grid-template-columns: 1fr;
  }

  .score-value {
    font-size: 48px;
  }

  .action-buttons {
    flex-direction: column;
  }
}
</style>
