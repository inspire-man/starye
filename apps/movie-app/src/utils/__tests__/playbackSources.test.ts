import type { Player } from '../../types'
import { describe, expect, it } from 'vitest'
import {
  buildPlaybackRoute,
  classifyPlaybackSource,
  getQualityBadgeClass,
  getSourceTypeIcon,
  groupPlaybackSources,
  isEligiblePlaybackSource,
  isMagnetLink,
  selectControlledPlaybackSource,
  selectDirectPlaybackSource,
  sortPlaybackSources,
} from '../playbackSources'

describe('playbackSources', () => {
  describe('source policy', () => {
    it('应只将 active 且包含非空 URL 的来源视为 eligible', () => {
      expect(isEligiblePlaybackSource({ isActive: true, sourceUrl: 'https://direct.example/video' })).toBe(true)
      expect(isEligiblePlaybackSource({ isActive: true, sourceUrl: 'magnet:?xt=urn:btih:active' })).toBe(true)
      expect(isEligiblePlaybackSource({ isActive: false, sourceUrl: 'https://inactive.example/video' })).toBe(false)
      expect(isEligiblePlaybackSource({ isActive: true, sourceUrl: '   ' })).toBe(false)
      expect(isEligiblePlaybackSource({ isActive: true, sourceUrl: undefined })).toBe(false)
    })

    it('应优先使用 TorrServer 标记并识别磁力与其他 direct URL', () => {
      expect(classifyPlaybackSource({ source: 'TorrServer', sourceUrl: 'https://server.example/stream' })).toBe('TorrServer')
      expect(classifyPlaybackSource({ sourceUrl: ' magnet:?xt=urn:btih:active ' })).toBe('magnet')
      expect(classifyPlaybackSource({ source: 'direct', sourceUrl: 'https://direct.example/video' })).toBe('direct')
    })

    it('应按 eligible direct、eligible magnet、inactive/ineligible 分组并保留服务端顺序', () => {
      const sources: Player[] = [
        { id: 'magnet-1', movieId: 'm1', sourceName: '磁力 1', sourceUrl: 'magnet:?xt=urn:btih:one', isActive: true, sortOrder: 9 },
        { id: 'inactive-direct', movieId: 'm1', sourceName: '失效直连', sourceUrl: 'https://inactive.example/video', isActive: false, sortOrder: 1 },
        { id: 'direct-1', movieId: 'm1', sourceName: '直连 1', sourceUrl: 'https://direct.example/one', isActive: true, sortOrder: 8 },
        { id: 'blank', movieId: 'm1', sourceName: '空地址', sourceUrl: ' ', isActive: true, sortOrder: 2 },
        { id: 'direct-2', movieId: 'm1', sourceName: '直连 2', sourceUrl: 'https://direct.example/two', isActive: true, sortOrder: 7 },
        { id: 'magnet-2', movieId: 'm1', sourceName: '磁力 2', sourceUrl: 'magnet:?xt=urn:btih:two', isActive: true, sortOrder: 6 },
      ]

      const groups = groupPlaybackSources(sources)

      expect(groups.eligibleDirect.map(source => source.id)).toEqual(['direct-1', 'direct-2'])
      expect(groups.eligibleMagnet.map(source => source.id)).toEqual(['magnet-1', 'magnet-2'])
      expect(groups.ineligible.map(source => source.id)).toEqual(['inactive-direct', 'blank'])
      expect(sortPlaybackSources(sources).map(source => source.id)).toEqual([
        'direct-1',
        'direct-2',
        'magnet-1',
        'magnet-2',
        'inactive-direct',
        'blank',
      ])
    })

    it('评分、画质和最新排序只能影响组内展示，不能改变默认 direct 候选', () => {
      const sources: Player[] = [
        { id: 'direct-low', movieId: 'm1', sourceName: '低分直连', sourceUrl: 'https://direct.example/low', isActive: true, quality: 'SD', averageRating: 1, sortOrder: 2 },
        { id: 'magnet-high', movieId: 'm1', sourceName: '高分磁力', sourceUrl: 'magnet:?xt=urn:btih:high', isActive: true, quality: '4K', averageRating: 5, sortOrder: 1 },
        { id: 'direct-high', movieId: 'm1', sourceName: '高分直连', sourceUrl: 'https://direct.example/high', isActive: true, quality: '4K', averageRating: 5, sortOrder: 3 },
        { id: 'inactive-best', movieId: 'm1', sourceName: '失效高分', sourceUrl: 'https://inactive.example/video', isActive: false, quality: '4K', averageRating: 5, sortOrder: 0 },
      ]

      expect(selectDirectPlaybackSource(sources)?.id).toBe('direct-low')
      expect(sortPlaybackSources(sources, 'rating').map(source => source.id)).toEqual([
        'direct-high',
        'direct-low',
        'magnet-high',
        'inactive-best',
      ])
      expect(sortPlaybackSources(sources, 'quality').map(source => source.id)).toEqual([
        'direct-high',
        'direct-low',
        'magnet-high',
        'inactive-best',
      ])
      expect(sortPlaybackSources(sources, 'latest').map(source => source.id)).toEqual([
        'direct-low',
        'direct-high',
        'magnet-high',
        'inactive-best',
      ])
    })

    it('direct 缺失时才选择第一个受控 magnet/TorrServer 候选', () => {
      const sources: Player[] = [
        { id: 'inactive-direct', movieId: 'm1', sourceName: '失效直连', sourceUrl: 'https://inactive.example/video', isActive: false, sortOrder: 1 },
        { id: 'magnet-fallback', movieId: 'm1', sourceName: '磁力回退', sourceUrl: 'magnet:?xt=urn:btih:fallback', isActive: true, sortOrder: 2 },
        { id: 'torrserver-fallback', movieId: 'm1', sourceName: '受控流回退', source: 'TorrServer', sourceUrl: 'https://controlled.example/stream', isActive: true, sortOrder: 3 },
      ]

      expect(selectDirectPlaybackSource(sources)).toBeNull()
      expect(selectControlledPlaybackSource(sources)?.id).toBe('magnet-fallback')
    })

    it('播放路由只携带 bounded tuple/context，不携带原始 source URL', () => {
      const route = buildPlaybackRoute('MOVIE-001', {
        playerId: 'direct-1',
        contentId: 'content-1',
        sourceRevision: 7,
        sourceType: 'direct',
        taskId: 'task-1',
        runId: 'run-1',
        attemptNumber: 2,
        provider: 'github-actions',
      })

      expect(route).toBe('/movie/MOVIE-001/play?player=direct-1&contentId=content-1&sourceRevision=7&sourceType=direct&taskId=task-1&runId=run-1&attemptNumber=2&provider=github-actions')
      expect(route).not.toContain('sourceUrl')
      expect(route).not.toContain('magnet:')
    })
  })

  describe('sortPlaybackSources', () => {
    it('默认应将 eligible direct 排在 eligible magnet 前面', () => {
      const sources: Player[] = [
        { id: '1', movieId: 'm1', sourceName: '在线播放', sourceUrl: 'https://example.com', isActive: true, quality: 'HD', sortOrder: 1 },
        { id: '2', movieId: 'm1', sourceName: '磁力链接', sourceUrl: 'magnet:?xt=urn:btih:abcd1234', isActive: true, quality: 'HD', sortOrder: 2 },
      ]

      const sorted = sortPlaybackSources(sources)

      expect(sorted[0].sourceName).toBe('在线播放')
      expect(sorted[1].sourceName).toBe('磁力链接')
    })

    it('应该按画质排序（4K > 1080P > 720P > SD）', () => {
      const sources: Player[] = [
        { id: '1', movieId: 'm1', sourceName: '磁力SD', sourceUrl: 'magnet:?xt=urn:btih:sd', isActive: true, quality: 'SD', sortOrder: 1 },
        { id: '2', movieId: 'm1', sourceName: '磁力4K', sourceUrl: 'magnet:?xt=urn:btih:4k', isActive: true, quality: '4K', sortOrder: 2 },
        { id: '3', movieId: 'm1', sourceName: '磁力HD', sourceUrl: 'magnet:?xt=urn:btih:hd', isActive: true, quality: 'HD', sortOrder: 3 },
        { id: '4', movieId: 'm1', sourceName: '磁力720P', sourceUrl: 'magnet:?xt=urn:btih:720p', isActive: true, quality: '720P', sortOrder: 4 },
      ]

      const sorted = sortPlaybackSources(sources, 'quality')

      expect(sorted[0].quality).toBe('4K')
      expect(sorted[1].quality).toBe('HD')
      expect(sorted[2].quality).toBe('720P')
      expect(sorted[3].quality).toBe('SD')
    })

    it('默认组内相同时应保留服务端数组顺序', () => {
      const sources: Player[] = [
        { id: '1', movieId: 'm1', sourceName: '磁力3', sourceUrl: 'magnet:?xt=urn:btih:c', quality: 'HD', sortOrder: 3 },
        { id: '2', movieId: 'm1', sourceName: '磁力1', sourceUrl: 'magnet:?xt=urn:btih:a', quality: 'HD', sortOrder: 1 },
        { id: '3', movieId: 'm1', sourceName: '磁力2', sourceUrl: 'magnet:?xt=urn:btih:b', quality: 'HD', sortOrder: 2 },
      ]

      const sorted = sortPlaybackSources(sources)

      expect(sorted.map(source => source.sortOrder)).toEqual([3, 1, 2])
    })

    it('不应该修改原数组', () => {
      const sources: Player[] = [
        { id: '1', movieId: 'm1', sourceName: 'A', sourceUrl: 'https://a.com', isActive: true, sortOrder: 2 },
        { id: '2', movieId: 'm1', sourceName: 'B', sourceUrl: 'https://b.com', isActive: true, sortOrder: 1 },
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
