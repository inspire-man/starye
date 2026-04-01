/**
 * 错误处理 Composable
 *
 * @module useErrorHandler
 * @description
 * 提供统一的错误解析、消息映射和处理，支持多种错误类型的友好提示。
 *
 * @example 基础用法
 * ```ts
 * import { useErrorHandler } from '@/composables/useErrorHandler'
 *
 * const { handleError } = useErrorHandler()
 *
 * try {
 *   await api.saveData()
 * } catch (e) {
 *   handleError(e, '保存数据失败')
 * }
 * ```
 *
 * @example 解析错误类型
 * ```ts
 * const { parseError } = useErrorHandler()
 *
 * try {
 *   await fetch('/api/data')
 * } catch (e) {
 *   const parsed = parseError(e)
 *   console.log(parsed.type) // 'network' | 'permission' | 'server' | ...
 *   console.log(parsed.message) // 友好的错误消息
 * }
 * ```
 *
 * @example 在组件中使用
 * ```vue
 * <script setup lang="ts">
 * import { useErrorHandler } from '@/composables/useErrorHandler'
 * import ErrorDisplay from '@/components/ErrorDisplay.vue'
 *
 * const { handleError, parseError } = useErrorHandler()
 * const error = ref(null)
 *
 * async function loadData() {
 *   try {
 *     await api.getData()
 *   } catch (e) {
 *     error.value = parseError(e)
 *     handleError(e, '加载数据失败')
 *   }
 * }
 * </script>
 *
 * <template>
 *   <ErrorDisplay :error="error" mode="banner" />
 * </template>
 * ```
 */

import { useI18n } from 'vue-i18n'
import { error as showErrorToast } from './useToast'

export type ErrorType = 'network' | 'permission' | 'validation' | 'server' | 'unknown'

export interface ParsedError {
  /** 错误类型 */
  type: ErrorType
  /** 友好的错误消息 */
  message: string
  /** 原始错误对象 */
  originalError: unknown
  /** HTTP 状态码（如果适用） */
  statusCode?: number
  /** 建议的操作（如"重试"、"登录"等） */
  action?: string
}

/**
 * 解析错误对象，识别错误类型
 *
 * @param error - 任意类型的错误对象
 * @returns 解析后的错误信息
 */
export function parseError(error: unknown): ParsedError {
  // 网络错误
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return {
      type: 'network',
      message: 'Network connection failed',
      originalError: error,
    }
  }

  // HTTP 错误
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status: number }).status

    // 权限错误
    if (status === 401 || status === 403) {
      return {
        type: 'permission',
        message: 'Permission denied',
        originalError: error,
        statusCode: status,
      }
    }

    // 验证错误
    if (status === 400 || status === 422) {
      return {
        type: 'validation',
        message: 'Validation error',
        originalError: error,
        statusCode: status,
      }
    }

    // 服务器错误
    if (status >= 500) {
      return {
        type: 'server',
        message: 'Server error',
        originalError: error,
        statusCode: status,
      }
    }
  }

  // 未知错误
  return {
    type: 'unknown',
    message: error instanceof Error ? error.message : 'Unknown error',
    originalError: error,
  }
}

/**
 * 获取用户友好的错误消息
 */
export function getErrorMessage(parsedError: ParsedError, t: (key: string) => string): string {
  const { type, statusCode } = parsedError

  switch (type) {
    case 'network':
      return t('errors.network')
    case 'permission':
      return statusCode === 401
        ? t('errors.unauthorized')
        : t('errors.forbidden')
    case 'validation':
      return t('errors.validation')
    case 'server':
      return t('errors.server')
    default:
      return t('errors.unknown')
  }
}

/**
 * 获取操作建议
 */
export function getErrorAction(parsedError: ParsedError, t: (key: string) => string): string {
  const { type } = parsedError

  switch (type) {
    case 'network':
      return t('errors.actions.retry')
    case 'permission':
      return t('errors.actions.login')
    case 'validation':
      return t('errors.actions.check_input')
    case 'server':
      return t('errors.actions.contact_support')
    default:
      return t('errors.actions.go_back')
  }
}

/**
 * 统一错误处理方法（集成 Toast 显示）
 */
export function handleError(error: unknown, customMessage?: string): void {
  const { t } = useI18n()
  const parsedError = parseError(error)

  // 使用自定义消息或默认消息
  const message = customMessage || getErrorMessage(parsedError, t)
  const action = getErrorAction(parsedError, t)

  // 显示错误 Toast
  showErrorToast(`${message} - ${action}`, { duration: 5000 })

  // 记录错误到控制台（包含上下文信息）
  console.error('[Error Handler]', {
    type: parsedError.type,
    message: parsedError.message,
    statusCode: parsedError.statusCode,
    originalError: parsedError.originalError,
  })
}

/**
 * useErrorHandler Composable
 */
export function useErrorHandler() {
  const { t } = useI18n()

  return {
    parseError,
    getErrorMessage: (error: ParsedError) => getErrorMessage(error, t),
    getErrorAction: (error: ParsedError) => getErrorAction(error, t),
    handleError,
  }
}
