import { describe, expect, it } from 'vitest'
import {
  buildManualUploadObjectKey,
  classifyStorageUrlKind,
  resolveCrawlerManagedAssetPrefix,
} from './storage-purpose-policy'

describe('buildManualUploadObjectKey', () => {
  it('保留 manual upload key 形状不变', () => {
    expect(buildManualUploadObjectKey('cover', '.png', 1720000000000, 'cover-id')).toBe(
      'covers/manual/1720000000000-cover-id.png',
    )
    expect(buildManualUploadObjectKey('blog_inline', '.webp', 1720000000001, 'inline-id')).toBe(
      'manual-assets/blog-inline/1720000000001-inline-id.webp',
    )
    expect(buildManualUploadObjectKey('manual_asset', '.jpg', 1720000000002, 'asset-id')).toBe(
      'manual-assets/uploads/1720000000002-asset-id.jpg',
    )
  })
})

describe('resolveCrawlerManagedAssetPrefix', () => {
  it('允许 movie/comic cover namespace', () => {
    expect(resolveCrawlerManagedAssetPrefix('cover', 'movies/SONE-001')).toBe('movies/SONE-001')
    expect(resolveCrawlerManagedAssetPrefix('cover', '/comics/demo-slug/')).toBe('comics/demo-slug')
  })

  it('允许 actor avatar 和 publisher logo namespace', () => {
    expect(resolveCrawlerManagedAssetPrefix('avatar', 'actors/actor-123')).toBe('actors/actor-123')
    expect(resolveCrawlerManagedAssetPrefix('logo', 'publishers/publisher-123')).toBe('publishers/publisher-123')
  })

  it('拒绝 chapter-like namespace', () => {
    expect(() => resolveCrawlerManagedAssetPrefix('cover', 'comics/demo-slug/chapter-1')).toThrow(
      'Unsupported cover namespace: comics/demo-slug/chapter-1. Allowed namespaces: movies/<code>, comics/<slug>',
    )
  })
})

describe('classifyStorageUrlKind', () => {
  it('识别 managed R2 URL', () => {
    expect(
      classifyStorageUrlKind(
        'https://cdn.example.com/covers/manual/1720000000000-cover-id.png',
        'https://cdn.example.com/',
      ),
    ).toBe('managed')
  })

  it('识别合法 external URL', () => {
    expect(
      classifyStorageUrlKind(
        'https://images.example.com/posters/demo.jpg',
        'https://cdn.example.com',
      ),
    ).toBe('external')
  })

  it('区分 missing 和 invalid URL', () => {
    expect(classifyStorageUrlKind('', 'https://cdn.example.com')).toBe('missing')
    expect(classifyStorageUrlKind('not-a-url', 'https://cdn.example.com')).toBe('invalid')
  })
})
