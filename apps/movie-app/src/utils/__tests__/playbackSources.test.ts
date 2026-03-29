import { describe, expect, it } from 'vitest'
import type { Player } from '../../types'
import {
  getQualityBadgeClass,
  getSourceTypeIcon,
  isMagnetLink,
  sortPlaybackSources,
} from '../playbackSources'

describe('playbackSources', () => {
  describe('sortPlaybackSources', () => {
    it('应该将磁力链接排在在线播放前面', () => {
      const sources: Player[] = [
        { id: '1', movieId: 'm1', sourceName: '在线播放', sourceUrl: 'https://example.com', quality: 'HD', sortOrder: 1 },
        { id: '2', movieId: 'm1', sourceName: '磁力链接', sourceUrl: 'magnet:?xt=urn:btih:abcd1234', quality: 'HD', sortOrder: 2 },
      ]

      const sorted = sortPlaybackSources(sources)

      expect(sorted[0].sourceName).toBe('磁力链接')
      expect(sorted[1].sourceName).toBe('在线播放')
    })

    it('应该按画质排序（4K > 1080P > 720P > SD）', () => {
      const sources: Player[] = [
        { id: '1', movieId: 'm1', sourceName: '磁力SD', sourceUrl: 'magnet:?xt=urn:btih:sd', quality: 'SD', sortOrder: 1 },
        { id: '2', movieId: 'm1', sourceName: '磁力4K', sourceUrl: 'magnet:?xt=urn:btih:4k', quality: '4K', sortOrder: 2 },
        { id: '3', movieId: 'm1', sourceName: '磁力HD', sourceUrl: 'magnet:?xt=urn:btih:hd', quality: 'HD', sortOrder: 3 },
        { id: '4', movieId: 'm1', sourceName: '磁力720P', sourceUrl: 'magnet:?xt=urn:btih:720p', quality: '720P', sortOrder: 4 },
      ]

      const sorted = sortPlaybackSources(sources)

      expect(sorted[0].quality).toBe('4K')
      expect(sorted[1].quality).toBe('HD')
      expect(sorted[2].quality).toBe('720P')
      expect(sorted[3].quality).toBe('SD')
    })

    it('应该在类型和画质相同时按 sortOrder 排序', () => {
      const sources: Player[] = [
        { id: '1', movieId: 'm1', sourceName: '磁力3', sourceUrl: 'magnet:?xt=urn:btih:c', quality: 'HD', sortOrder: 3 },
        { id: '2', movieId: 'm1', sourceName: '磁力1', sourceUrl: 'magnet:?xt=urn:btih:a', quality: 'HD', sortOrder: 1 },
        { id: '3', movieId: 'm1', sourceName: '磁力2', sourceUrl: 'magnet:?xt=urn:btih:b', quality: 'HD', sortOrder: 2 },
      ]

      const sorted = sortPlaybackSources(sources)

      expect(sorted[0].sortOrder).toBe(1)
      expect(sorted[1].sortOrder).toBe(2)
      expect(sorted[2].sortOrder).toBe(3)
    })

    it('不应该修改原数组', () => {
      const sources: Player[] = [
        { id: '1', movieId: 'm1', sourceName: 'A', sourceUrl: 'https://a.com', sortOrder: 2 },
        { id: '2', movieId: 'm1', sourceName: 'B', sourceUrl: 'https://b.com', sortOrder: 1 },
      ]

      const original = [...sources]
      sortPlaybackSources(sources)

      expect(sources).toEqual(original)
    })
  })

  describe('isMagnetLink', () => {
    it('应该正确识别磁力链接', () => {
      expect(isMagnetLink('magnet:?xt=urn:btih:abc123')).toBe(true)
      expect(isMagnetLink('magnet:test')).toBe(true)
    })

    it('应该正确识别非磁力链接', () => {
      expect(isMagnetLink('https://example.com')).toBe(false)
      expect(isMagnetLink('http://test.com')).toBe(false)
      expect(isMagnetLink('')).toBe(false)
    })
  })

  describe('getSourceTypeIcon', () => {
    it('应该为磁力链接返回磁铁图标', () => {
      const source: Player = {
        id: '1',
        movieId: 'm1',
        sourceName: '磁力',
        sourceUrl: 'magnet:?xt=urn:btih:abc',
        sortOrder: 1,
      }

      expect(getSourceTypeIcon(source)).toBe('🧲')
    })

    it('应该为在线播放返回播放图标', () => {
      const source: Player = {
        id: '1',
        movieId: 'm1',
        sourceName: '在线播放',
        sourceUrl: 'https://example.com',
        sortOrder: 1,
      }

      expect(getSourceTypeIcon(source)).toBe('▶️')
    })

    it('应该为其他类型返回默认图标', () => {
      const source: Player = {
        id: '1',
        movieId: 'm1',
        sourceName: '其他',
        sourceUrl: 'https://other.com',
        sortOrder: 1,
      }

      expect(getSourceTypeIcon(source)).toBe('📺')
    })
  })

  describe('getQualityBadgeClass', () => {
    it('应该为4K返回紫色样式', () => {
      expect(getQualityBadgeClass('4K')).toBe('bg-purple-600 text-white')
      expect(getQualityBadgeClass('UHD')).toBe('bg-purple-600 text-white')
    })

    it('应该为HD/1080P返回绿色样式', () => {
      expect(getQualityBadgeClass('HD')).toBe('bg-green-600 text-white')
      expect(getQualityBadgeClass('1080P')).toBe('bg-green-600 text-white')
      expect(getQualityBadgeClass('FHD')).toBe('bg-green-600 text-white')
    })

    it('应该为SD/720P返回灰色样式', () => {
      expect(getQualityBadgeClass('SD')).toBe('bg-gray-500 text-white')
      expect(getQualityBadgeClass('720P')).toBe('bg-gray-500 text-white')
    })

    it('应该为未知画质返回蓝色样式', () => {
      expect(getQualityBadgeClass('UNKNOWN')).toBe('bg-blue-600 text-white')
    })

    it('应该为空画质返回灰色样式', () => {
      expect(getQualityBadgeClass()).toBe('bg-gray-600 text-gray-300')
      expect(getQualityBadgeClass('')).toBe('bg-gray-600 text-gray-300')
    })
  })
})
