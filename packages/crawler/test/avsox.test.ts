import { describe, expect, it, vi } from 'vitest'
import { AvSoxStrategy } from '../src/strategies/avsox'

describe('avSoxStrategy', () => {
  it('should return absolute URLs even if href is protocol-relative or relative', async () => {
    const strategy = new AvSoxStrategy()
    const mockPage = {
      goto: vi.fn(),
      content: vi.fn().mockResolvedValue(`
        <html>
          <body>
            <div id="waterfall">
              <a class="movie-box" href="//avsox.click/cn/movie/test1">Movie 1</a>
              <a class="movie-box" href="https://avsox.click/cn/movie/test2">Movie 2</a>
              <a class="movie-box" href="/cn/movie/test3">Movie 3</a>
            </div>
          </body>
        </html>
      `),
    } as any

    const result = await strategy.getMovieList('https://avsox.click/cn/censored', mockPage)

    // Current behavior (likely failing these expectations)
    // We expect them to be normalized to https://avsox.click...

    // Check for correct normalization
    const normalizedUrl1 = 'https://avsox.click/cn/movie/test1'
    const normalizedUrl3 = 'https://avsox.click/cn/movie/test3'

    expect(result.movies).toContain(normalizedUrl1)
    expect(result.movies).toContain('https://avsox.click/cn/movie/test2')
    expect(result.movies).toContain(normalizedUrl3)

    // Check pagination
    // Ideally it should also be normalized if it's protocol relative, though the Runner handles simple relative paths.
    // But protocol relative paths handled by Runner might result in https://base//path which is wrong if not careful.
    // Let's assume the strategy should normalize it for safety.
  })

  it('should normalize next page link', async () => {
    const strategy = new AvSoxStrategy()
    const mockPage = {
      goto: vi.fn(),
      content: vi.fn().mockResolvedValue(`
        <html>
          <body>
            <div class="pagination">
              <a id="next" href="//avsox.click/cn/censored/page/2">Next</a>
            </div>
          </body>
        </html>
      `),
    } as any

    const result = await strategy.getMovieList('https://avsox.click/cn/censored', mockPage)
    expect(result.next).toBe('https://avsox.click/cn/censored/page/2')
  })

  it('should find next page by text content if ID is missing', async () => {
    const strategy = new AvSoxStrategy()
    const mockPage = {
      goto: vi.fn(),
      content: vi.fn().mockResolvedValue(`
        <html>
          <body>
            <div class="pagination">
              <a href="/cn/censored/page/2">下一页</a>
            </div>
          </body>
        </html>
      `),
    } as any

    const result = await strategy.getMovieList('https://avsox.click/cn/censored', mockPage)
    expect(result.next).toBe('https://avsox.click/cn/censored/page/2')
  })

  it('should normalize cover image in getMovieInfo', async () => {
    const strategy = new AvSoxStrategy()
    const mockPage = {
      goto: vi.fn(),
      content: vi.fn().mockResolvedValue(`
        <html>
          <body>
            <h3>Test Movie</h3>
            <a class="bigImage" href="//avsox.click/cover.jpg"></a>
            <div class="info">
              <p>识别码: <span style="color:red">ABC-123</span></p>
            </div>
          </body>
        </html>
      `),
    } as any

    const result = await strategy.getMovieInfo('https://avsox.click/cn/movie/abc-123', mockPage)
    expect(result.coverImage).toBe('https://avsox.click/cover.jpg')
  })
})
