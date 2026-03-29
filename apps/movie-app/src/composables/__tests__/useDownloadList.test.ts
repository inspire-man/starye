import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MovieDetail } from '../../types'
import { useDownloadList } from '../useDownloadList'

describe('useDownloadList', () => {
  // Mock localStorage
  const localStorageMock = (() => {
    let store: Record<string, string> = {}

    return {
      getItem: vi.fn((key: string) => store[key] || null),
      setItem: vi.fn((key: string, value: string) => {
        store[key] = value
      }),
      removeItem: vi.fn((key: string) => {
        delete store[key]
      }),
      clear: vi.fn(() => {
        store = {}
      }),
    }
  })()

  beforeEach(() => {
    // 重置 localStorage
    localStorageMock.clear()
    localStorageMock.getItem.mockClear()
    localStorageMock.setItem.mockClear()

    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true,
    })
  })

  describe('addToDownloadList', () => {
    it('应该成功添加影片到列表', () => {
      const { addToDownloadList, isInDownloadList } = useDownloadList()

      const mockMovie: MovieDetail = {
        id: 'm1',
        code: 'TEST-001',
        title: '测试影片',
        slug: 'test-movie',
        coverImage: 'cover.jpg',
        isR18: false,
        sourceUrl: 'https://source.com',
        createdAt: new Date(),
        updatedAt: new Date(),
        players: [],
        relatedMovies: [],
      }

      const result = addToDownloadList(mockMovie)

      expect(result).toBe(true)
      expect(isInDownloadList('m1')).toBe(true)
      expect(localStorageMock.setItem).toHaveBeenCalled()
    })

    it('应该保存磁链信息', () => {
      const { addToDownloadList, getDownloadList } = useDownloadList()

      const mockMovie: MovieDetail = {
        id: 'm1',
        code: 'TEST-001',
        title: '测试影片',
        slug: 'test-movie',
        isR18: false,
        sourceUrl: 'https://source.com',
        createdAt: new Date(),
        updatedAt: new Date(),
        players: [],
        relatedMovies: [],
      }

      addToDownloadList(mockMovie, 'magnet:?xt=urn:btih:abc123')

      const list = getDownloadList()
      expect(list[0].magnetLink).toBe('magnet:?xt=urn:btih:abc123')
    })

    it('应该拒绝重复添加', () => {
      const { addToDownloadList } = useDownloadList()

      const mockMovie: MovieDetail = {
        id: 'm1',
        code: 'TEST-001',
        title: '测试影片',
        slug: 'test-movie',
        isR18: false,
        sourceUrl: 'https://source.com',
        createdAt: new Date(),
        updatedAt: new Date(),
        players: [],
        relatedMovies: [],
      }

      addToDownloadList(mockMovie)

      expect(() => addToDownloadList(mockMovie)).toThrow('该影片已在下载列表中')
    })

    it('应该限制最多100个影片', () => {
      const { addToDownloadList } = useDownloadList()

      // 添加100个影片
      for (let i = 0; i < 100; i++) {
        const mockMovie: MovieDetail = {
          id: `m${i}`,
          code: `TEST-${i}`,
          title: `影片${i}`,
          slug: `movie-${i}`,
          isR18: false,
          sourceUrl: 'https://source.com',
          createdAt: new Date(),
          updatedAt: new Date(),
          players: [],
          relatedMovies: [],
        }
        addToDownloadList(mockMovie)
      }

      // 尝试添加第101个
      const extraMovie: MovieDetail = {
        id: 'm101',
        code: 'TEST-101',
        title: '影片101',
        slug: 'movie-101',
        isR18: false,
        sourceUrl: 'https://source.com',
        createdAt: new Date(),
        updatedAt: new Date(),
        players: [],
        relatedMovies: [],
      }

      expect(() => addToDownloadList(extraMovie)).toThrow(/下载列表已满/)
    })
  })

  describe('removeFromDownloadList', () => {
    it('应该成功移除影片', () => {
      const { addToDownloadList, removeFromDownloadList, isInDownloadList } = useDownloadList()

      const mockMovie: MovieDetail = {
        id: 'm1',
        code: 'TEST-001',
        title: '测试影片',
        slug: 'test-movie',
        isR18: false,
        sourceUrl: 'https://source.com',
        createdAt: new Date(),
        updatedAt: new Date(),
        players: [],
        relatedMovies: [],
      }

      addToDownloadList(mockMovie)
      expect(isInDownloadList('m1')).toBe(true)

      const result = removeFromDownloadList('m1')

      expect(result).toBe(true)
      expect(isInDownloadList('m1')).toBe(false)
    })

    it('移除不存在的影片应该返回 false', () => {
      const { removeFromDownloadList } = useDownloadList()

      const result = removeFromDownloadList('non-existent')

      expect(result).toBe(false)
    })
  })

  describe('updateDownloadStatus', () => {
    it('应该成功更新下载状态', () => {
      const { addToDownloadList, updateDownloadStatus, getDownloadList } = useDownloadList()

      const mockMovie: MovieDetail = {
        id: 'm1',
        code: 'TEST-001',
        title: '测试影片',
        slug: 'test-movie',
        isR18: false,
        sourceUrl: 'https://source.com',
        createdAt: new Date(),
        updatedAt: new Date(),
        players: [],
        relatedMovies: [],
      }

      addToDownloadList(mockMovie)

      const result = updateDownloadStatus('m1', 'downloading')
      expect(result).toBe(true)

      const list = getDownloadList()
      expect(list[0].status).toBe('downloading')
    })

    it('更新不存在的影片应该返回 false', () => {
      const { updateDownloadStatus } = useDownloadList()

      const result = updateDownloadStatus('non-existent', 'completed')

      expect(result).toBe(false)
    })
  })

  describe('getDownloadList', () => {
    it('应该按添加时间降序返回列表', async () => {
      const { addToDownloadList, getDownloadList } = useDownloadList()

      const movie1: MovieDetail = {
        id: 'm1',
        code: 'TEST-001',
        title: '影片1',
        slug: 'movie-1',
        isR18: false,
        sourceUrl: 'https://source.com',
        createdAt: new Date(),
        updatedAt: new Date(),
        players: [],
        relatedMovies: [],
      }

      const movie2: MovieDetail = {
        id: 'm2',
        code: 'TEST-002',
        title: '影片2',
        slug: 'movie-2',
        isR18: false,
        sourceUrl: 'https://source.com',
        createdAt: new Date(),
        updatedAt: new Date(),
        players: [],
        relatedMovies: [],
      }

      addToDownloadList(movie1)
      // 确保时间戳不同
      await new Promise(resolve => setTimeout(resolve, 10))
      addToDownloadList(movie2)

      const list = getDownloadList()

      expect(list[0].movieId).toBe('m2') // 最新的在前面
      expect(list[1].movieId).toBe('m1')
    })

    it('应该支持按状态筛选', () => {
      const { addToDownloadList, updateDownloadStatus, getDownloadList } = useDownloadList()

      const movie1: MovieDetail = {
        id: 'm1',
        code: 'TEST-001',
        title: '影片1',
        slug: 'movie-1',
        isR18: false,
        sourceUrl: 'https://source.com',
        createdAt: new Date(),
        updatedAt: new Date(),
        players: [],
        relatedMovies: [],
      }

      const movie2: MovieDetail = {
        id: 'm2',
        code: 'TEST-002',
        title: '影片2',
        slug: 'movie-2',
        isR18: false,
        sourceUrl: 'https://source.com',
        createdAt: new Date(),
        updatedAt: new Date(),
        players: [],
        relatedMovies: [],
      }

      addToDownloadList(movie1)
      addToDownloadList(movie2)
      updateDownloadStatus('m1', 'completed')

      const completedList = getDownloadList('completed')
      expect(completedList).toHaveLength(1)
      expect(completedList[0].movieId).toBe('m1')

      const plannedList = getDownloadList('planned')
      expect(plannedList).toHaveLength(1)
      expect(plannedList[0].movieId).toBe('m2')
    })
  })

  describe('stats', () => {
    it('应该正确统计各状态数量', () => {
      const { addToDownloadList, updateDownloadStatus, stats } = useDownloadList()

      const movies: MovieDetail[] = [
        { id: 'm1', code: 'T1', title: 'M1', slug: 's1', isR18: false, sourceUrl: '', createdAt: new Date(), updatedAt: new Date(), players: [], relatedMovies: [] },
        { id: 'm2', code: 'T2', title: 'M2', slug: 's2', isR18: false, sourceUrl: '', createdAt: new Date(), updatedAt: new Date(), players: [], relatedMovies: [] },
        { id: 'm3', code: 'T3', title: 'M3', slug: 's3', isR18: false, sourceUrl: '', createdAt: new Date(), updatedAt: new Date(), players: [], relatedMovies: [] },
      ]

      movies.forEach(m => addToDownloadList(m))
      updateDownloadStatus('m1', 'downloading')
      updateDownloadStatus('m2', 'completed')

      expect(stats.value.total).toBe(3)
      expect(stats.value.planned).toBe(1)
      expect(stats.value.downloading).toBe(1)
      expect(stats.value.completed).toBe(1)
    })
  })

  describe('removeMultiple', () => {
    it('应该批量移除多个影片', () => {
      const { addToDownloadList, removeMultiple, stats } = useDownloadList()

      const movies: MovieDetail[] = [
        { id: 'm1', code: 'T1', title: 'M1', slug: 's1', isR18: false, sourceUrl: '', createdAt: new Date(), updatedAt: new Date(), players: [], relatedMovies: [] },
        { id: 'm2', code: 'T2', title: 'M2', slug: 's2', isR18: false, sourceUrl: '', createdAt: new Date(), updatedAt: new Date(), players: [], relatedMovies: [] },
        { id: 'm3', code: 'T3', title: 'M3', slug: 's3', isR18: false, sourceUrl: '', createdAt: new Date(), updatedAt: new Date(), players: [], relatedMovies: [] },
      ]

      movies.forEach(m => addToDownloadList(m))

      const removed = removeMultiple(['m1', 'm3'])

      expect(removed).toBe(2)
      expect(stats.value.total).toBe(1)
    })
  })

  describe('clearAll', () => {
    it('应该清空所有数据', () => {
      const { addToDownloadList, clearAll, stats } = useDownloadList()

      const mockMovie: MovieDetail = {
        id: 'm1',
        code: 'TEST-001',
        title: '测试影片',
        slug: 'test-movie',
        isR18: false,
        sourceUrl: 'https://source.com',
        createdAt: new Date(),
        updatedAt: new Date(),
        players: [],
        relatedMovies: [],
      }

      addToDownloadList(mockMovie)
      expect(stats.value.total).toBe(1)

      clearAll()
      expect(stats.value.total).toBe(0)
    })
  })

  describe('localStorage persistence', () => {
    it('应该从 localStorage 加载数据', () => {
      const testData = JSON.stringify([
        {
          movieId: 'm1',
          movieCode: 'TEST-001',
          title: '测试影片',
          status: 'planned',
          addedAt: Date.now(),
        },
      ])

      localStorageMock.getItem.mockReturnValue(testData)

      const { stats } = useDownloadList()

      expect(stats.value.total).toBe(1)
      expect(localStorageMock.getItem).toHaveBeenCalledWith('starye:download-list')
    })

    it('应该处理损坏的 localStorage 数据', () => {
      localStorageMock.getItem.mockReturnValue('invalid json')

      const { stats } = useDownloadList()

      expect(stats.value.total).toBe(0)
    })

    it('应该在添加影片时保存到 localStorage', () => {
      const { addToDownloadList } = useDownloadList()

      const mockMovie: MovieDetail = {
        id: 'm1',
        code: 'TEST-001',
        title: '测试影片',
        slug: 'test-movie',
        isR18: false,
        sourceUrl: 'https://source.com',
        createdAt: new Date(),
        updatedAt: new Date(),
        players: [],
        relatedMovies: [],
      }

      addToDownloadList(mockMovie)

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'starye:download-list',
        expect.stringContaining('m1'),
      )
    })
  })
})
