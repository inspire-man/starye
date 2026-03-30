/**
 * SeesaaWiki 标记语言解析器
 * 负责解析 Wiki 页面的 HTML 内容，提取女优和厂商信息
 */

import type { Cheerio, CheerioAPI } from 'cheerio'
import type {
  ActorDetails,
  ActorIndexEntry,
  ParseError,
  ParseResult,
  PublisherDetails,
  Work,
} from './types'

/**
 * 解析日期字符串，支持多种日文格式
 * 支持格式：
 * - "2012年7月13日"
 * - "2012/07/13"
 * - "2012-07-13"
 * - "2012年7月"（仅年月）
 */
export function parseJapaneseDate(dateStr: string): number | null {
  if (!dateStr || dateStr.trim() === '')
    return null

  try {
    // 清理字符串
    const cleaned = dateStr.trim()

    // 格式 1: "2012年7月13日"
    const jpFormat = /(\d{4})年(\d{1,2})月(\d{1,2})日/
    const jpMatch = cleaned.match(jpFormat)
    if (jpMatch) {
      const [, year, month, day] = jpMatch
      const date = new Date(Number.parseInt(year), Number.parseInt(month) - 1, Number.parseInt(day))
      return Math.floor(date.getTime() / 1000)
    }

    // 格式 2: "2012年7月"（仅年月）
    const jpMonthFormat = /(\d{4})年(\d{1,2})月/
    const jpMonthMatch = cleaned.match(jpMonthFormat)
    if (jpMonthMatch) {
      const [, year, month] = jpMonthMatch
      const date = new Date(Number.parseInt(year), Number.parseInt(month) - 1, 1)
      return Math.floor(date.getTime() / 1000)
    }

    // 格式 3: "2012/07/13" 或 "2012-07-13"
    const isoFormat = /(\d{4})[/-](\d{1,2})[/-](\d{1,2})/
    const isoMatch = cleaned.match(isoFormat)
    if (isoMatch) {
      const [, year, month, day] = isoMatch
      const date = new Date(Number.parseInt(year), Number.parseInt(month) - 1, Number.parseInt(day))
      return Math.floor(date.getTime() / 1000)
    }

    // 格式 4: "2012年"（仅年份）
    const yearFormat = /(\d{4})年/
    const yearMatch = cleaned.match(yearFormat)
    if (yearMatch) {
      const [, year] = yearMatch
      const date = new Date(Number.parseInt(year), 0, 1)
      return Math.floor(date.getTime() / 1000)
    }

    // 无法解析
    return null
  }
  catch (error) {
    console.warn(`Failed to parse date: ${dateStr}`, error)
    return null
  }
}

/**
 * 清理 Wiki 标记语言，转换为纯文本
 * 处理：[[链接]]、**加粗**、*斜体* 等标记
 */
export function cleanWikiMarkup(text: string): string {
  if (!text)
    return ''

  return text
    // 移除 Wiki 链接: [[文本>URL]] -> 文本
    .replace(/\[\[([^>\]]+)>([^\]]+)\]\]/g, '$1')
    // 移除 Wiki 链接: [[文本]] -> 文本
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    // 移除加粗: **文本** -> 文本
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    // 移除斜体: *文本* -> 文本
    .replace(/\*([^*]+)\*/g, '$1')
    // 清理多余空白
    .trim()
}

/**
 * 提取社交链接
 */
export function extractSocialLinks($: CheerioAPI, $content: Cheerio<any>) {
  const result: {
    twitter?: string
    instagram?: string
    blog?: string
    socialLinks?: Record<string, string>
  } = {}
  const additionalLinks: Record<string, string> = {}

  // 遍历所有链接，查找社交媒体
  $content.find('a').each((_, el) => {
    const href = $(el).attr('href')

    if (!href)
      return

    // Twitter
    if (href.includes('twitter.com/')) {
      const match = href.match(/twitter\.com\/([^/?#]+)/)
      if (match) {
        result.twitter = `@${match[1]}`
      }
    }
    // Instagram
    else if (href.includes('instagram.com/')) {
      const match = href.match(/instagram\.com\/([^/?#]+)/)
      if (match) {
        result.instagram = match[1]
      }
    }
    // 博客（包含 blog、ameblo 等关键词）
    else if (href.includes('blog') || href.includes('ameblo') || href.includes('lineblog')) {
      result.blog = href
    }
    // YouTube
    else if (href.includes('youtube.com/') || href.includes('youtu.be/')) {
      additionalLinks.youtube = href
    }
    // TikTok
    else if (href.includes('tiktok.com/')) {
      additionalLinks.tiktok = href
    }
    // OnlyFans
    else if (href.includes('onlyfans.com/')) {
      additionalLinks.onlyfans = href
    }
  })

  // 如果有额外的社交链接，添加到 socialLinks
  if (Object.keys(additionalLinks).length > 0) {
    result.socialLinks = additionalLinks
  }

  return result
}

/**
 * 解析女优页面
 */
export function parseActorPage(
  $: CheerioAPI,
  html: string,
  wikiUrl: string,
): ParseResult<ActorDetails> {
  const errors: ParseError[] = []
  const warnings: string[] = []

  // 提取主名（页面标题）
  const title = $('#wiki-content h1, #wiki-content h2').first().text().trim()
  let name = title
  let reading: string | undefined

  // 如果标题包含读音（如"森沢かな（もりさわかな）"），分离主名和读音
  const readingMatch = title.match(/^([^（]+)（([^）]+)）$/)
  if (readingMatch) {
    name = readingMatch[1].trim()
    reading = readingMatch[2].trim()
  }

  // 提取别名
  const aliases: string[] = []
  const aliasText = $('#wiki-content')
    .find(':contains("別名")')
    .first()
    .parent()
    .text()
  if (aliasText && aliasText.includes('別名')) {
    const aliasMatch = aliasText.match(/別名[：:]\s*(.+)/)
    if (aliasMatch) {
      const aliasPart = aliasMatch[1]
      // 分割别名（使用、或、或=或／）
      const aliasArr = aliasPart.split(/[、，＝=／,]/).map(a => cleanWikiMarkup(a).trim()).filter(Boolean)
      aliases.push(...aliasArr)
    }
  }

  // 提取社交链接
  const socialLinks = extractSocialLinks($, $('#wiki-content'))

  // 提取生日
  let birthDate: number | undefined
  const birthText = $('#wiki-content')
    .find(':contains("生年月日")')
    .first()
    .parent()
    .text()
  if (birthText && birthText.includes('生年月日')) {
    const birthMatch = birthText.match(/生年月日[：:]\s*([^\n]+)/)
    if (birthMatch) {
      const parsed = parseJapaneseDate(birthMatch[1])
      if (parsed) {
        birthDate = parsed
      }
      else {
        warnings.push(`Failed to parse birth date: ${birthMatch[1]}`)
      }
    }
  }

  // 提取身高
  let height: number | undefined
  const heightText = $('#wiki-content')
    .find(':contains("身長")')
    .first()
    .parent()
    .text()
  if (heightText && heightText.includes('身長')) {
    const heightMatch = heightText.match(/身長[：:]\s*(\d+)/)
    if (heightMatch) {
      height = Number.parseInt(heightMatch[1], 10)
    }
  }

  // 提取三围
  let measurements: string | undefined
  const measurementsText = $('#wiki-content')
    .find(':contains("サイズ"), :contains("スリーサイズ")')
    .first()
    .parent()
    .text()
  if (measurementsText) {
    // 匹配格式: B88-W58-H85 或 88-58-85
    const measurementsMatch = measurementsText.match(/B?(\d)[-\s]*W?(\d)[-\s]*H?(\d)/)
    if (measurementsMatch) {
      const [, bust, waist, hip] = measurementsMatch
      measurements = `${bust}-${waist}-${hip}`
    }
  }

  // 提取罩杯
  let cupSize: string | undefined
  if (measurementsText) {
    const cupMatch = measurementsText.match(/([A-Z])カップ/)
    if (cupMatch) {
      cupSize = cupMatch[1]
    }
  }

  // 提取血型
  let bloodType: string | undefined
  const bloodText = $('#wiki-content')
    .find(':contains("血液型")')
    .first()
    .parent()
    .text()
  if (bloodText && bloodText.includes('血液型')) {
    const bloodMatch = bloodText.match(/血液型[：:]\s*([ABO]{1,2}±?)/)
    if (bloodMatch) {
      bloodType = bloodMatch[1]
    }
  }

  // 提取国籍/出身地
  let nationality: string | undefined
  const nationalityText = $('#wiki-content')
    .find(':contains("出身地"), :contains("国籍")')
    .first()
    .parent()
    .text()
  if (nationalityText) {
    const nationalityMatch = nationalityText.match(/(?:出身地|国籍)[：:]\s*([^\n]+)/)
    if (nationalityMatch) {
      nationality = cleanWikiMarkup(nationalityMatch[1]).trim()
    }
  }

  // 提取简介/个人资料（通常在"プロフィール"或页面开头）
  let bio: string | undefined
  const profileSection = $('#wiki-content')
    .find(':contains("プロフィール"), :contains("略歴")')
    .first()
    .parent()
  if (profileSection.length > 0) {
    // 提取该段落之后的文本，直到下一个标题
    const bioText = profileSection
      .nextAll('p, div')
      .first()
      .text()
      .trim()
    if (bioText && bioText.length > 10) {
      bio = cleanWikiMarkup(bioText).substring(0, 500) // 限制长度
    }
  }

  // 提取出道日期
  let debutDate: number | undefined
  const debutText = $('#wiki-content')
    .find(':contains("デビュー")')
    .first()
    .parent()
    .text()
  if (debutText) {
    const debutMatch = debutText.match(/デビュー[：:]\s*([^\n]+)/)
    if (debutMatch) {
      const parsed = parseJapaneseDate(debutMatch[1])
      if (parsed) {
        debutDate = parsed
      }
      else {
        errors.push({
          field: 'debutDate',
          reason: 'Failed to parse debut date',
          rawValue: debutMatch[1],
        })
      }
    }
  }

  // 提取引退日期
  let retireDate: number | undefined
  let isActive = true
  const retireText = $('#wiki-content')
    .find(':contains("引退")')
    .first()
    .parent()
    .text()
  if (retireText && retireText.includes('引退')) {
    const retireMatch = retireText.match(/引退[：:]\s*([^\n]+)/)
    if (retireMatch) {
      const parsed = parseJapaneseDate(retireMatch[1])
      if (parsed) {
        retireDate = parsed
        isActive = false
      }
      else {
        warnings.push(`Failed to parse retire date: ${retireMatch[1]}`)
      }
    }

    // 检查是否复出
    if (retireText.includes('復帰') || retireText.includes('再デビュー')) {
      isActive = true
      warnings.push('Actress has returned after retirement')
    }
  }

  // 提取作品列表（可选）
  const works: Work[] = []
  $('#wiki-content')
    .find('li')
    .each((_, el) => {
      const text = $(el).text().trim()
      // 匹配格式: YYYY/MM/DD 品番 [[作品名>FANZA_URL]]
      const workMatch = text.match(/(\d{4}\/\d{1,2}\/\d{1,2})\s+([A-Z0-9-]+)\s+(.+)/)
      if (workMatch) {
        const [, releaseDate, productCode, titlePart] = workMatch
        const fanzaLink = $(el).find('a[href*="fanza"]').attr('href')

        works.push({
          releaseDate,
          productCode,
          title: cleanWikiMarkup(titlePart),
          fanzaUrl: fanzaLink,
        })
      }
    })

  return {
    data: {
      name,
      reading,
      aliases,
      bio,
      birthDate,
      height,
      measurements,
      cupSize,
      bloodType,
      nationality,
      debutDate,
      retireDate,
      isActive,
      ...socialLinks,
      works: works.length > 0 ? works : undefined,
      wikiUrl,
    },
    errors,
    warnings,
  }
}

/**
 * 解析厂商页面
 */
export function parsePublisherPage(
  $: CheerioAPI,
  html: string,
  wikiUrl: string,
): ParseResult<PublisherDetails> {
  const errors: ParseError[] = []
  const warnings: string[] = []

  // 提取厂商名（页面标题）
  const title = $('#wiki-content h1, #wiki-content h2').first().text().trim()
  const name = title.replace(/\s+wiki$/i, '').trim()

  // 提取 Logo
  let logo: string | undefined
  const logoImg = $('#wiki-content img').first()
  if (logoImg.length > 0) {
    logo = logoImg.attr('src')
    // 如果是相对路径，转换为绝对路径
    if (logo && !logo.startsWith('http')) {
      logo = new URL(logo, 'https://seesaawiki.jp').href
    }
  }

  // 提取官网
  let website: string | undefined
  const websiteText = $('#wiki-content')
    .find(':contains("公式サイト"), :contains("公式")')
    .first()
    .parent()
    .text()
  if (websiteText) {
    const websiteMatch = websiteText.match(/公式[^:：]*[：:]\s*(https?:\/\/\S+)/i)
    if (websiteMatch) {
      website = websiteMatch[1]
    }
  }

  // 提取社交链接
  const socialLinks = extractSocialLinks($, $('#wiki-content'))

  // 提取简介
  let description: string | undefined
  const firstPara = $('#wiki-content p').first().text().trim()
  if (firstPara && firstPara.length > 10) {
    description = cleanWikiMarkup(firstPara).substring(0, 1000)
  }

  // 提取系列关系
  let parentPublisher: string | undefined
  let brandSeries: string | undefined

  const bodyText = $('#wiki-content').text()

  // 检测母公司（如 "KMP系1レーベル"）
  const parentMatch = bodyText.match(/([^、。\n]+)系\d*レーベル/)
  if (parentMatch) {
    parentPublisher = parentMatch[1].trim()
    brandSeries = `${parentMatch[1]}系列`
  }

  // 检测品牌系列标签
  if (bodyText.includes('Premium系列')) {
    brandSeries = brandSeries ? `${brandSeries},Premium系列` : 'Premium系列'
  }
  if (bodyText.includes('総合メーカー')) {
    brandSeries = brandSeries ? `${brandSeries},総合メーカー` : '総合メーカー'
  }

  return {
    data: {
      name,
      logo,
      website,
      description,
      ...socialLinks,
      parentPublisher,
      brandSeries,
      wikiUrl,
    },
    errors,
    warnings,
  }
}

/**
 * 解析索引页，提取女优列表
 */
export function parseActorIndexPage(
  $: CheerioAPI,
  _gojuonLine: string,
): ActorIndexEntry[] {
  const actors: ActorIndexEntry[] = []

  // 索引页使用 #wiki-content 容器，列表在 .list-1 类的 ul 中
  $('#wiki-content .list-1 > li').each((_, el) => {
    const text = $(el).text().trim()
    const link = $(el).find('a').first()
    const href = link.attr('href')

    // 跳过目录项和空项
    if (!text || !href || text === '目次')
      return

    // 解析别名格式: "名字A = 名字B = 名字C"
    const parts = text.split('=').map(p => cleanWikiMarkup(p).trim())
    const mainName = parts[0]
    const aliases = parts.slice(1)

    // 检查是否改名（使用 ⇒）
    let isRenamed = false
    if (text.includes('⇒')) {
      isRenamed = true
      // 格式: "旧名 ⇒ 现名"
      const renameParts = text.split('⇒').map(p => cleanWikiMarkup(p).trim())
      if (renameParts.length === 2) {
        actors.push({
          name: renameParts[1], // 现名作为主名
          aliases: [renameParts[0]], // 旧名作为别名
          wikiUrl: new URL(href, 'https://seesaawiki.jp').href,
          isRenamed: true,
        })
        return
      }
    }

    actors.push({
      name: mainName,
      aliases,
      wikiUrl: new URL(href, 'https://seesaawiki.jp').href,
      isRenamed,
    })
  })

  return actors
}
