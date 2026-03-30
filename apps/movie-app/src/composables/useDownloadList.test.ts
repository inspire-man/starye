import { describe, expect, it, vi, beforeEach } from 'vitest'
import { useDownloadList } from './useDownloadList'

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    },
  }
})()

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
})

describe('useDownloadList', () => {
  beforeEach(() => {
    localStorageMock.clear()
    vi.clearAllMocks()
  })

  describe('状态管理', () => {
    it('应该提供下载列表响应式状态', () => {
      const { downloadList, loading, stats } = useDownloadList()

      expect(downloadList).toBeDefined()
      expect(loading).toBeDefined()
      expect(stats).toBeDefined()
    })

    it('应该初始化为空列表', () => {
      const { downloadList } = useDownloadList()

      expect(downloadList.value).toEqual([])
    })
  })

  describe('列表管理', () => {
    it('应该提供添加方法', () => {
      const { addToDownloadList } = useDownloadList()

      expect(typeof addToDownloadList).toBe('function')
    })

    it('应该提供删除方法', () => {
      const { removeFromDownloadList, removeMultiple } = useDownloadList()

      expect(typeof removeFromDownloadList).toBe('function')
      expect(typeof removeMultiple).toBe('function')
    })

    it('应该提供更新状态方法', () => {
      const { updateDownloadStatus } = useDownloadList()

      expect(typeof updateDownloadStatus).toBe('function')
    })

    it('应该提供清空方法', () => {
      const { clearAll } = useDownloadList()

      expect(typeof clearAll).toBe('function')
    })
  })

  describe('查询功能', () => {
    it('应该提供检查方法', () => {
      const { isInDownloadList } = useDownloadList()

      expect(typeof isInDownloadList).toBe('function')
    })

    it('应该提供获取列表方法', () => {
      const { getDownloadList } = useDownloadList()

      expect(typeof getDownloadList).toBe('function')
    })
  })

  describe('工具函数', () => {
    it('应该提供所有必要的方法', () => {
      const dl = useDownloadList()

      expect(typeof dl.addToDownloadList).toBe('function')
      expect(typeof dl.removeFromDownloadList).toBe('function')
      expect(typeof dl.removeMultiple).toBe('function')
      expect(typeof dl.updateDownloadStatus).toBe('function')
      expect(typeof dl.clearAll).toBe('function')
      expect(typeof dl.isInDownloadList).toBe('function')
      expect(typeof dl.getDownloadList).toBe('function')
      expect(dl.stats).toBeDefined()
    })
  })
})
