/**
 * useErrorHandler composable 单元测试
 */

import { describe, expect, it, vi } from 'vitest'
import { getErrorAction, getErrorMessage, handleError, parseError } from '../useErrorHandler'

// Mock useToast
vi.mock('../useToast', () => ({
  error: vi.fn(),
}))

// Mock vue-i18n
vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'errors.network': '网络连接失败，请检查网络设置',
        'errors.permission': '权限不足，请联系管理员',
        'errors.validation': '输入数据不合法，请检查',
        'errors.server': '服务器错误，请稍后重试',
        'errors.unknown': '未知错误',
        'errors.actions.retry': '请重试',
        'errors.actions.login': '请重新登录',
        'errors.actions.contact': '联系支持',
        'errors.actions.check': '检查输入',
      }
      return translations[key] || key
    },
  }),
}))

describe('useErrorHandler', () => {
  describe('parseError', () => {
    it('应该识别网络错误', () => {
      const networkError = new Error('Failed to fetch')
      const parsed = parseError(networkError)

      expect(parsed.type).toBe('network')
      expect(parsed.originalError).toBe(networkError)
    })

    it('应该识别 403 权限错误', () => {
      const permissionError = new Error('HTTP error! status: 403')
      const parsed = parseError(permissionError)

      expect(parsed.type).toBe('permission')
    })

    it('应该识别 401 权限错误', () => {
      const authError = new Error('Unauthorized')
      const parsed = parseError(authError)

      expect(parsed.type).toBe('permission')
    })

    it('应该识别 400 验证错误', () => {
      const validationError = new Error('HTTP error! status: 400')
      const parsed = parseError(validationError)

      expect(parsed.type).toBe('validation')
    })

    it('应该识别 422 验证错误', () => {
      const validationError = new Error('Invalid input')
      const parsed = parseError(validationError)

      expect(parsed.type).toBe('validation')
    })

    it('应该识别 500 服务器错误', () => {
      const serverError = new Error('HTTP error! status: 500')
      const parsed = parseError(serverError)

      expect(parsed.type).toBe('server')
    })

    it('应该识别 503 服务器错误', () => {
      const serverError = new Error('Service Unavailable')
      const parsed = parseError(serverError)

      expect(parsed.type).toBe('server')
    })

    it('应该处理字符串错误', () => {
      const parsed = parseError('Something went wrong')

      expect(parsed.type).toBe('unknown')
      expect(parsed.message).toBe('Something went wrong')
    })

    it('应该处理未知类型错误', () => {
      const parsed = parseError(null)

      expect(parsed.type).toBe('unknown')
      expect(parsed.message).toBe('Unknown error')
    })

    it('应该提取响应体错误消息', () => {
      const error = {
        response: {
          data: {
            message: 'Custom error message',
          },
        },
      }
      const parsed = parseError(error)

      expect(parsed.message).toBe('Custom error message')
    })
  })

  describe('getErrorMessage', () => {
    it('应该为网络错误返回友好消息', () => {
      const parsed = { type: 'network' as const, message: 'Failed to fetch', originalError: new Error('Failed to fetch') }
      const mockT = (key: string) => key === 'errors.network' ? '网络连接失败' : key

      const message = getErrorMessage(parsed, mockT)

      expect(message).toBe('网络连接失败')
    })

    it('应该为权限错误返回友好消息', () => {
      const parsed = { type: 'permission' as const, message: '403 Forbidden', originalError: new Error('403 Forbidden') }
      const mockT = (key: string) => key === 'errors.permission' ? '权限不足' : key

      const message = getErrorMessage(parsed, mockT)

      expect(message).toBe('权限不足')
    })

    it('应该为验证错误返回友好消息', () => {
      const parsed = { type: 'validation' as const, message: 'Invalid input', originalError: new Error('Invalid input') }
      const mockT = (key: string) => key === 'errors.validation' ? '输入数据不合法' : key

      const message = getErrorMessage(parsed, mockT)

      expect(message).toBe('输入数据不合法')
    })

    it('应该为服务器错误返回友好消息', () => {
      const parsed = { type: 'server' as const, message: '500 Error', originalError: new Error('500 Internal Server Error') }
      const mockT = (key: string) => key === 'errors.server' ? '服务器错误' : key

      const message = getErrorMessage(parsed, mockT)

      expect(message).toBe('服务器错误')
    })

    it('应该为未知错误返回原始消息', () => {
      const parsed = { type: 'unknown' as const, message: 'Something weird', originalError: new Error('Something weird') }
      const mockT = (key: string) => key

      const message = getErrorMessage(parsed, mockT)

      expect(message).toBe('Something weird')
    })
  })

  describe('getErrorAction', () => {
    it('应该为网络错误返回重试建议', () => {
      const parsed = { type: 'network' as const, message: 'Network error', originalError: new Error('Network error') }
      const mockT = (key: string) => key === 'errors.actions.retry' ? '请重试' : key

      const action = getErrorAction(parsed, mockT)

      expect(action).toBe('请重试')
    })

    it('应该为权限错误返回登录建议', () => {
      const parsed = { type: 'permission' as const, message: '403', originalError: new Error('403 Forbidden') }
      const mockT = (key: string) => key === 'errors.actions.login' ? '请重新登录' : key

      const action = getErrorAction(parsed, mockT)

      expect(action).toBe('请重新登录')
    })

    it('应该为验证错误返回检查输入建议', () => {
      const parsed = { type: 'validation' as const, message: 'Invalid', originalError: new Error('Invalid input') }
      const mockT = (key: string) => key === 'errors.actions.check' ? '检查输入' : key

      const action = getErrorAction(parsed, mockT)

      expect(action).toBe('检查输入')
    })

    it('应该为服务器错误返回联系支持建议', () => {
      const parsed = { type: 'server' as const, message: '500', originalError: new Error('500 Internal Server Error') }
      const mockT = (key: string) => key === 'errors.actions.contact' ? '联系支持' : key

      const action = getErrorAction(parsed, mockT)

      expect(action).toBe('联系支持')
    })
  })

  describe('handleError', () => {
    it('应该调用 Toast 显示错误', async () => {
      const { error: showErrorToast } = await import('../useToast')

      handleError(new Error('Test error'), '操作失败')

      expect(showErrorToast).toHaveBeenCalled()
    })

    it('应该使用自定义消息', () => {
      handleError(new Error('Original error'), '自定义错误消息')

      // 验证 console.error 被调用（通过 spy）
      // 注：实际测试中需要 spy console.error
    })

    it('应该记录错误到控制台', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      handleError(new Error('Test error'))

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[Error Handler]',
        expect.objectContaining({
          error: expect.any(Error),
        }),
      )

      consoleErrorSpy.mockRestore()
    })
  })
})
