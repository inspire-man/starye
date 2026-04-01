import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { copyMagnetLinks, copyToClipboard } from '../clipboard'

describe('clipboard', () => {
  // Mock Clipboard API
  const mockWriteText = vi.fn()
  const originalClipboard = globalThis.navigator.clipboard
  const originalExecCommand = document.execCommand

  beforeEach(() => {
    // 重置 mock
    mockWriteText.mockReset()

    // Mock Clipboard API
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      value: {
        writeText: mockWriteText,
      },
      configurable: true,
      writable: true,
    })

    // Mock document.execCommand
    document.execCommand = vi.fn().mockReturnValue(true)

    // Mock isSecureContext
    Object.defineProperty(window, 'isSecureContext', {
      value: true,
      configurable: true,
      writable: true,
    })
  })

  afterEach(() => {
    // 恢复原始对象
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      value: originalClipboard,
      configurable: true,
    })
    document.execCommand = originalExecCommand
  })

  describe('copyToClipboard', () => {
    it('应该使用 Clipboard API 复制文本', async () => {
      mockWriteText.mockResolvedValue(undefined)

      const result = await copyToClipboard('test text')

      expect(result).toBe(true)
      expect(mockWriteText).toHaveBeenCalledWith('test text')
    })

    it('当 Clipboard API 失败时应该降级到 execCommand', async () => {
      mockWriteText.mockRejectedValue(new Error('Permission denied'))

      const result = await copyToClipboard('test text')

      expect(result).toBe(true)
      expect(document.execCommand).toHaveBeenCalledWith('copy')
    })

    it('当 Clipboard API 不可用时应该使用 fallback', async () => {
      // 移除 Clipboard API
      Object.defineProperty(globalThis.navigator, 'clipboard', {
        value: undefined,
        configurable: true,
      })

      const result = await copyToClipboard('test text')

      expect(result).toBe(true)
      expect(document.execCommand).toHaveBeenCalledWith('copy')
    })

    it('当非安全上下文时应该使用 fallback', async () => {
      Object.defineProperty(window, 'isSecureContext', {
        value: false,
        configurable: true,
      })

      const result = await copyToClipboard('test text')

      expect(result).toBe(true)
      expect(document.execCommand).toHaveBeenCalledWith('copy')
    })

    it('当所有方法都失败时应该返回 false', async () => {
      mockWriteText.mockRejectedValue(new Error('Failed'))
      document.execCommand = vi.fn().mockReturnValue(false)

      const result = await copyToClipboard('test text')

      expect(result).toBe(false)
    })
  })

  describe('copyMagnetLinks', () => {
    it('应该格式化并复制多个磁链', async () => {
      mockWriteText.mockResolvedValue(undefined)

      const links = [
        { sourceName: '磁力1', sourceUrl: 'magnet:?xt=urn:btih:abc', quality: '4K' },
        { sourceName: '磁力2', sourceUrl: 'magnet:?xt=urn:btih:def', quality: 'HD' },
      ]

      const result = await copyMagnetLinks(links)

      expect(result).toBe(true)
      expect(mockWriteText).toHaveBeenCalledWith(
        expect.stringContaining('[4K] 磁力1'),
      )
      expect(mockWriteText).toHaveBeenCalledWith(
        expect.stringContaining('magnet:?xt=urn:btih:abc'),
      )
      expect(mockWriteText).toHaveBeenCalledWith(
        expect.stringContaining('[HD] 磁力2'),
      )
    })

    it('应该处理没有画质信息的磁链', async () => {
      mockWriteText.mockResolvedValue(undefined)

      const links = [
        { sourceName: '磁力无画质', sourceUrl: 'magnet:?xt=urn:btih:xyz' },
      ]

      const result = await copyMagnetLinks(links)

      expect(result).toBe(true)
      expect(mockWriteText).toHaveBeenCalledWith(
        expect.stringContaining('磁力无画质'),
      )
    })
  })
})
