/**
 * 性能监控 Composable
 *
 * 监控关键操作的性能指标
 */

import { ref } from 'vue'

interface PerformanceMetric {
  operation: string
  startTime: number
  endTime?: number
  duration?: number
}

interface PerformanceStats {
  operation: string
  count: number
  avgDuration: number
  maxDuration: number
  minDuration: number
}

const metrics: PerformanceMetric[] = []
const isEnabled = ref(false)

/**
 * 启用性能监控
 */
export function enablePerformanceMonitoring() {
  isEnabled.value = true
}

/**
 * 禁用性能监控
 */
export function disablePerformanceMonitoring() {
  isEnabled.value = false
}

/**
 * 使用性能监控
 */
export function usePerformanceMonitor() {
  /**
   * 开始性能记录
   */
  function startMeasure(operation: string): number {
    if (!isEnabled.value)
      return -1

    const metric: PerformanceMetric = {
      operation,
      startTime: performance.now(),
    }

    metrics.push(metric)
    return metrics.length - 1
  }

  /**
   * 结束性能记录
   */
  function endMeasure(index: number): number | null {
    if (!isEnabled.value || index < 0 || index >= metrics.length)
      return null

    const metric = metrics[index]
    metric.endTime = performance.now()
    metric.duration = metric.endTime - metric.startTime

    return metric.duration
  }

  /**
   * 记录一个完整的操作
   */
  async function measure<T>(operation: string, fn: () => Promise<T>): Promise<T> {
    if (!isEnabled.value) {
      return await fn()
    }

    const index = startMeasure(operation)

    try {
      const result = await fn()
      const duration = endMeasure(index)

      if (duration !== null && duration > 1000) {
        console.warn(`⚠️ ${operation} 耗时 ${duration.toFixed(2)}ms`)
      }

      return result
    }
    catch (error) {
      endMeasure(index)
      throw error
    }
  }

  /**
   * 获取性能统计
   */
  function getStats(): PerformanceStats[] {
    const statsMap = new Map<string, PerformanceStats>()

    for (const metric of metrics) {
      if (!metric.duration)
        continue

      const existing = statsMap.get(metric.operation)

      if (!existing) {
        statsMap.set(metric.operation, {
          operation: metric.operation,
          count: 1,
          avgDuration: metric.duration,
          maxDuration: metric.duration,
          minDuration: metric.duration,
        })
      }
      else {
        existing.count++
        existing.avgDuration = (existing.avgDuration * (existing.count - 1) + metric.duration) / existing.count
        existing.maxDuration = Math.max(existing.maxDuration, metric.duration)
        existing.minDuration = Math.min(existing.minDuration, metric.duration)
      }
    }

    return Array.from(statsMap.values())
  }

  /**
   * 清除所有性能数据
   */
  function clearMetrics() {
    metrics.length = 0
  }

  /**
   * 输出性能报告
   */
  function printReport() {
    const stats = getStats()

    if (stats.length === 0) {
      return
    }

    // 使用 console.table 展示性能数据
    // eslint-disable-next-line no-console
    console.table(
      stats.map(s => ({
        操作: s.operation,
        次数: s.count,
        平均耗时: `${s.avgDuration.toFixed(2)}ms`,
        最大耗时: `${s.maxDuration.toFixed(2)}ms`,
        最小耗时: `${s.minDuration.toFixed(2)}ms`,
      })),
    )

    // 标记慢操作
    const slowOps = stats.filter(s => s.avgDuration > 500)
    if (slowOps.length > 0) {
      console.warn('\n⚠️ 慢操作警告:')
      for (const op of slowOps) {
        console.warn(`  - ${op.operation}: 平均 ${op.avgDuration.toFixed(2)}ms`)
      }
    }
  }

  return {
    isEnabled,
    startMeasure,
    endMeasure,
    measure,
    getStats,
    clearMetrics,
    printReport,
  }
}

/**
 * 全局性能监控实例（可在开发工具中使用）
 */
if (import.meta.env.DEV) {
  // @ts-expect-error 开发环境全局暴露
  window.__perfMonitor = usePerformanceMonitor()
}
