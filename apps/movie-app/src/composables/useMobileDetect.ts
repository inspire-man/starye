import { computed, onMounted, onUnmounted, ref } from 'vue'

/**
 * 移动端检测 Composable
 *
 * 用于检测当前设备类型和响应式变化
 */
export function useMobileDetect() {
  const windowWidth = ref(0)

  // 断点定义
  const BREAKPOINTS = {
    mobile: 768,
    tablet: 1024,
  }

  // 设备类型判断
  const isMobile = computed(() => windowWidth.value < BREAKPOINTS.mobile)
  const isTablet = computed(() =>
    windowWidth.value >= BREAKPOINTS.mobile
    && windowWidth.value < BREAKPOINTS.tablet,
  )
  const isDesktop = computed(() => windowWidth.value >= BREAKPOINTS.tablet)

  // 检查设备
  function checkDevice() {
    windowWidth.value = window.innerWidth
  }

  // 防抖处理
  let timeoutId: number | undefined
  function debouncedCheckDevice() {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
    timeoutId = window.setTimeout(checkDevice, 200)
  }

  // 生命周期
  onMounted(() => {
    checkDevice()
    window.addEventListener('resize', debouncedCheckDevice)
  })

  onUnmounted(() => {
    window.removeEventListener('resize', debouncedCheckDevice)
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
  })

  return {
    windowWidth,
    isMobile,
    isTablet,
    isDesktop,
  }
}
