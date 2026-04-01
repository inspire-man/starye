/**
 * 前端监控工具
 *
 * 收集错误日志和性能指标
 */

/* eslint-disable no-console */
/* eslint-disable unused-imports/no-unused-vars */

interface ErrorLog {
  timestamp: number
  message: string
  stack?: string
  context?: Record<string, any>
  userAgent: string
  url: string
}

interface PerformanceLog {
  timestamp: number
  operation: string
  duration: number
  success: boolean
  context?: Record<string, any>
}

// 本地错误日志存储（限制大小）
const errorLogs: ErrorLog[] = []
const performanceLogs: PerformanceLog[] = []
const MAX_LOGS = 100

/**
 * 记录错误
 */
export function logError(
  message: string,
  error?: Error,
  context?: Record<string, any>,
): void {
  const errorLog: ErrorLog = {
    timestamp: Date.now(),
    message,
    stack: error?.stack,
    context,
    userAgent: navigator.userAgent,
    url: window.location.href,
  }

  errorLogs.push(errorLog)

  // 限制日志数量
  if (errorLogs.length > MAX_LOGS) {
    errorLogs.shift()
  }

  // 输出到控制台
  console.error('❌ 错误:', message, error, context)

  // 发送到服务器（可选）
  if (import.meta.env.VITE_MONITORING_ENABLED === 'true') {
    sendErrorToServer(errorLog)
  }
}

/**
 * 记录性能指标
 */
export function logPerformance(
  operation: string,
  duration: number,
  success: boolean,
  context?: Record<string, any>,
): void {
  const perfLog: PerformanceLog = {
    timestamp: Date.now(),
    operation,
    duration,
    success,
    context,
  }

  performanceLogs.push(perfLog)

  // 限制日志数量
  if (performanceLogs.length > MAX_LOGS) {
    performanceLogs.shift()
  }

  // 如果性能较差，输出警告
  if (duration > 1000) {
    console.warn(`⚠️ 慢操作: ${operation} 耗时 ${duration.toFixed(2)}ms`, context)
  }

  // 发送到服务器（可选）
  if (import.meta.env.VITE_MONITORING_ENABLED === 'true') {
    sendPerformanceToServer(perfLog)
  }
}

/**
 * 获取错误日志
 */
export function getErrorLogs(): ErrorLog[] {
  return [...errorLogs]
}

/**
 * 获取性能日志
 */
export function getPerformanceLogs(): PerformanceLog[] {
  return [...performanceLogs]
}

/**
 * 清除所有日志
 */
export function clearLogs(): void {
  errorLogs.length = 0
  performanceLogs.length = 0
  console.log('🧹 日志已清除')
}

/**
 * 导出日志（用于故障排查）
 */
export function exportLogs(): {
  errors: ErrorLog[]
  performance: PerformanceLog[]
  exportTime: string
} {
  return {
    errors: getErrorLogs(),
    performance: getPerformanceLogs(),
    exportTime: new Date().toISOString(),
  }
}

/**
 * 发送错误到服务器
 */
async function sendErrorToServer(errorLog: ErrorLog): Promise<void> {
  try {
    await fetch('/api/monitoring/errors', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(errorLog),
    })
  }
  catch (error) {
    // 静默失败，避免递归错误
  }
}

/**
 * 发送性能指标到服务器
 */
async function sendPerformanceToServer(perfLog: PerformanceLog): Promise<void> {
  try {
    await fetch('/api/monitoring/performance', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(perfLog),
    })
  }
  catch (error) {
    // 静默失败
  }
}

/**
 * 初始化全局错误处理
 */
export function initGlobalErrorHandling(): void {
  // 捕获未处理的 Promise 错误
  window.addEventListener('unhandledrejection', (event) => {
    logError(
      'Unhandled Promise Rejection',
      new Error(event.reason),
      { reason: event.reason },
    )
  })

  // 捕获全局错误
  window.addEventListener('error', (event) => {
    logError(
      event.message,
      event.error,
      {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      },
    )
  })

  console.log('✅ 全局错误处理已初始化')
}

/**
 * 生成监控报告
 */
export function generateMonitoringReport(): string {
  const errors = getErrorLogs()
  const performance = getPerformanceLogs()

  let report = '# 前端监控报告\n\n'
  report += `生成时间: ${new Date().toLocaleString('zh-CN')}\n\n`

  // 错误统计
  report += '## 错误统计\n\n'
  report += `- 总错误数: ${errors.length}\n`

  if (errors.length > 0) {
    const errorsByMessage = new Map<string, number>()
    for (const error of errors) {
      const count = errorsByMessage.get(error.message) || 0
      errorsByMessage.set(error.message, count + 1)
    }

    report += '\n最常见的错误:\n\n'
    const sortedErrors = Array.from(errorsByMessage.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)

    for (const [message, count] of sortedErrors) {
      report += `- ${message}: ${count} 次\n`
    }
  }

  // 性能统计
  report += '\n## 性能统计\n\n'
  report += `- 总操作数: ${performance.length}\n`

  if (performance.length > 0) {
    const opStats = new Map<string, { count: number, totalDuration: number, maxDuration: number }>()

    for (const log of performance) {
      const existing = opStats.get(log.operation) || { count: 0, totalDuration: 0, maxDuration: 0 }
      existing.count++
      existing.totalDuration += log.duration
      existing.maxDuration = Math.max(existing.maxDuration, log.duration)
      opStats.set(log.operation, existing)
    }

    report += '\n| 操作 | 次数 | 平均耗时 | 最大耗时 |\n'
    report += '|------|------|----------|----------|\n'

    for (const [operation, stats] of opStats.entries()) {
      const avg = stats.totalDuration / stats.count
      report += `| ${operation} | ${stats.count} | ${avg.toFixed(2)}ms | ${stats.maxDuration.toFixed(2)}ms |\n`
    }
  }

  return report
}

// 开发环境全局暴露
if (import.meta.env.DEV) {
  // @ts-expect-error 开发环境全局暴露
  window.__monitoring = {
    getErrorLogs,
    getPerformanceLogs,
    clearLogs,
    exportLogs,
    generateReport: generateMonitoringReport,
  }
}
