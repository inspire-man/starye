import type { MovieInfo } from '../lib/strategy'

/**
 * 辅助函数：根据标签名称查找对应的面板块值
 */
function findValueByLabel(doc: Document | Element, label: string): string | undefined {
  const blocks = Array.from(doc.querySelectorAll('.panel-block'))
  for (const block of blocks) {
    const strong = block.querySelector('strong')
    if (strong && strong.textContent?.includes(label)) {
      return block.querySelector('.value')?.textContent?.trim()
    }
  }
  return undefined
}

/**
 * 从列表页面解析电影链接和下一页链接
 * @param doc - happy-dom 的 Document 对象
 */
export function parseMovieList(doc: Document | Element): { movies: string[], next?: string } {
  const items = Array.from(doc.querySelectorAll('.movie-list .item a.box'))
  const movies = items
    .map(a => a.getAttribute('href'))
    .filter((href): href is string => !!href)
    .map(href => href.startsWith('http') ? href : `https://javdb457.com${href}`)

  const nextEl = doc.querySelector('a.pagination-next')
  const next = nextEl?.getAttribute('href') || undefined

  return {
    movies: [...new Set(movies)], // 去重
    next: next && !next.startsWith('http') ? `https://javdb457.com${next}` : next,
  }
}

/**
 * 从详情页面解析电影元数据
 * @param doc - happy-dom 的 Document 对象
 * @param url - 当前页面的 URL
 */
export function parseMovieInfo(doc: Document | Element, url: string): MovieInfo {
  const title = doc.querySelector('h2.title .current-title')?.textContent?.trim() || ''
  const code = doc.querySelector('h2.title strong:first-child')?.textContent?.trim() || ''
  const coverImage = doc.querySelector('.column-video-cover img')?.getAttribute('src') || undefined

  // 提取日期和时长
  const dateText = findValueByLabel(doc, '日期') || ''
  const releaseDate = dateText ? new Date(dateText).getTime() / 1000 : undefined

  const durationText = findValueByLabel(doc, '時長') || ''
  const duration = Number.parseInt(durationText.replace(/\D/g, '')) || undefined

  // 提取片商和系列
  const publisher = findValueByLabel(doc, '片商')
  const series = findValueByLabel(doc, '系列')

  // 提取标签
  const genreEls = Array.from(doc.querySelectorAll('.panel-block strong'))
    .find(el => el.textContent?.includes('類別'))
    ?.parentElement
    ?.querySelectorAll('.value a')
  const genres = genreEls ? Array.from(genreEls).map(a => a.textContent?.trim()).filter(Boolean) as string[] : []

  // 提取演员
  const actorEls = Array.from(doc.querySelectorAll('.panel-block strong'))
    .find(el => el.textContent?.includes('演員'))
    ?.parentElement
    ?.querySelectorAll('.value a')
  const actors = actorEls ? Array.from(actorEls).map(a => a.textContent?.trim()).filter(Boolean) as string[] : []

  // 提取磁力链接作为播放源
  const magnetItems = Array.from(doc.querySelectorAll('#magnets-content .item'))
  const players = magnetItems.map((item, index) => {
    const name = item.querySelector('.name')?.textContent?.trim() || '磁力链接'
    const magnetUrl = item.querySelector('a[href^="magnet:"]')?.getAttribute('href') || ''
    const size = item.querySelector('.meta')?.textContent?.trim() || ''

    return {
      sourceName: `磁力 - ${name}`,
      sourceUrl: magnetUrl,
      quality: size, // 临时借用 quality 字段存储大小信息
      sortOrder: index,
    }
  }).filter(p => p.sourceUrl)

  return {
    title,
    slug: url.split('/').pop() || '',
    code,
    description: '', // JavDB 详情页通常没有长篇描述，或者在评论区
    coverImage,
    releaseDate,
    duration,
    sourceUrl: url,
    actors,
    genres,
    series,
    publisher,
    isR18: true, // 默认标记为 R18
    players,
  }
}
