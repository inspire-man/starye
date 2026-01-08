import type { MangaInfo } from '../lib/strategy'

// 为了在浏览器中运行，不能引入 Node.js 特有的包
// 这个函数接收一个类似 Document 的接口
export function parseMangaInfo(doc: Document | Element, url: string): MangaInfo {
  const title = doc.querySelector('h1')?.textContent?.trim() || 'Unknown Title'
  const cover = doc.querySelector('.cover img, .book-cover img')?.getAttribute('src') || ''

  // 优先尝试 .author 类，其次尝试位置选择器
  const authorText = doc.querySelector('.author')?.textContent?.trim()
    || doc.querySelector('.info p:nth-child(2)')?.textContent?.trim()
  const author = authorText?.replace('Author:', '').trim()

  const desc = doc.querySelector('.intro, #intro')?.textContent?.trim()
  const statusText = doc.querySelector('.status, .info .red')?.textContent?.trim()
  const status = statusText?.includes('连载') ? 'ongoing' : 'completed'

  const chapterEls = Array.from(doc.querySelectorAll('#detail-list-select li a, .detail-list-select li a'))

  const chapters = chapterEls.map((el, index) => ({
    title: el.textContent?.trim() || `Chapter ${index + 1}`,
    slug: el.getAttribute('href')?.split('/').pop() || '',
    url: el.getAttribute('href') || '',
    number: chapterEls.length - index,
  })).filter(c => c.url)

  return {
    title,
    slug: url.split('/').pop() || '',
    cover,
    author,
    description: desc,
    status,
    chapters,
  }
}

export function parseChapterContent(doc: Document | Element): { title: string, images: string[], prev?: string, next?: string } {
  const title = doc.querySelector('h1')?.textContent?.trim() || ''

  const images = Array.from(doc.querySelectorAll('.comic-content img, #content img, .rd-article-wr img'))
    .map(img => img.getAttribute('data-original') || img.getAttribute('data-src') || img.getAttribute('src') || '')
    .filter(src => src && !src.includes('ad'))

  const prev = doc.querySelector('a.prev')?.getAttribute('href') || undefined
  const next = doc.querySelector('a.next')?.getAttribute('href') || undefined

  return { title, images, prev, next }
}
