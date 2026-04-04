/**
 * useErrorHandler composable 单元测试
 */

import { describe, expect, it, vi } from 'vitest'
import { getErrorAction, getErrorMessage, handleError, parseError } from '../useErrorHandler'

// Mock useToast from @starye/ui
vi.mock('@starye/ui', () => ({
  error: vi.fn(),
}))

// Mock vue-i18n
vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'errors.network': '网络连接失败，请检查网络设置',
        'errors.permission': '权限不足，请联系管理员',
        'errors.unauthorized': '未授权，请重新登录',
        'errors.forbidden': '权限不足，请联系管理员',
        'errors.validation': '输入数据不合法，请检查',
        'errors.server': '服务器错误，请稍后重试',
        'errors.unknown': '未知错误',
        'errors.actions.retry': '请重试',
        'errors.actions.login': '请重新登录',
        'errors.actions.contact_support': '联系支持',
        'errors.actions.check_input': '检查输入',
        'errors.actions.go_back': '返回',
      }
      return translations[key] || key
    },
  }),
}))

describe('useErrorHandler', () => {
  describe('parseError', () => {
    it('应该识别网络错误', () => {
      const networkError = new TypeError('Failed to fetch')
      const parsed = parseError(networkError)

      expect(parsed.type).toBe('network')
      expect(parsed.originalError).toBe(networkError)
    })

    it('应该识别 403 权限错误', () => {
      const permissionError = { status: 403, message: 'Forbidden' }
      const parsed = parseError(permissionError)

      expect(parsed.type).toBe('permission')
      expect(parsed.statusCode).toBe(403)
    })

    it('应该识别 401 权限错误', () => {
      const authError = { status: 401, message: 'Unauthorized' }
      const parsed = parseError(authError)

      expect(parsed.type).toBe('permission')
      expect(parsed.statusCode).toBe(401)
    })

    it('应该识别 400 验证错误', () => {
      const validationError = { status: 400, message: 'Bad Request' }
      const parsed = parseError(validationError)

      expect(parsed.type).toBe('validation')
      expect(parsed.statusCode).toBe(400)
    })

    it('应该识别 422 验证错误', () => {
      const validationError = { status: 422, message: 'Unprocessable Entity' }
      const parsed = parseError(validationError)

      expect(parsed.type).toBe('validation')
      expect(parsed.statusCode).toBe(422)
    })

    it('应该识别 500 服务器错误', () => {
      const serverError = { status: 500, message: 'Internal Server Error' }
      const parsed = parseError(serverError)

      expect(parsed.type).toBe('server')
      expect(parsed.statusCode).toBe(500)
    })

    it('应该识别 503 服务器错误', () => {
      const serverError = { status: 503, message: 'Service Unavailable' }
      const parsed = parseError(serverError)

      expect(parsed.type).toBe('server')
      expect(parsed.statusCode).toBe(503)
    })

    it('应该处理 Error 对象', () => {
      const error = new Error('Something went wrong')
      const parsed = parseError(error)

      expect(parsed.type).toBe('unknown')
      expect(parsed.message).toBe('Something went wrong')
    })

    it('应该处理未知类型错误', () => {
      const parsed = parseError(null)

      expect(parsed.type).toBe('unknown')
      expect(parsed.message).toBe('Unknown error')
    })

    it('应该从字符串创建错误', () => {
      const parsed = parseError('Custom error message')

      expect(parsed.type).toBe('unknown')
      expect(parsed.message).toBe('Unknown error')
      expect(parsed.originalError).toBe('Custom error message')
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
      const parsed = { type: 'permission' as const, message: '403 Forbidden', originalError: new Error('403 Forbidden'), statusCode: 403 }
      const mockT = (key: string) => key === 'errors.forbidden' ? '权限不足' : key

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

    it('应该为未知错误返回 i18n 消息', () => {
      const parsed = { type: 'unknown' as const, message: 'Something weird', originalError: new Error('Something weird') }
      const mockT = (key: string) => key === 'errors.unknown' ? '未知错误' : key

      const message = getErrorMessage(parsed, mockT)

      expect(message).toBe('未知错误')
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
      const mockT = (key: string) => key === 'errors.actions.check_input' ? '检查输入' : key

      const action = getErrorAction(parsed, mockT)

      expect(action).toBe('检查输入')
    })

    it('应该为服务器错误返回联系支持建议', () => {
      const parsed = { type: 'server' as const, message: '500', originalError: new Error('500 Internal Server Error') }
      const mockT = (key: string) => key === 'errors.actions.contact_support' ? '联系支持' : key

      const action = getErrorAction(parsed, mockT)

      expect(action).toBe('联系支持')
    })
  })

  describe('handleError', () => {
    it('应该调用 Toast 显示错误', async () => {
      const { error: showErrorToast } = await import('@starye/ui')

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
          type: 'unknown',
          originalError: expect.any(Error),
        }),
      )

      consoleErrorSpy.mockRestore()
    })
  })
})
