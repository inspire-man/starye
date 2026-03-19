import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ProgressMonitor } from '../progress'

describe('progressMonitor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('初始化', () => {
    it('应该使用配置的 maxMovies 值而非硬编码 100', () => {
      const monitor = new ProgressMonitor(200, false)

      expect((monitor as any).maxMovies).toBe(200)
    })

    it('应该支持不同的 maxMovies 值', () => {
      const monitor1 = new ProgressMonitor(50, false)
      const monitor2 = new ProgressMonitor(100, false)
      const monitor3 = new ProgressMonitor(500, false)

      expect((monitor1 as any).maxMovies).toBe(50)
      expect((monitor2 as any).maxMovies).toBe(100)
      expect((monitor3 as any).maxMovies).toBe(500)
    })

    it('应该正确初始化统计信息', () => {
      const monitor = new ProgressMonitor(200, false)
      const stats = monitor.getStats()

      expect(stats.moviesFound).toBe(0)
      expect(stats.moviesProcessed).toBe(0)
      expect(stats.moviesSuccess).toBe(0)
      expect(stats.moviesFailed).toBe(0)
      expect(stats.moviesSkippedExisting).toBe(0)
      expect(stats.imagesDownloaded).toBe(0)
      expect(stats.apiSynced).toBe(0)
      expect(stats.startTime).toBeGreaterThan(0)
    })
  })

  describe('增量统计', () => {
    it('应该正确累计跳过的已存在影片数量', () => {
      const monitor = new ProgressMonitor(200, false)

      monitor.incrementMoviesSkippedExisting(10)
      monitor.incrementMoviesSkippedExisting(5)
      monitor.incrementMoviesSkippedExisting(3)

      const stats = monitor.getStats()
      expect(stats.moviesSkippedExisting).toBe(18)
    })

    it('应该支持单次增量', () => {
      const monitor = new ProgressMonitor(200, false)

      monitor.incrementMoviesSkippedExisting()
      monitor.incrementMoviesSkippedExisting()

      const stats = monitor.getStats()
      expect(stats.moviesSkippedExisting).toBe(2)
    })

    it('应该正确计算增量命中率', () => {
      const monitor = new ProgressMonitor(200, false)

      monitor.incrementMoviesFound(100)
      monitor.incrementMoviesSkippedExisting(60)

      const stats = monitor.getStats()
      const incrementalHitRate = (stats.moviesSkippedExisting / stats.moviesFound) * 100

      expect(incrementalHitRate).toBe(60)
    })

    it('应该处理无增量命中的情况', () => {
      const monitor = new ProgressMonitor(200, false)

      monitor.incrementMoviesFound(100)
      monitor.incrementMoviesSkippedExisting(0)

      const stats = monitor.getStats()
      const incrementalHitRate = stats.moviesFound > 0
        ? (stats.moviesSkippedExisting / stats.moviesFound) * 100
        : 0

      expect(incrementalHitRate).toBe(0)
    })

    it('应该处理全部增量命中的情况', () => {
      const monitor = new ProgressMonitor(200, false)

      monitor.incrementMoviesFound(100)
      monitor.incrementMoviesSkippedExisting(100)

      const stats = monitor.getStats()
      const incrementalHitRate = (stats.moviesSkippedExisting / stats.moviesFound) * 100

      expect(incrementalHitRate).toBe(100)
    })
  })

  describe('统计输出', () => {
    it('printStats 应该包含增量统计信息', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const monitor = new ProgressMonitor(200, false)
      monitor.incrementMoviesFound(100)
      monitor.incrementMoviesSkippedExisting(60)
      monitor.incrementMoviesSuccess()

      monitor.printStats()

      // 验证输出包含增量统计
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('📈 爬虫统计:'))
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('已存在: 60'))
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('新增: 40'))

      consoleSpy.mockRestore()
    })

    it('printStats 应该正确显示增量命中率', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const monitor = new ProgressMonitor(200, false)
      monitor.incrementMoviesFound(100)
      monitor.incrementMoviesSkippedExisting(60)

      monitor.printStats()

      // 验证输出包含 60% 命中率
      const calls = consoleSpy.mock.calls.flat().join(' ')
      expect(calls).toContain('60.0%')

      consoleSpy.mockRestore()
    })
  })
})
