import { describe, expect, it } from 'vitest'
import { canRenderMedia, classifyMediaStatus } from '../media-status'

describe('media-status', () => {
  it('区分空值、合法 URL 和非法 URL', () => {
    expect(classifyMediaStatus(null)).toBe('missing_value')
    expect(classifyMediaStatus('https://cdn.example/cover.webp')).toBe('external_url')
    expect(classifyMediaStatus('/cover.webp')).toBe('managed')
    expect(classifyMediaStatus('data:image/png;base64,abc')).toBe('load_failed')
    expect(canRenderMedia('https://cdn.example/cover.webp')).toBe(true)
    expect(canRenderMedia('/cover.webp')).toBe(true)
    expect(canRenderMedia('')).toBe(false)
  })

  it('浏览器加载失败后禁止继续渲染', () => {
    expect(canRenderMedia('https://cdn.example/cover.webp', true)).toBe(false)
    expect(canRenderMedia('/cover.webp', true)).toBe(false)
  })
})
