import { describe, expect, it } from 'vitest'
import {
  buildManualUploadObjectKey,
  classifyStorageUrlKind,
  resolveCrawlerManagedAssetPrefix,
} from './storage-purpose-policy'

describe('buildManualUploadObjectKey', () => {
  it('preserves manual upload key shapes', () => {
    expect(buildManualUploadObjectKey('cover', '.png', 1720000000000, 'cover-id')).toBe('covers/manual/1720000000000-cover-id.png')
    expect(buildManualUploadObjectKey('blog_inline', '.webp', 1720000000001, 'inline-id')).toBe('manual-assets/blog-inline/1720000000001-inline-id.webp')
    expect(buildManualUploadObjectKey('manual_asset', '.jpg', 1720000000002, 'asset-id')).toBe('manual-assets/uploads/1720000000002-asset-id.jpg')
  })
})

describe('resolveCrawlerManagedAssetPrefix', () => {
  it('allows supported crawler namespaces', () => {
    expect(resolveCrawlerManagedAssetPrefix('cover', 'movies/SONE-001')).toBe('movies/SONE-001')
    expect(resolveCrawlerManagedAssetPrefix('cover', '/comics/demo-slug/')).toBe('comics/demo-slug')
    expect(resolveCrawlerManagedAssetPrefix('avatar', 'actors/actor-123')).toBe('actors/actor-123')
    expect(resolveCrawlerManagedAssetPrefix('logo', 'publishers/publisher-123')).toBe('publishers/publisher-123')
  })

  it('rejects chapter-like cover namespaces', () => {
    expect(() => resolveCrawlerManagedAssetPrefix('cover', 'comics/demo-slug/chapter-1')).toThrow('Unsupported cover namespace: comics/demo-slug/chapter-1. Allowed namespaces: movies/<code>, comics/<slug>')
  })
})

describe('classifyStorageUrlKind', () => {
  it('distinguishes managed, external, missing, and invalid URLs', () => {
    expect(classifyStorageUrlKind('https://cdn.example.com/covers/manual/1720000000000-cover-id.png', 'https://cdn.example.com/')).toBe('managed')
    expect(classifyStorageUrlKind('https://images.example.com/posters/demo.jpg', 'https://cdn.example.com')).toBe('external')
    expect(classifyStorageUrlKind('', 'https://cdn.example.com')).toBe('missing')
    expect(classifyStorageUrlKind('not-a-url', 'https://cdn.example.com')).toBe('invalid')
  })
})
