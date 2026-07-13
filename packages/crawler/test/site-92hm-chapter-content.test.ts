import { describe, expect, it } from 'vitest'
import { normalizeChapterImages } from '../src/strategies/site-92hm'

describe('normalizeChapterImages', () => {
  it('标准化相对路径并保留 query', () => {
    const result = normalizeChapterImages('https://www.92hm.life/read/200/3', [
      '/static/page-1.jpg?token=abc',
      '../images/page-2.webp?quality=90',
      'https://img.example.com/page-3.png?x=1&y=2',
    ])

    expect(result).toEqual([
      'https://www.92hm.life/static/page-1.jpg?token=abc',
      'https://www.92hm.life/read/images/page-2.webp?quality=90',
      'https://img.example.com/page-3.png?x=1&y=2',
    ])
  })

  it('过滤空值、非 http 协议并对标准化结果去重', () => {
    const result = normalizeChapterImages('https://www.92hm.life/chapter/123', [
      '   ',
      '',
      '/images/p-1.jpg?foo=1',
      ' /images/p-1.jpg?foo=1 ',
      'javascript:alert(1)',
      'data:image/png;base64,abc',
      'mailto:test@example.com',
      'https://cdn.example.com/p-2.jpg',
    ])

    expect(result).toEqual([
      'https://www.92hm.life/images/p-1.jpg?foo=1',
      'https://cdn.example.com/p-2.jpg',
    ])
  })
})
