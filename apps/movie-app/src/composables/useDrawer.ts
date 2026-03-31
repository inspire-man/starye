import { ref, watch } from 'vue'

/**
 * 抽屉状态管理 Composable
 *
 * 用于管理抽屉的打开/关闭状态
 */
export function useDrawer() {
  const isOpen = ref(false)

  // 打开抽屉
  function open() {
    isOpen.value = true
  }

  // 关闭抽屉
  function close() {
    isOpen.value = false
  }

  // 切换抽屉状态
  function toggle() {
    isOpen.value = !isOpen.value
  }

  // ESC 键处理
  function handleEscape(e: KeyboardEvent) {
    if (e.key === 'Escape' && isOpen.value) {
      close()
    }
  }

  // 监听状态变化，管理 ESC 键事件
  watch(isOpen, (val) => {
    if (val) {
      window.addEventListener('keydown', handleEscape)
    }
    else {
      window.removeEventListener('keydown', handleEscape)
    }
  })

  return {
    isOpen,
    open,
    close,
    toggle,
  }
}
