import { describe, expect, it } from 'vitest'
import {
  assertAllowedCrawlerImageTarget,
  buildApprovedCrawlerPrefix,
} from '../src/lib/image-processor'

describe('image processor purpose policy', () => {
  it('允许 movie/comic cover namespace', () => {
    expect(buildApprovedCrawlerPrefix({
      imageUrl: 'https://img.example.com/movie-cover.jpg',
      purpose: 'cover',
      keyNamespace: 'movies/SONE-001',
      filename: 'cover',
    })).toBe('movies/SONE-001')

    expect(buildApprovedCrawlerPrefix({
      imageUrl: 'https://img.example.com/comic-cover.jpg',
      purpose: 'cover',
      keyNamespace: 'comics/demo-slug',
      filename: 'cover',
    })).toBe('comics/demo-slug')
  })

  it('允许 actor avatar namespace', () => {
    expect(buildApprovedCrawlerPrefix({
      imageUrl: 'https://img.example.com/avatar.jpg',
      purpose: 'avatar',
      keyNamespace: 'actors/actor-123',
      filename: 'avatar',
    })).toBe('actors/actor-123')
  })

  it('允许 publisher logo namespace', () => {
    expect(buildApprovedCrawlerPrefix({
      imageUrl: 'https://img.example.com/logo.jpg',
      purpose: 'logo',
      keyNamespace: 'publishers/publisher-123',
      filename: 'logo',
    })).toBe('publishers/publisher-123')
  })

  it('标准化前后斜杠后再做 namespace 校验', () => {
    expect(buildApprovedCrawlerPrefix({
      imageUrl: 'https://img.example.com/avatar.jpg',
      purpose: 'avatar',
      keyNamespace: '/actors/actor-123/',
      filename: 'avatar',
    })).toBe('actors/actor-123')
  })

  it('拒绝 chapter-like cover namespace', () => {
    expect(() => assertAllowedCrawlerImageTarget({
      imageUrl: 'https://img.example.com/page-1.jpg',
      purpose: 'cover',
      keyNamespace: 'comics/demo-slug/chapter-1',
      filename: '001',
    })).toThrow('Unsupported cover namespace: comics/demo-slug/chapter-1. Allowed namespaces: movies/<code>, comics/<slug>')
  })

  it('拒绝 generic images namespace', () => {
    expect(() => assertAllowedCrawlerImageTarget({
      imageUrl: 'https://img.example.com/manual.jpg',
      purpose: 'cover',
      keyNamespace: 'images/manual',
      filename: 'cover',
    })).toThrow('Unsupported cover namespace: images/manual. Allowed namespaces: movies/<code>, comics/<slug>')
  })

  it('拒绝显式 comic_chapter_page intent', () => {
    expect(() => assertAllowedCrawlerImageTarget({
      imageUrl: 'https://img.example.com/page-1.jpg',
      purpose: 'comic_chapter_page',
      keyNamespace: 'comics/demo-slug/chapter-1',
      filename: '001',
    })).toThrow('comic_chapter_page uploads are forbidden; chapter pages must stay on source URLs')
  })
})
