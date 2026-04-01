/**
 * useToast composable 单元测试
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProgressToast } from './useToast'
import { hideProgress, hideToast, showProgress, showToast, success, updateProgress, useToast, error as showError, info, warning } from './useToast'

describe('useToast', () => {
  const toast = useToast()

  beforeEach(() => {
    // 清空 toasts 队列
    toast.toasts.value = []
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  describe('showToast', () => {
    it('应该创建一个 Toast', () => {
      const id = showToast('success', '操作成功')

      expect(toast.toasts.value).toHaveLength(1)
      expect(toast.toasts.value[0]).toMatchObject({
        id,
        type: 'success',
        message: '操作成功',
        closable: true,
      })
    })

    it('应该支持自定义选项', () => {
      const id = showToast('info', '提示信息', {
        duration: 5000,
        closable: false,
      })

      expect(toast.toasts.value[0]).toMatchObject({
        id,
        duration: 5000,
        closable: false,
      })
    })

    it('应该自动消失', () => {
      showToast('success', '操作成功', { duration: 3000 })

      expect(toast.toasts.value).toHaveLength(1)

      vi.advanceTimersByTime(3000)

      expect(toast.toasts.value).toHaveLength(0)
    })

    it('duration 为 0 时不应该自动消失', () => {
      showToast('info', '持久提示', { duration: 0 })

      expect(toast.toasts.value).toHaveLength(1)

      vi.advanceTimersByTime(10000)

      expect(toast.toasts.value).toHaveLength(1)
    })
  })

  describe('hideToast', () => {
    it('应该关闭指定的 Toast', () => {
      const id1 = showToast('success', 'Toast 1')
      const id2 = showToast('info', 'Toast 2')

      expect(toast.toasts.value).toHaveLength(2)

      hideToast(id1)

      expect(toast.toasts.value).toHaveLength(1)
      expect(toast.toasts.value[0].id).toBe(id2)
    })

    it('关闭不存在的 Toast 应该不抛出错误', () => {
      expect(() => hideToast('non-existent-id')).not.toThrow()
    })
  })

  describe('队列限制', () => {
    it('应该限制最多 5 个 Toast', () => {
      for (let i = 0; i < 10; i++) {
        showToast('info', `Toast ${i}`)
      }

      expect(toast.toasts.value).toHaveLength(5)
      expect(toast.toasts.value[0].message).toBe('Toast 5')
      expect(toast.toasts.value[4].message).toBe('Toast 9')
    })
  })

  describe('快捷方法', () => {
    it('success 应该创建 success 类型的 Toast', () => {
      success('成功消息')

      expect(toast.toasts.value[0]).toMatchObject({
        type: 'success',
        message: '成功消息',
      })
    })

    it('error 应该创建 error 类型的 Toast 且持续时间为 5s', () => {
      showError('错误消息')

      expect(toast.toasts.value[0]).toMatchObject({
        type: 'error',
        message: '错误消息',
        duration: 5000,
      })
    })

    it('warning 应该创建 warning 类型的 Toast 且持续时间为 4s', () => {
      warning('警告消息')

      expect(toast.toasts.value[0]).toMatchObject({
        type: 'warning',
        message: '警告消息',
        duration: 4000,
      })
    })

    it('info 应该创建 info 类型的 Toast', () => {
      info('提示消息')

      expect(toast.toasts.value[0]).toMatchObject({
        type: 'info',
        message: '提示消息',
      })
    })
  })

  describe('Progress Toast', () => {
    it('showProgress 应该创建 progress toast', () => {
      const id = showProgress('上传中...')

      const progressToast = toast.toasts.value[0] as ProgressToast

      expect(progressToast).toMatchObject({
        id,
        type: 'info',
        message: '上传中...',
        duration: 0,
        closable: false,
        progress: 0,
      })
    })

    it('updateProgress 应该更新进度', () => {
      const id = showProgress('处理中...')

      updateProgress(id, 50)

      const progressToast = toast.toasts.value[0] as ProgressToast
      expect(progressToast.progress).toBe(50)
    })

    it('updateProgress 应该限制进度在 0-100 之间', () => {
      const id = showProgress('处理中...')

      updateProgress(id, 150)
      expect((toast.toasts.value[0] as ProgressToast).progress).toBe(100)

      updateProgress(id, -10)
      expect((toast.toasts.value[0] as ProgressToast).progress).toBe(0)
    })

    it('updateProgress 应该支持更新消息', () => {
      const id = showProgress('处理中...')

      updateProgress(id, 80, '即将完成...')

      const progressToast = toast.toasts.value[0] as ProgressToast
      expect(progressToast.progress).toBe(80)
      expect(progressToast.message).toBe('即将完成...')
    })

    it('hideProgress 应该关闭 progress toast', () => {
      const id = showProgress('上传中...')

      expect(toast.toasts.value).toHaveLength(1)

      hideProgress(id)

      expect(toast.toasts.value).toHaveLength(0)
    })
  })

  describe('useToast hook', () => {
    it('应该返回所有方法', () => {
      const toast = useToast()

      expect(toast).toHaveProperty('toasts')
      expect(toast).toHaveProperty('showToast')
      expect(toast).toHaveProperty('hideToast')
      expect(toast).toHaveProperty('success')
      expect(toast).toHaveProperty('error')
      expect(toast).toHaveProperty('warning')
      expect(toast).toHaveProperty('info')
      expect(toast).toHaveProperty('showProgress')
      expect(toast).toHaveProperty('updateProgress')
      expect(toast).toHaveProperty('hideProgress')
    })
  })
})
