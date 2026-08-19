import type { Page } from 'puppeteer-core'
import { describe, expect, it, vi } from 'vitest'
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

  it('continues to the target list when the session warm-up times out', async () => {
    const strategy = new Site92Hm()
    const internals = strategy as unknown as {
      delayStrategy: { calculateDelay: () => number }
    }
    internals.delayStrategy.calculateDelay = () => 0

    const cookies = [{ name: 'session', value: 'ready', domain: 'www.92hm.top' }]
    const page = {
      setUserAgent: vi.fn().mockResolvedValue(undefined),
      setExtraHTTPHeaders: vi.fn().mockResolvedValue(undefined),
      goto: vi.fn()
        .mockRejectedValueOnce(Object.assign(new Error('Navigation timeout of 60000 ms exceeded'), { name: 'TimeoutError' }))
        .mockResolvedValueOnce(null),
      cookies: vi.fn().mockResolvedValue(cookies),
      setCookie: vi.fn().mockResolvedValue(undefined),
      content: vi.fn().mockResolvedValue('<a href="/book/1012">漫画</a>'),
    } as unknown as Page

    const result = await strategy.getMangaList(`${MANGA_SOURCE_URL}/booklist`, page)

    expect(page.cookies).toHaveBeenCalledOnce()
    expect(page.setCookie).toHaveBeenCalledWith(...cookies)
    expect(page.goto).toHaveBeenNthCalledWith(1, MANGA_SOURCE_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    })
    expect(page.goto).toHaveBeenCalledWith(`${MANGA_SOURCE_URL}/booklist`, {
      waitUntil: 'domcontentloaded',
      timeout: 90000,
    })
    expect(result.mangas).toEqual([`${MANGA_SOURCE_URL}/book/1012`])
  })
})
