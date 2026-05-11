import { useUserStore } from '../stores/user'

/**
 * 登录门控 composable。
 * requireLogin() 返回 false 时已执行跳转，调用方应立即 return。
 * 设计为下期可复用：nextPath 参数支持 Phase 4 历史/进度场景传入自定义路径。
 */
export function useAuthGuard() {
  const userStore = useUserStore()

  /**
   * 检查登录态，未登录则跳转到登录页并返回 false。
   * @param nextPath 登录后回弹路径，默认为当前页
   */
  function requireLogin(nextPath?: string): boolean {
    if (userStore.user)
      return true
    const target = nextPath ?? (window.location.pathname + window.location.search)
    window.location.href = `/auth/login?next=${encodeURIComponent(target)}`
    return false
  }

  return { requireLogin }
}
