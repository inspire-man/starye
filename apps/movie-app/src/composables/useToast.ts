import { hideToast as hideSharedToast, showToast as showSharedToast } from '@starye/ui'
import { ref } from 'vue'

export interface ToastState {
  show: boolean
  message: string
  type: 'success' | 'error' | 'info'
}

const initialToast: ToastState = { show: false, message: '', type: 'success' }
const toast = ref<ToastState>({ ...initialToast })
let timer: ReturnType<typeof setTimeout> | null = null
let currentToastId: string | null = null

function clearTimer(): void {
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
}

export function useToast() {
  function showToast(message: string, type: ToastState['type'] = 'success', duration = 3000): void {
    clearTimer()
    if (currentToastId)
      hideSharedToast(currentToastId)

    currentToastId = showSharedToast(type, message, { duration })
    toast.value = { show: true, message, type }

    if (duration > 0) {
      timer = setTimeout(() => {
        hideToast()
      }, duration)
    }
  }

  function hideToast(): void {
    clearTimer()
    if (currentToastId)
      hideSharedToast(currentToastId)
    currentToastId = null
    toast.value = { ...initialToast }
  }

  function success(message: string, duration?: number): void {
    showToast(message, 'success', duration)
  }

  function error(message: string, duration?: number): void {
    showToast(message, 'error', duration)
  }

  function info(message: string, duration?: number): void {
    showToast(message, 'info', duration)
  }

  return { toast, showToast, hideToast, success, error, info }
}
