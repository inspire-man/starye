/**
 * 错误处理和用户反馈工具
 *
 * 提供统一的错误处理、本地缓存、重试机制和友好的用户提示
 */

// 错误类型
export type ErrorType = 'aria2-connection' | 'aria2-task' | 'rating' | 'websocket' | 'network' | 'other'

// 错误信息配置
const errorMessages: Record<ErrorType, { title: string, description: string, suggestion: string }> = {
  'aria2-connection': {
    title: 'Aria2 连接失败',
    description: '无法连接到 Aria2 服务',
    suggestion: '请检查 RPC 地址是否正确，Aria2 服务是否已启动',
  },
  'aria2-task': {
    title: 'Aria2 任务操作失败',
    description: '无法执行任务操作',
    suggestion: '请稍后重试，或检查任务是否仍然存在',
  },
  'rating': {
    title: '评分提交失败',
    description: '无法提交评分',
    suggestion: '您的评分已保存到本地，将在网络恢复后自动提交',
  },
  'websocket': {
    title: 'WebSocket 连接断开',
    description: '实时更新已禁用',
    suggestion: '系统将自动尝试重连，或切换到轮询模式',
  },
  'network': {
    title: '网络连接失败',
    description: '无法连接到服务器',
    suggestion: '请检查网络连接后重试',
  },
  'other': {
    title: '操作失败',
    description: '发生未知错误',
    suggestion: '请稍后重试',
  },
}

/**
 * 获取友好的错误提示
 */
export function getFriendlyErrorMessage(errorType: ErrorType, originalError?: Error): {
  title: string
  description: string
  suggestion: string
  technical?: string
} {
  const config = errorMessages[errorType]

  return {
    ...config,
    technical: originalError?.message,
  }
}

/**
 * Aria2 连接错误处理
 */
export function handleAria2ConnectionError(error: Error): string {
  const message = error.message.toLowerCase()

  if (message.includes('timeout')) {
    return '连接超时，请检查 Aria2 地址是否正确'
  }

  if (message.includes('cors') || message.includes('cross-origin')) {
    return 'CORS 错误，请启用"使用代理"选项'
  }

  if (message.includes('refused') || message.includes('failed to fetch')) {
    return '连接被拒绝，请确认 Aria2 服务已启动并配置了 --enable-rpc'
  }

  if (message.includes('unauthorized') || message.includes('401')) {
    return '认证失败，请检查 RPC 密钥是否正确'
  }

  return `连接失败: ${error.message}`
}

/**
 * 本地缓存管理（用于离线重试）
 */
const CACHE_PREFIX = 'starye:pending:'

export interface PendingAction {
  id: string
  type: 'rating' | 'aria2-config'
  data: any
  timestamp: number
  retryCount: number
}

/**
 * 保存待处理操作到本地
 */
export function cachePendingAction(type: PendingAction['type'], data: any): string {
  const id = `${type}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`

  const action: PendingAction = {
    id,
    type,
    data,
    timestamp: Date.now(),
    retryCount: 0,
  }

  try {
    localStorage.setItem(`${CACHE_PREFIX}${id}`, JSON.stringify(action))
    return id
  }
  catch (error) {
    console.error('缓存操作失败', error)
    return ''
  }
}

/**
 * 获取所有待处理操作
 */
export function getPendingActions(): PendingAction[] {
  const actions: PendingAction[] = []

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(CACHE_PREFIX)) {
        const value = localStorage.getItem(key)
        if (value) {
          const action = JSON.parse(value) as PendingAction
          actions.push(action)
        }
      }
    }
  }
  catch (error) {
    console.error('读取待处理操作失败', error)
  }

  return actions
}

/**
 * 删除待处理操作
 */
export function removePendingAction(id: string): void {
  try {
    localStorage.removeItem(`${CACHE_PREFIX}${id}`)
  }
  catch (error) {
    console.error('删除待处理操作失败', error)
  }
}

/**
 * 清空所有待处理操作
 */
export function clearPendingActions(): void {
  const actions = getPendingActions()
  actions.forEach(action => removePendingAction(action.id))
}

/**
 * 重试待处理操作
 */
export async function retryPendingActions(
  retryFn: (action: PendingAction) => Promise<boolean>,
): Promise<{ success: number, failed: number }> {
  const actions = getPendingActions()
  let successCount = 0
  let failedCount = 0

  for (const action of actions) {
    try {
      // 最多重试 3 次
      if (action.retryCount >= 3) {
        removePendingAction(action.id)
        failedCount++
        continue
      }

      const success = await retryFn(action)

      if (success) {
        removePendingAction(action.id)
        successCount++
      }
      else {
        // 增加重试次数
        action.retryCount++
        localStorage.setItem(`${CACHE_PREFIX}${action.id}`, JSON.stringify(action))
        failedCount++
      }
    }
    catch (error) {
      console.error('重试操作失败', error)
      action.retryCount++
      localStorage.setItem(`${CACHE_PREFIX}${action.id}`, JSON.stringify(action))
      failedCount++
    }
  }

  return { success: successCount, failed: failedCount }
}

/**
 * 异常评分检测
 */
export function detectAbnormalRating(ratings: Array<{ score: number, createdAt: Date }>): {
  isAbnormal: boolean
  reason?: string
} {
  if (ratings.length === 0) {
    return { isAbnormal: false }
  }

  // 检查最近的 10 个评分
  const recent = ratings.slice(-10)

  // 检查是否全部为极端评分（全 1 星或全 5 星）
  const allMinOrMax = recent.every(r => r.score === 1 || r.score === 5)
  if (allMinOrMax && recent.length >= 10) {
    return {
      isAbnormal: true,
      reason: '连续 10 个极端评分，可能存在刷分行为',
    }
  }

  // 检查评分频率（1 分钟内超过 10 个）
  const now = Date.now()
  const oneMinuteAgo = now - 60 * 1000
  const recentMinute = ratings.filter(r => new Date(r.createdAt).getTime() > oneMinuteAgo)

  if (recentMinute.length > 10) {
    return {
      isAbnormal: true,
      reason: '评分频率过高，请稍后再试',
    }
  }

  return { isAbnormal: false }
}

/**
 * 报告问题
 */
export interface ProblemReport {
  type: 'player-invalid' | 'rating-abnormal' | 'aria2-issue' | 'other'
  playerId?: string
  movieCode?: string
  description: string
  timestamp: number
}

/**
 * 提交问题报告（保存到本地，后续可上传到后端）
 */
export function reportProblem(report: Omit<ProblemReport, 'timestamp'>): void {
  const fullReport: ProblemReport = {
    ...report,
    timestamp: Date.now(),
  }

  try {
    const reports = getProblemReports()
    reports.push(fullReport)

    // 只保留最近 50 条
    const trimmed = reports.slice(-50)
    localStorage.setItem('starye:problem-reports', JSON.stringify(trimmed))
  }
  catch (error) {
    console.error('记录问题失败', error)
  }
}

/**
 * 获取问题报告列表
 */
export function getProblemReports(): ProblemReport[] {
  try {
    const stored = localStorage.getItem('starye:problem-reports')
    return stored ? JSON.parse(stored) : []
  }
  catch (error) {
    console.error('读取问题报告失败', error)
    return []
  }
}
