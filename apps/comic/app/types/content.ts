import type { Chapter, Comic, Page } from '@starye/db/schema'

export type { Chapter, Comic, Page }

export interface ComicWithChapters extends Comic {
  chapters: Pick<Chapter, 'title' | 'slug' | 'chapterNumber' | 'publishedAt'>[]
}

export interface ChapterWithComic extends Chapter {
  comic: Pick<Comic, 'slug' | 'title'>
}

export interface ChapterWithPages extends ChapterWithComic {
  pages: Page[]
  prevChapter?: { title: string, slug: string } | null
  nextChapter?: { title: string, slug: string } | null
  allChapters?: { title: string, slug: string }[]
}
