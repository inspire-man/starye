/**
 * Toast 通知系统
 * 提供全局统一的成功/错误/警告/信息提示
 */

import { ref } from 'vue'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  id: string
  type: ToastType
  message: string
  duration?: number
  closable?: boolean
}

export interface ProgressToast extends Toast {
  progress: number
}

export interface ToastOptions {
  duration?: number
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
