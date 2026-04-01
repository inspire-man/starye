/**
 * Feature Flags Composable
 *
 * 前端功能开关管理
 */

import { computed, ref } from 'vue'

export interface FeatureFlag {
  name: string
  enabled: boolean
  description?: string
}

// 从环境变量或配置加载
const flags = ref<Record<string, FeatureFlag>>({
  'aria2-integration': {
    name: 'aria2-integration',
    enabled: import.meta.env.VITE_FEATURE_ARIA2 !== 'false',
    description: 'Aria2 下载管理',
  },
  'quality-rating': {
    name: 'quality-rating',
    enabled: import.meta.env.VITE_FEATURE_RATING !== 'false',
    description: '播放源质量评分',
  },
  'aria2-websocket': {
    name: 'aria2-websocket',
    enabled: import.meta.env.VITE_FEATURE_ARIA2_WS !== 'false',
    description: 'Aria2 WebSocket 实时通知',
  },
  'rating-auto-score': {
    name: 'rating-auto-score',
    enabled: import.meta.env.VITE_FEATURE_AUTO_SCORE !== 'false',
    description: '自动评分算法',
  },
  'performance-monitoring': {
    name: 'performance-monitoring',
    enabled: import.meta.env.VITE_FEATURE_PERF_MONITOR === 'true',
    description: '性能监控',
  },
})

/**
 * 使用 Feature Flags
 */
export function useFeatureFlags() {
  /**
   * 检查功能是否启用
   */
  function isEnabled(featureName: string): boolean {
    const flag = flags.value[featureName]
    return flag ? flag.enabled : false
  }

  /**
   * 获取所有 Feature Flags
   */
  const allFlags = computed(() => flags.value)

  /**
   * 动态更新 Feature Flag（仅用于开发/调试）
   */
  function toggleFlag(featureName: string, enabled: boolean) {
    if (flags.value[featureName]) {
      flags.value[featureName].enabled = enabled
      // Feature toggle updated
    }
  }

  /**
   * 从 API 刷新 Feature Flags
   */
  async function refreshFlags() {
    try {
      const response = await fetch('/api/feature-flags')
      const data = await response.json()

      if (data.code === 0 && data.data) {
        // 更新本地 flags
        for (const [key, flag] of Object.entries(data.data)) {
          if (flags.value[key]) {
            flags.value[key] = flag as FeatureFlag
          }
        }

        // Feature Flags 已刷新
      }
    }
    catch (error) {
      console.error('❌ 刷新 Feature Flags 失败', error)
    }
  }

  return {
    isEnabled,
    allFlags,
    toggleFlag,
    refreshFlags,
  }
}

// 导出单例实例用于全局访问
export const featureFlags = useFeatureFlags()

// 开发环境暴露到全局（用于调试）
if (import.meta.env.DEV) {
  // @ts-expect-error 开发环境全局暴露
  window.__featureFlags = featureFlags
}
