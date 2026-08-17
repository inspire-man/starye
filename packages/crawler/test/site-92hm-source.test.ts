import { describe, expect, it } from 'vitest'
import { MANGA_SOURCE_URL, Site92Hm } from '../src/strategies/site-92hm'

describe('92hm manga source', () => {
  it('uses the verified top-level source and keeps legacy URL matching', () => {
    const strategy = new Site92Hm()

    expect(MANGA_SOURCE_URL).toBe('https://www.92hm.top')
    expect(strategy.baseUrl).toBe(MANGA_SOURCE_URL)
    expect(strategy.match('https://www.92hm.top/book/1012')).toBe(true)
    expect(strategy.match('https://www.92hm.life/book/1012')).toBe(true)
    expect(strategy.match('https://www.92hm.net/book/1012')).toBe(true)
  })
})
