import { ref } from 'vue'

interface ToastState {
  show: boolean
  message: string
  type: 'success' | 'error' | 'info'
}

const toast = ref<ToastState>({ show: false, message: '', type: 'success' })
let timer: ReturnType<typeof setTimeout> | null = null

export function useToast() {
  function showToast(message: string, type: ToastState['type'] = 'success', duration = 3000) {
    if (timer)
      clearTimeout(timer)
    toast.value = { show: true, message, type }
    timer = setTimeout(() => {
      toast.value.show = false
    }, duration)
  }

  function hideToast() {
    if (timer)
      clearTimeout(timer)
    toast.value.show = false
  }

  return { toast, showToast, hideToast }
}
