import { describe, expect, it } from 'vitest'
import {
  extractInfoHash,
  formatMagnetDisplay,
  isMagnetLink,
  validateMagnetLink,
} from '../magnetLink'

describe('magnetLink', () => {
  describe('validateMagnetLink', () => {
    it('应该验证合法的磁力链接', () => {
      const validLinks = [
        'magnet:?xt=urn:btih:0123456789abcdef0123456789abcdef',
        'magnet:?xt=urn:btih:ABCD1234567890ABCD1234567890ABCD',
        'magnet:?xt=urn:btih:0123456789abcdef0123456789abcdef01234567',
        'magnet:?xt=urn:btih:0123456789abcdef0123456789abcdef01234567&dn=test',
      ]

      validLinks.forEach((link, index) => {
        const result = validateMagnetLink(link)
        expect(result, `Link ${index} failed: ${link}`).toBe(true)
      })
    })

    it('应该拒绝不合法的磁力链接', () => {
      const invalidLinks = [
        '',
        'https://example.com',
        'magnet:test',
        'magnet:?xt=invalid',
        'magnet:?xt=urn:btih:short',
        'magnet:?xt=urn:btih:',
        'magnet:?xt=urn:btih:xyz123', // 包含非hex字符
      ]

      invalidLinks.forEach((link) => {
        expect(validateMagnetLink(link)).toBe(false)
      })
    })
  })

  describe('isMagnetLink', () => {
    it('应该识别磁力链接', () => {
      expect(isMagnetLink('magnet:?xt=urn:btih:abc')).toBe(true)
      expect(isMagnetLink('magnet:test')).toBe(true)
    })

    it('应该识别非磁力链接', () => {
      expect(isMagnetLink('https://example.com')).toBe(false)
      expect(isMagnetLink('')).toBe(false)
      expect(isMagnetLink('http://test.com')).toBe(false)
    })
  })

  describe('extractInfoHash', () => {
    it('应该提取正确的 infohash', () => {
      const hash = extractInfoHash('magnet:?xt=urn:btih:0123456789abcdef0123456789abcdef')
      expect(hash).toBe('0123456789abcdef0123456789abcdef')
    })

    it('应该处理带参数的磁力链接', () => {
      const hash = extractInfoHash('magnet:?xt=urn:btih:0123456789abcdef0123456789abcdef&dn=test&tr=tracker')
      expect(hash).toBe('0123456789abcdef0123456789abcdef')
    })

    it('应该处理不区分大小写', () => {
      const hash = extractInfoHash('magnet:?xt=urn:btih:ABCDEF1234567890ABCDEF1234567890ABCD')
      expect(hash).toBe('ABCDEF1234567890ABCDEF1234567890ABCD')
    })

    it('应该为非磁力链接返回 null', () => {
      expect(extractInfoHash('https://example.com')).toBe(null)
      expect(extractInfoHash('')).toBe(null)
    })

    it('应该为格式错误的磁力链接返回 null', () => {
      expect(extractInfoHash('magnet:?xt=invalid')).toBe(null)
    })
  })

  describe('formatMagnetDisplay', () => {
    it('应该格式化磁力链接显示（只显示前8位）', () => {
      const formatted = formatMagnetDisplay('magnet:?xt=urn:btih:0123456789abcdef0123456789abcdef')
      expect(formatted).toBe('magnet:...01234567')
    })

    it('应该处理无法提取hash的情况', () => {
      const formatted = formatMagnetDisplay('https://example.com')
      expect(formatted).toBe('https://example.com')
    })
  })
})
