/**
 * Toast 通知 Composable
 * 简化实现，可后续集成第三方 Toast 库
 */

export function useToast() {
  /**
   * 显示成功消息
   */
  function success(message: string) {
    // 简化实现：使用原生 alert
    // 后续可替换为更优雅的 Toast 组件
    console.log('[✓ 成功]', message)
    // 可以在这里集成第三方库，如 Vue Toastification
  }

  /**
   * 显示错误消息
   */
  function error(message: string) {
    console.error('[✗ 错误]', message)
    // 简化实现：使用原生 alert
    // alert(`错误: ${message}`)
  }

  /**
   * 显示警告消息
   */
  function warning(message: string) {
    console.warn('[⚠ 警告]', message)
  }

  /**
   * 显示信息消息
   */
  function info(message: string) {
    console.info('[ℹ 提示]', message)
  }

  return {
    success,
    error,
    warning,
    info,
  }
}
