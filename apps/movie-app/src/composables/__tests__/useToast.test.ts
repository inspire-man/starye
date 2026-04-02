/**
 * useToast composable 单元测试
 */

import { describe, expect, it, vi } from 'vitest'
import { useToast } from '../useToast'

describe('useToast', () => {
  it('初始状态应为隐藏', () => {
    const { toast } = useToast()
    expect(toast.value.show).toBe(false)
    expect(toast.value.message).toBe('')
  })

  it('showToast 应显示消息并设置类型', () => {
    const { toast, showToast } = useToast()
    showToast('测试消息', 'success')

    expect(toast.value.show).toBe(true)
    expect(toast.value.message).toBe('测试消息')
    expect(toast.value.type).toBe('success')
  })

  it('showToast 默认类型为 success', () => {
    const { toast, showToast } = useToast()
    showToast('默认类型测试')

    expect(toast.value.type).toBe('success')
  })

  it('showToast 支持 error 类型', () => {
    const { toast, showToast } = useToast()
    showToast('出错了', 'error')

    expect(toast.value.type).toBe('error')
  })

  it('showToast 支持 info 类型', () => {
    const { toast, showToast } = useToast()
    showToast('提示信息', 'info')

    expect(toast.value.type).toBe('info')
  })

  it('hideToast 应立即隐藏消息', () => {
    const { toast, showToast, hideToast } = useToast()
    showToast('即将隐藏')
    expect(toast.value.show).toBe(true)

    hideToast()
    expect(toast.value.show).toBe(false)
  })

  it('多次调用 showToast 应覆盖前一条消息', () => {
    const { toast, showToast } = useToast()
    showToast('第一条')
    showToast('第二条', 'error')

    expect(toast.value.message).toBe('第二条')
    expect(toast.value.type).toBe('error')
  })

  it('toast 状态为单例（多个 useToast 实例共享）', () => {
    const inst1 = useToast()
    const inst2 = useToast()

    inst1.showToast('来自实例1')
    expect(inst2.toast.value.show).toBe(true)
    expect(inst2.toast.value.message).toBe('来自实例1')
  })

  it('指定 duration 后自动隐藏', async () => {
    vi.useFakeTimers()
    const { toast, showToast } = useToast()

    showToast('自动隐藏', 'success', 1000)
    expect(toast.value.show).toBe(true)

    vi.advanceTimersByTime(1000)
    expect(toast.value.show).toBe(false)

    vi.useRealTimers()
  })
})
