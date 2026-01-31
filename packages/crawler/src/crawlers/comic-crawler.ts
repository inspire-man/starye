/* eslint-disable no-console */
import type { Page } from 'puppeteer-core'
import type { CrawlerConfig } from '../lib/base-crawler'
import type { CrawlStrategy } from '../lib/strategy'
import { BaseCrawler } from '../lib/base-crawler'

export class ComicCrawler extends BaseCrawler {
  constructor(
    config: CrawlerConfig,
    private strategy: CrawlStrategy,
    private startUrl: string,
  ) {
    super(config)
  }

  async run() {
    await this.initBrowser()
    const page = await this.createPage()

    try {
      console.log(`🚀 Starting crawl for: ${this.startUrl}`)
      await this.processUrl(this.startUrl, page)
    }
    catch (error) {
      console.error('❌ Crawl failed:', error)
    }
    finally {
      await this.closeBrowser()
    }
  }

  private async processUrl(url: string, page: Page) {
    // 1. Determine if it's a list page or detail page
    let currentUrl = url
    let hasNextPage = true
    let pageCount = 1

    while (hasNextPage) {
      console.log(`
📄 Processing List Page ${pageCount}: ${currentUrl}`)

      // Check if strategy implements getMangaList
      if (!this.strategy.getMangaList) {
        console.warn('⚠️ Strategy does not support list parsing. Treating as detail page.')
        await this.processManga(currentUrl, page)
        break
      }

      const { mangas, next } = await this.strategy.getMangaList(currentUrl, page)

      console.log(`✅ Found ${mangas.length} mangas on page ${pageCount}`)

      for (const mangaUrl of mangas) {
        try {
          await this.processManga(mangaUrl, page)
        }
        catch (e) {
          console.error(`❌ Failed to process manga ${mangaUrl}:`, e)
        }
      }

      if (next && next !== currentUrl) {
        currentUrl = next
        pageCount++
      }
      else {
        hasNextPage = false
        console.log('✅ Reached end of list')
      }
    }
  }

  private async processManga(url: string, page: Page) {
    console.log(`
📘 Processing Manga: ${url}`)
    const info = await this.strategy.getMangaInfo(url, page)

    // 1. Download Cover
    if (info.cover) {
      try {
        const coverImages = await this.imageProcessor.process(
          info.cover,
          `comics/${info.slug}`,
          'cover',
        )
        const preview = coverImages.find(i => i.variant === 'preview')
        if (preview) {
          info.cover = preview.url
        }
      }
      catch (e) {
        console.warn(`⚠️ Failed to download cover for ${info.title}:`, e)
      }
    }

    // 2. Sync Metadata
    await this.syncToApi('/api/admin/sync', {
      type: 'manga',
      data: {
        ...info,
        chapters: info.chapters.map(c => ({
          title: c.title,
          slug: c.slug,
          number: c.number,
          url: c.url,
        })),
      },
    })

    // 3. Check Existing Chapters to skip
    let existingChapters: string[] = []
    try {
      const res = await this.syncToApi(
        `/api/admin/comics/${info.slug}/existing-chapters`,
        null,
        { method: 'GET' },
      ) as string[] | null

      if (res && Array.isArray(res)) {
        existingChapters = res
      }
    }
    catch {
      console.warn('⚠️ Failed to fetch existing chapters, syncing all.')
    }

    // 4. Process Chapters
    for (const chapter of info.chapters) {
      if (existingChapters.includes(chapter.slug)) {
        console.log(`⏩ Skipping existing chapter: ${chapter.title}`)
        continue
      }

      console.log(`📖 Processing Chapter: ${chapter.title}`)
      try {
        const content = await this.strategy.getChapterContent(chapter.url, page)

        // Upload images
        const imageUrls: string[] = []
        for (let i = 0; i < content.images.length; i++) {
          const rawUrl = content.images[i]
          try {
            const processed = await this.imageProcessor.process(
              rawUrl,
              `comics/${info.slug}/${chapter.slug}`,
              String(i + 1).padStart(3, '0'),
            )

            const targetVariant = processed.find(p => p.variant === 'original') || processed[0]
            if (targetVariant) {
              imageUrls.push(targetVariant.url)
            }
          }
          catch {
            console.warn(`⚠️ Failed to process image ${i + 1} for chapter ${chapter.title}`)
            imageUrls.push('https://placehold.co/800x1200?text=Image+Load+Failed')
          }
        }

        // Sync Chapter Pages
        await this.syncToApi('/api/admin/sync', {
          type: 'chapter',
          data: {
            title: content.title,
            comicSlug: info.slug,
            chapterSlug: chapter.slug,
            images: imageUrls,
          },
        })
      }
      catch (e) {
        console.error(`❌ Failed to process chapter ${chapter.title}:`, e)
      }
    }
  }
}
