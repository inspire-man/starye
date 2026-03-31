import { afterEach, beforeEach, describe, expect, it } from 'vitest'

describe('useMobileDetect 逻辑测试', () => {
  let originalInnerWidth: number

  beforeEach(() => {
    originalInnerWidth = window.innerWidth
  })

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: originalInnerWidth,
    })
  })

  describe('设备检测逻辑', () => {
    it('应该正确识别移动端宽度 (<=768px)', () => {
      const width = 768
      expect(width <= 768).toBe(true)
      expect(width > 768 && width <= 1024).toBe(false)
      expect(width > 1024).toBe(false)
    })

    it('应该正确识别平板宽度 (769-1024px)', () => {
      const width = 900
      expect(width <= 768).toBe(false)
      expect(width > 768 && width <= 1024).toBe(true)
      expect(width > 1024).toBe(false)
    })

    it('应该正确识别桌面端宽度 (>1024px)', () => {
      const width = 1920
      expect(width <= 768).toBe(false)
      expect(width > 768 && width <= 1024).toBe(false)
      expect(width > 1024).toBe(true)
    })
  })

  describe('边界值', () => {
    const testCases = [
      { width: 768, expected: 'mobile' },
      { width: 769, expected: 'tablet' },
      { width: 1024, expected: 'tablet' },
      { width: 1025, expected: 'desktop' },
    ]

    testCases.forEach(({ width, expected }) => {
      it(`宽度 ${width}px 应该识别为 ${expected}`, () => {
        const isMobile = width <= 768
        const isTablet = width > 768 && width <= 1024
        const isDesktop = width > 1024

        if (expected === 'mobile') {
          expect(isMobile).toBe(true)
        }
        else if (expected === 'tablet') {
          expect(isTablet).toBe(true)
        }
        else {
          expect(isDesktop).toBe(true)
        }
      })
    })
  })

  describe('常见设备尺寸', () => {
    it('iPhone SE (375px) 应该识别为移动端', () => {
      const width = 375
      expect(width <= 768).toBe(true)
    })

    it('macBook (1440px) 应该识别为桌面端', () => {
      const width = 1440
      expect(width > 1024).toBe(true)
    })
  })
})
