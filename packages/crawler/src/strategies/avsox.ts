import type { Page } from 'puppeteer-core'
import type { MovieCrawlStrategy, MovieInfo } from '../lib/strategy'
import * as cheerio from 'cheerio'

export class AvSoxStrategy implements MovieCrawlStrategy {
  name = 'avsox'
  baseUrl = 'https://avsox.click'

  match(url: string): boolean {
    return url.includes('avsox')
  }

  async getMovieList(url: string, page: Page): Promise<{ movies: string[], next?: string }> {
    await page.goto(url, { waitUntil: 'domcontentloaded' })
    const html = await page.content()
    const $ = cheerio.load(html)

    const movies: string[] = []
    $('#waterfall a.movie-box').each((_, el) => {
      let href = $(el).attr('href')
      if (href) {
        if (href.startsWith('//')) {
          href = `https:${href}`
        }
        else if (href.startsWith('/')) {
          href = `${this.baseUrl}${href}`
        }
        movies.push(href)
      }
    })

    // AvSox pagination usually looks like <a class="pagination-next" href="...">
    // Or check specific structure.
    // Based on common templates (JavBus like), it might be different.
    // Python script didn't show list parsing logic, only search.
    // I'll assume standard pagination or check later.
    // Commonly .pagination .next or similar.
    let next = $('.pagination a#next').attr('href') || $('.pagination a[rel="next"]').attr('href')

    if (next) {
      if (next.startsWith('//')) {
        next = `https:${next}`
      }
      else if (next.startsWith('/')) {
        next = `${this.baseUrl}${next}`
      }
    }

    return { movies, next }
  }

  async getMovieInfo(url: string, page: Page): Promise<MovieInfo> {
    await page.goto(url, { waitUntil: 'domcontentloaded' })
    const html = await page.content()
    const $ = cheerio.load(html)

    const title = $('h3').first().text().trim()
    let cover = $('.bigImage').attr('href') || ''
    if (cover) {
      if (cover.startsWith('//')) {
        cover = `https:${cover}`
      }
      else if (cover.startsWith('/')) {
        cover = `${this.baseUrl}${cover}`
      }
    }

    // Parse Info Block
    const infoBlock = $('.info')
    let code = ''
    let releaseDate = 0
    let duration = 0
    let publisher = ''
    let series = ''

    infoBlock.find('p').each((_, el) => {
      const text = $(el).text()
      if (text.includes('识别码:')) {
        code = $(el).find('span[style]').text().trim()
      }
      else if (text.includes('发行时间:')) {
        const dateStr = $(el).text().replace('发行时间:', '').trim()
        releaseDate = new Date(dateStr).getTime() / 1000
      }
      else if (text.includes('长度:')) {
        const lenStr = $(el).text().replace('长度:', '').replace('分钟', '').trim()
        duration = Number.parseInt(lenStr, 10) || 0
      }
      else if (text.includes('制作商:') || text.includes('发行商:')) {
        publisher = $(el).find('a').text().trim()
      }
      else if (text.includes('系列:')) {
        series = $(el).find('a').text().trim()
      }
    })

    const genres = $('.genre a').map((_, el) => $(el).text().trim()).get()
    const actors = $('.avatar-box span').map((_, el) => $(el).text().trim()).get()

    // Magnet links? AvSox usually aggregates them.
    // Python script didn't extract magnets in the snippet I read, but typically they are in #magnet-table
    // For now I'll skip players/magnets or add if I see structure.
    // Python 'javdb.py' extracted magnets. 'avsox.py' didn't show it in `parse_data`.
    // Wait, `avsox.py` Logic:
    // It extracts basic info.

    // I'll add players if magnets exist
    const players: MovieInfo['players'] = []
    $('#magnet-table tr').each((_, el) => {
      const magnet = $(el).find('a[href^="magnet:"]').attr('href')
      const meta = $(el).find('td').eq(1).text().trim() // Size, Date
      if (magnet) {
        players.push({
          sourceName: 'Magnet',
          sourceUrl: magnet,
          quality: meta,
          sortOrder: 0,
        })
      }
    })

    return {
      title,
      slug: code || url.split('/').pop() || '',
      code,
      coverImage: cover,
      description: '', // AvSox doesn't usually have long desc?
      releaseDate,
      duration,
      sourceUrl: url,
      isR18: true,
      publisher,
      series,
      genres,
      actors,
      players,
    }
  }
}
