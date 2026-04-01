/**
 * Toast 通知系统
 *
 * @module useToast
 * @description
 * 提供全局统一的成功/错误/警告/信息提示，支持自动消失、手动关闭和进度显示。
 *
 * @example 基础用法
 * ```ts
 * import { useToast } from '@/composables/useToast'
 *
 * const { success, error, warning, info } = useToast()
 *
 * // 显示成功消息
 * success('保存成功')
 *
 * // 显示错误消息
 * error('保存失败，请重试')
 *
 * // 显示警告消息
 * warning('此操作不可撤销')
 *
 * // 显示信息消息
 * info('系统维护通知')
 * ```
 *
 * @example 自定义选项
 * ```ts
 * const { showToast } = useToast()
 *
 * // 自定义持续时间和关闭按钮
 * showToast('自定义消息', 'info', { duration: 5000, closable: false })
 * ```
 *
 * @example 进度 Toast（用于长时间操作）
 * ```ts
 * const { showProgress, updateProgress, hideProgress } = useToast()
 *
 * // 显示进度 Toast
 * const id = showProgress('正在上传文件...', 0)
 *
 * // 更新进度
 * updateProgress(id, 50)
 * updateProgress(id, 100)
 *
 * // 完成后隐藏
 * hideProgress(id)
 * ```
 */

import { ref } from 'vue'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  /** 唯一标识符 */
  id: string
  /** Toast 类型 */
  type: ToastType
  /** 显示的消息内容 */
  message: string
  /** 持续时间（毫秒），0 表示不自动关闭 */
  duration?: number
  /** 是否显示关闭按钮 */
  closable?: boolean
}

export interface ProgressToast extends Toast {
  /** 进度百分比（0-100） */
  progress: number
}

export interface ToastOptions {
  /** 持续时间（毫秒），0 表示不自动关闭 */
  duration?: number
  /** 是否显示关闭按钮 */
  closable?: boolean
}

// 全局 Toast 队列
const toasts = ref<Toast[]>([])
const MAX_TOASTS = 5

/**
 * 生成唯一 ID
 */
function generateId(): string {
  return `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

/**
 * 显示 Toast 通知
 */
export function showToast(
  type: ToastType,
  message: string,
  options: ToastOptions = {},
): string {
  const toast: Toast = {
    id: generateId(),
    type,
    message,
    duration: options.duration ?? 3000,
    closable: options.closable ?? true,
  }

  // 队列限制：最多 5 个
  if (toasts.value.length >= MAX_TOASTS) {
    toasts.value.shift()
  }

  toasts.value.push(toast)

  // 自动消失
  if (toast.duration && toast.duration > 0) {
    setTimeout(() => {
      hideToast(toast.id)
    }, toast.duration)
  }

  return toast.id
}

/**
 * 手动关闭 Toast
 */
export function hideToast(id: string): void {
  const index = toasts.value.findIndex(t => t.id === id)
  if (index !== -1) {
    toasts.value.splice(index, 1)
  }
}

/**
 * 显示成功消息
 */
export function success(message: string, options?: ToastOptions): string {
  return showToast('success', message, options)
}

/**
 * 显示错误消息
 */
export function error(message: string, options?: ToastOptions): string {
  return showToast('error', message, { duration: 5000, ...options })
}

/**
 * 显示警告消息
 */
export function warning(message: string, options?: ToastOptions): string {
  return showToast('warning', message, { duration: 4000, ...options })
}

/**
 * 显示信息消息
 */
export function info(message: string, options?: ToastOptions): string {
  return showToast('info', message, options)
}

/**
 * 显示进度 Toast
 */
export function showProgress(message: string): string {
  const toast: ProgressToast = {
    id: generateId(),
    type: 'info',
    message,
    duration: 0, // 不自动消失
    closable: false,
    progress: 0,
  }

  if (toasts.value.length >= MAX_TOASTS) {
    toasts.value.shift()
  }

  toasts.value.push(toast)
  return toast.id
}

/**
 * 更新进度 Toast
 */
export function updateProgress(id: string, progress: number, message?: string): void {
  const toast = toasts.value.find(t => t.id === id) as ProgressToast | undefined
  if (toast) {
    toast.progress = Math.min(100, Math.max(0, progress))
    if (message) {
      toast.message = message
    }
  }
}

/**
 * 关闭进度 Toast
 */
export function hideProgress(id: string): void {
  hideToast(id)
}

/**
 * useToast Composable
 */
export function useToast() {
  return {
    toasts,
    showToast,
    hideToast,
    success,
    error,
    warning,
    info,
    showProgress,
    updateProgress,
    hideProgress,
  }
}
