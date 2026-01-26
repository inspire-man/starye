import fs from 'node:fs'
import path from 'node:path'
import { Window } from 'happy-dom'
import { describe, expect, it } from 'vitest'
import { parseMangaInfo } from '../src/strategies/site-92hm-parser'

describe('site92Hm Parser', () => {
  it('should parse manga info correctly from html', () => {
    // 1. Prepare HTML (Load Fixture)
    const html = fs.readFileSync(path.join(__dirname, 'fixtures/92hm-sample.html'), 'utf-8')

    // 2. Parse HTML using happy-dom (simulating what the strategy does)
    const window = new Window()
    const document = window.document
    document.write(html)

    // 3. Call Pure Parser
    // Note: We cast to `any` or `Document` because happy-dom types might slighty differ from standard DOM lib types
    // but at runtime they are compatible.
    const info = parseMangaInfo(document as unknown as Document, 'https://www.92hm.life/book/123')

    // 4. Assert
    expect(info.title).toBe('My Test Manga Title')
    expect(info.author).toBe('Test Author') // Logic now strips "Author:" prefix
    expect(info.cover).toBe('https://example.com/cover.jpg')
    expect(info.description).toContain('This is a test description')
    expect(info.status).toBe('serializing')

    expect(info.chapters).toHaveLength(2)
    expect(info.chapters[0].title).toBe('Chapter 2')
    expect(info.chapters[0].slug).toBe('2')

    window.close()
  })
})
