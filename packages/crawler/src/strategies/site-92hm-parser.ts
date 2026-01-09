import type { MangaInfo } from '../lib/strategy'

// 辅助函数：更精确地查找标签对应的文本
function findValueByLabel(elements: Element[], label: string): string | undefined {
  for (const el of elements) {
    const text = el.textContent || ''
    if (text.startsWith(label) || text.includes(label)) {
      // 移除标签本身、冒号和所有空白字符（包括换行）
      return text
        .replace(label, '')
        .replace(/：|:/g, '')
        .trim()
        .split('\n')[0] // 只取第一行
        .trim()
    }
  }
  return undefined
}

// 地区 ID 映射
const REGION_MAP: Record<string, string> = {
  1: '韩国',
  2: '日本',
  3: '台湾',
}

export function parseMangaInfo(doc: Document | Element, url: string): MangaInfo {
  const title = doc.querySelector('h1')?.textContent?.trim() || 'Unknown Title'
  const cover = doc.querySelector('.cover img, .book-cover img, .banner_detail_form .cover img')?.getAttribute('src') || ''

  // 获取所有可能包含元数据的 span 标签
  const blocks = Array.from(doc.querySelectorAll('.info p.subtitle, .info p.tip span.block'))

  // 提取元数据
  const author = findValueByLabel(blocks, '作者') || findValueByLabel(blocks, 'Author')
  const statusText = findValueByLabel(blocks, '状态') || findValueByLabel(blocks, 'Status') || ''
  const rawRegion = findValueByLabel(blocks, '地区') || findValueByLabel(blocks, 'Region') || ''

  // 地区处理：支持名称或 ID 映射
  let region = rawRegion
  if (REGION_MAP[rawRegion]) {
    region = REGION_MAP[rawRegion]
  }
  else {
    // 尝试从链接中获取 ID (例如 /booklist/?area=1)
    const areaLink = doc.querySelector('a[href*="area="]')?.getAttribute('href')
    const areaId = areaLink?.match(/area=(\d+)/)?.[1]
    if (areaId && REGION_MAP[areaId]) {
      region = REGION_MAP[areaId]
    }
  }

  // 题材/标签处理：直接查找标签容器下的所有 A 标签
  const genreLinks = Array.from(doc.querySelectorAll('.info p.tip span.block a[href*="tag="], a[href*="tag="]'))
  const genres = genreLinks.map(a => a.textContent?.trim()).filter((v): v is string => !!v && v !== '全部').filter((v, i, a) => a.indexOf(v) === i)

  // 状态处理
  const status = (statusText.includes('连载') || statusText.includes('Ongoing') || statusText === '0') ? 'serializing' : 'completed'
  const desc = doc.querySelector('.intro, #intro, .content')?.textContent?.replace('简介：', '').trim()

  // 章节解析
  const chapterEls = Array.from(doc.querySelectorAll('#detail-list-select li a, .detail-list-select li a, #chapterlist a'))

  const chapters = chapterEls.map((el, index) => {
    const href = el.getAttribute('href') || ''
    const slug = href.split('/').pop() || ''

    return {
      title: el.textContent?.trim() || `Chapter ${index + 1}`,
      slug,
      url: href,
      number: index + 1,
    }
  }).filter(c => c.url && c.slug)

  return {
    title,
    slug: url.split('/').pop() || '',
    cover,
    author,
    description: desc,
    status,
    region,
    genres,
    sourceUrl: url,
    chapters,
  }
}

export function parseChapterContent(doc: Document | Element): { title: string, images: string[], prev?: string, next?: string } {
  const title = doc.querySelector('h1.title, h1, .title')?.textContent?.trim() || ''

  // 92hm 图片容器可能有多种类名
  // 根据真实 HTML，图片在 .comicpage 容器的 div 子元素中
  const images = Array.from(doc.querySelectorAll('.comicpage img, .comiclist img, .comic-content img, #content img, .rd-article-wr img, .reader-main img'))
    .map(img => img.getAttribute('data-original') || img.getAttribute('data-src') || img.getAttribute('src') || '')
    .filter(src => src && !src.includes('ad') && !src.includes('logo') && !src.includes('wxqrcode.jpg'))
    // 去重，防止同一个图片被解析多次
    .filter((v, i, a) => a.indexOf(v) === i)

  const prev = doc.querySelector('.fanye a:first-child[href], a.prev, .prev a')?.getAttribute('href') || undefined
  const next = doc.querySelector('.fanye a:last-child[href], a.next, .next a')?.getAttribute('href') || undefined

  return { title, images, prev, next }
}
